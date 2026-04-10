/**
 * KakaoPay — 결제 준비 Edge Function
 *
 * 환경변수:
 *   KAKAO_ADMIN_KEY  - 카카오 어드민 키 (DEV / SECRET)
 *   KAKAO_CID        - 가맹점 코드 (TC0ONETIME = 테스트)
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const KAKAO_ADMIN_KEY = Deno.env.get('KAKAO_ADMIN_KEY')!;
const KAKAO_CID = Deno.env.get('KAKAO_CID') ?? 'TC0ONETIME';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

interface ReadyRequest {
  orderId: string;
  orderName: string;
  amount: number;
  planId: string;
  period: 'monthly' | 'yearly';
  successUrl: string;
  failUrl: string;
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: '인증이 필요합니다' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: '유효하지 않은 세션' }, 401);
    }

    const body = (await req.json()) as ReadyRequest;
    const { orderId, orderName, amount, planId, period, successUrl, failUrl } = body;

    // KakaoPay /v1/payment/ready 호출
    const params = new URLSearchParams({
      cid: KAKAO_CID,
      partner_order_id: orderId,
      partner_user_id: user.id,
      item_name: orderName,
      quantity: '1',
      total_amount: String(amount),
      tax_free_amount: '0',
      approval_url: `${successUrl}?provider=kakao&orderId=${encodeURIComponent(orderId)}&planId=${planId}&period=${period}&amount=${amount}`,
      fail_url: failUrl,
      cancel_url: `${failUrl}?canceled=true`,
    });

    const kakaoResponse = await fetch('https://kapi.kakao.com/v1/payment/ready', {
      method: 'POST',
      headers: {
        'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: params.toString(),
    });

    const kakaoData = await kakaoResponse.json();

    if (!kakaoResponse.ok) {
      console.error('KakaoPay ready failed:', kakaoData);
      return jsonResponse({
        error: kakaoData.msg || '카카오페이 결제 준비 실패',
        code: kakaoData.code,
      }, 400);
    }

    return jsonResponse({
      tid: kakaoData.tid,
      next_redirect_pc_url: kakaoData.next_redirect_pc_url,
      next_redirect_mobile_url: kakaoData.next_redirect_mobile_url,
      next_redirect_app_url: kakaoData.next_redirect_app_url,
      created_at: kakaoData.created_at,
    });
  } catch (err) {
    console.error('kakao-ready error:', err);
    return jsonResponse({ error: '서버 오류' }, 500);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
