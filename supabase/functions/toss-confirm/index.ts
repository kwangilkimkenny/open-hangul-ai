/**
 * Toss Payments — 결제 승인 Edge Function
 *
 * 흐름:
 * 1. 프론트엔드에서 결제 완료 후 successUrl로 리다이렉트
 * 2. 프론트엔드가 paymentKey, orderId, amount를 이 함수로 전송
 * 3. 이 함수가 Toss Secret Key로 confirm API 호출 (실제 결제)
 * 4. 결제 성공 시 payments 테이블에 기록 + profiles.plan 업데이트
 *
 * 환경변수:
 *   TOSS_SECRET_KEY  - 토스페이먼츠 시크릿 키
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const TOSS_SECRET_KEY = Deno.env.get('TOSS_SECRET_KEY') ?? 'test_sk_docs_OaPz8L5KdmQXkzRz3y47BMw6';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
  planId: 'personal' | 'business' | 'enterprise';
  planName: string;
  period: 'monthly' | 'yearly';
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 인증 확인
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: '인증이 필요합니다' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: '유효하지 않은 세션' }, 401);
    }

    const body = (await req.json()) as ConfirmRequest;
    const { paymentKey, orderId, amount, planId, planName, period } = body;

    if (!paymentKey || !orderId || !amount || !planId) {
      return jsonResponse({ error: '필수 파라미터 누락' }, 400);
    }

    // 중복 결제 방지 (idempotency)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, status')
      .eq('order_id', orderId)
      .single();

    if (existingPayment && existingPayment.status === 'completed') {
      return jsonResponse({ error: '이미 처리된 결제입니다', orderId }, 409);
    }

    // Toss Payments confirm API 호출
    const tossResponse = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(TOSS_SECRET_KEY + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      // 실패 기록
      await supabase.from('payments').insert({
        user_id: user.id,
        order_id: orderId,
        provider: 'toss',
        provider_payment_id: paymentKey,
        amount,
        currency: 'KRW',
        status: 'failed',
        plan_id: planId,
        plan_period: period,
        method: tossData.method || 'unknown',
        metadata: { error: tossData },
      });

      return jsonResponse({
        error: tossData.message || '결제 승인에 실패했습니다',
        code: tossData.code,
      }, 400);
    }

    // 결제 성공 — 트랜잭션으로 처리
    const periodEnd = new Date();
    if (period === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    // subscriptions 테이블에 구독 생성
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan: planId,
        period,
        status: 'active',
        started_at: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        provider: 'toss',
        provider_subscription_id: tossData.paymentKey,
      })
      .select()
      .single();

    if (subError) {
      console.error('Subscription insert failed:', subError);
    }

    // payments 테이블에 결제 기록
    await supabase.from('payments').insert({
      user_id: user.id,
      subscription_id: subscription?.id || null,
      order_id: orderId,
      provider: 'toss',
      provider_payment_id: tossData.paymentKey,
      amount,
      currency: 'KRW',
      status: 'completed',
      plan_id: planId,
      plan_period: period,
      method: tossData.method,
      receipt_url: tossData.receipt?.url || null,
      paid_at: tossData.approvedAt,
      metadata: { tossResponse: tossData },
    });

    // profiles.plan 업데이트
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
      metadata: { provider: 'toss', amount, planId, planName, period },
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null,
    });

    return jsonResponse({
      success: true,
      orderId,
      planId,
      planName,
      receiptUrl: tossData.receipt?.url || null,
      approvedAt: tossData.approvedAt,
    });
  } catch (err) {
    console.error('toss-confirm error:', err);
    return jsonResponse({ error: '서버 오류가 발생했습니다' }, 500);
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
