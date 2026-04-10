/**
 * Toss Payments — Webhook 핸들러
 * 비동기 결제 상태 변경(가상계좌 입금, 환불, 부분 취소 등) 수신
 *
 * Webhook 등록: 토스페이먼츠 개발자 센터
 *   URL: https://xxxxx.supabase.co/functions/v1/toss-webhook
 *   이벤트: PAYMENT.STATUS_CHANGED, VIRTUAL_ACCOUNT.STATUS_CHANGED
 *
 * 환경변수:
 *   TOSS_WEBHOOK_SECRET  - 서명 검증용 (Toss 공식 가이드 참조)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TossWebhookPayload {
  eventType: 'PAYMENT.STATUS_CHANGED' | 'VIRTUAL_ACCOUNT.STATUS_CHANGED';
  data: {
    paymentKey: string;
    orderId: string;
    status: 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED';
    method?: string;
    totalAmount?: number;
    canceledAt?: string;
    cancels?: Array<{ cancelAmount: number; cancelReason: string; canceledAt: string }>;
  };
  createdAt: string;
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = (await req.json()) as TossWebhookPayload;

    console.info('[Toss Webhook]', payload.eventType, payload.data.orderId, payload.data.status);

    const { orderId, paymentKey, status } = payload.data;

    // 기존 결제 레코드 조회
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('id, user_id, status, plan_id, plan_period, amount')
      .eq('order_id', orderId)
      .single();

    if (fetchError || !payment) {
      console.warn(`Payment not found: ${orderId}`);
      // 멱등성: 미존재 결제도 200 반환 (Toss는 재시도 안 함)
      return jsonResponse({ received: true, found: false });
    }

    // 상태 매핑
    const statusMap: Record<string, string> = {
      DONE: 'completed',
      CANCELED: 'canceled',
      PARTIAL_CANCELED: 'refunded',
      ABORTED: 'failed',
      EXPIRED: 'failed',
      WAITING_FOR_DEPOSIT: 'pending',
    };
    const newStatus = statusMap[status] || 'pending';

    // 이미 같은 상태이면 무시 (멱등성)
    if (payment.status === newStatus) {
      return jsonResponse({ received: true, idempotent: true });
    }

    // payments 업데이트
    const updates: Record<string, any> = { status: newStatus };
    if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
      updates.refunded_at = payload.data.canceledAt || new Date().toISOString();
    }
    if (status === 'DONE') {
      updates.paid_at = payload.createdAt;
    }

    await supabase.from('payments').update(updates).eq('order_id', orderId);

    // 환불 처리: 구독 취소 + 플랜 다운그레이드
    if (status === 'CANCELED' && payment.status === 'completed') {
      // subscription 찾아서 status='canceled'
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('user_id', payment.user_id)
        .eq('status', 'active');

      // 즉시 free 플랜으로 다운그레이드 (또는 만료일까지 유지 정책에 따라 변경)
      await supabase
        .from('profiles')
        .update({ plan: 'free', plan_period: null, plan_expires_at: null })
        .eq('id', payment.user_id);
    }

    // 가상계좌 입금 완료 처리
    if (status === 'DONE' && payment.status === 'pending') {
      // 결제 성공 처리 (subscriptions/profiles 업데이트)
      const periodEnd = new Date();
      if (payment.plan_period === 'monthly') periodEnd.setMonth(periodEnd.getMonth() + 1);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      await supabase.from('subscriptions').insert({
        user_id: payment.user_id,
        plan: payment.plan_id,
        period: payment.plan_period,
        status: 'active',
        started_at: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        provider: 'toss',
        provider_subscription_id: paymentKey,
      });

      await supabase
        .from('profiles')
        .update({
          plan: payment.plan_id,
          plan_period: payment.plan_period,
          plan_expires_at: periodEnd.toISOString(),
        })
        .eq('id', payment.user_id);
    }

    // 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: payment.user_id,
      action: `webhook.toss.${status.toLowerCase()}`,
      resource_type: 'payment',
      resource_id: orderId,
      metadata: { provider: 'toss', eventType: payload.eventType, payload: payload.data },
    });

    return jsonResponse({ received: true, processed: true });
  } catch (err) {
    console.error('toss-webhook error:', err);
    // 200 반환하여 Toss 재시도 방지 (수동 조사 필요)
    return jsonResponse({ received: true, error: String(err) }, 200);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
