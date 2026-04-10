/**
 * KakaoPay — Webhook 핸들러
 * 카카오페이는 공식 webhook이 제한적이므로,
 * 정기결제 갱신/환불 시 호출되는 콜백을 처리합니다.
 *
 * 환경변수:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface KakaoWebhookPayload {
  event: 'subscription.renewed' | 'subscription.canceled' | 'payment.refunded';
  cid: string;
  tid: string;
  partner_order_id: string;
  partner_user_id: string;
  amount?: { total: number };
  status: string;
  approved_at?: string;
  canceled_at?: string;
}

serve(async req => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload = (await req.json()) as KakaoWebhookPayload;

    console.info('[Kakao Webhook]', payload.event, payload.partner_order_id);

    const { event, partner_order_id, partner_user_id } = payload;

    switch (event) {
      case 'subscription.renewed': {
        // 정기결제 갱신
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('id, period, plan')
          .eq('user_id', partner_user_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          const newEnd = new Date();
          if (existing.period === 'monthly') newEnd.setMonth(newEnd.getMonth() + 1);
          else newEnd.setFullYear(newEnd.getFullYear() + 1);

          await supabase
            .from('subscriptions')
            .update({ current_period_end: newEnd.toISOString() })
            .eq('id', existing.id);

          // 새 결제 기록
          await supabase.from('payments').insert({
            user_id: partner_user_id,
            subscription_id: existing.id,
            order_id: partner_order_id,
            provider: 'kakao',
            provider_payment_id: payload.tid,
            amount: payload.amount?.total || 0,
            currency: 'KRW',
            status: 'completed',
            plan_id: existing.plan,
            plan_period: existing.period,
            method: 'kakao',
            paid_at: payload.approved_at || new Date().toISOString(),
            metadata: { event, payload },
          });

          await supabase
            .from('profiles')
            .update({ plan_expires_at: newEnd.toISOString() })
            .eq('id', partner_user_id);
        }
        break;
      }

      case 'subscription.canceled': {
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('user_id', partner_user_id)
          .eq('status', 'active');
        break;
      }

      case 'payment.refunded': {
        await supabase
          .from('payments')
          .update({ status: 'refunded', refunded_at: payload.canceled_at || new Date().toISOString() })
          .eq('order_id', partner_order_id);

        await supabase
          .from('profiles')
          .update({ plan: 'free', plan_period: null, plan_expires_at: null })
          .eq('id', partner_user_id);
        break;
      }
    }

    await supabase.from('audit_logs').insert({
      user_id: partner_user_id,
      action: `webhook.kakao.${event}`,
      resource_type: 'payment',
      resource_id: partner_order_id,
      metadata: { provider: 'kakao', payload },
    });

    return jsonResponse({ received: true });
  } catch (err) {
    console.error('kakao-webhook error:', err);
    return jsonResponse({ received: true, error: String(err) }, 200);
  }
});

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
