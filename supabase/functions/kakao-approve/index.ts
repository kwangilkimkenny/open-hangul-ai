/**
 * KakaoPay — 결제 승인 Edge Function
 * (사용자가 카카오 결제 완료 후 콜백 시 호출)
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const KAKAO_ADMIN_KEY = Deno.env.get('KAKAO_ADMIN_KEY')!;
const KAKAO_CID = Deno.env.get('KAKAO_CID') ?? 'TC0ONETIME';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface ApproveRequest {
  tid: string;
  pgToken: string;
  orderId: string;
  planId: 'personal' | 'business' | 'enterprise';
  planName: string;
  period: 'monthly' | 'yearly';
  amount: number;
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: '인증 필요' }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: '세션 무효' }, 401);

    const body = (await req.json()) as ApproveRequest;
    const { tid, pgToken, orderId, planId, planName, period, amount } = body;

    // 중복 처리 방지
    const { data: existing } = await supabase
      .from('payments')
      .select('id, status')
      .eq('order_id', orderId)
      .single();
    if (existing?.status === 'completed') {
      return jsonResponse({ error: '이미 처리된 결제' }, 409);
    }

    // KakaoPay /v1/payment/approve 호출
    const params = new URLSearchParams({
      cid: KAKAO_CID,
      tid,
      partner_order_id: orderId,
      partner_user_id: user.id,
      pg_token: pgToken,
    });

    const kakaoResponse = await fetch('https://kapi.kakao.com/v1/payment/approve', {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: params.toString(),
    });

    const kakaoData = await kakaoResponse.json();

    if (!kakaoResponse.ok) {
      await supabase.from('payments').insert({
        user_id: user.id,
        order_id: orderId,
        provider: 'kakao',
        provider_payment_id: tid,
        amount,
        currency: 'KRW',
        status: 'failed',
        plan_id: planId,
        plan_period: period,
        method: 'kakao',
        metadata: { error: kakaoData },
      });
      return jsonResponse({
        error: kakaoData.msg || '카카오페이 승인 실패',
      }, 400);
    }

    // 구독 생성
    const periodEnd = new Date();
    if (period === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    const { data: subscription } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan: planId,
        period,
        status: 'active',
        started_at: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        provider: 'kakao',
        provider_subscription_id: tid,
      })
      .select()
      .single();

    // 결제 기록
    await supabase.from('payments').insert({
      user_id: user.id,
      subscription_id: subscription?.id || null,
      order_id: orderId,
      provider: 'kakao',
      provider_payment_id: tid,
      amount: kakaoData.amount?.total || amount,
      currency: 'KRW',
      status: 'completed',
      plan_id: planId,
      plan_period: period,
      method: kakaoData.payment_method_type || 'kakao',
      paid_at: kakaoData.approved_at,
      metadata: { kakaoResponse: kakaoData },
    });

    // 프로필 업데이트
    await supabase
      .from('profiles')
      .update({
        plan: planId,
        plan_period: period,
        plan_expires_at: periodEnd.toISOString(),
        ai_credits_remaining: getCreditsForPlan(planId),
      })
      .eq('id', user.id);

    // 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'payment.completed',
      resource_type: 'payment',
      resource_id: orderId,
      metadata: { provider: 'kakao', amount, planId, planName, period },
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null,
    });

    return jsonResponse({
      success: true,
      orderId,
      planId,
      planName,
      approvedAt: kakaoData.approved_at,
    });
  } catch (err) {
    console.error('kakao-approve error:', err);
    return jsonResponse({ error: '서버 오류' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getCreditsForPlan(plan: string): number {
  const map: Record<string, number> = {
    free: 50, personal: 1000, business: 10000, enterprise: 999999,
  };
  return map[plan] || 50;
}
