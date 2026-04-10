/**
 * Process Renewals — 정기결제 자동 갱신 Cron
 *
 * 매일 자정에 pg_cron으로 호출됨
 * 만료일이 24시간 이내인 active 구독을 처리:
 * - 결제 성공: subscription.current_period_end 연장 + payments 기록 + 영수증 이메일
 * - 결제 실패: subscription.status = 'past_due' + 사용자에게 알림
 * - 만료된 구독: subscription.status = 'canceled' + plan = 'free'
 *
 * pg_cron 등록 (Dashboard SQL Editor):
 *   SELECT cron.schedule(
 *     'process-renewals',
 *     '0 0 * * *',
 *     $$ SELECT net.http_post(
 *       url := 'https://xxxxx.supabase.co/functions/v1/process-renewals',
 *       headers := '{"Authorization": "Bearer SERVICE_ROLE_KEY"}'::jsonb
 *     ); $$
 *   );
 */

import { serve } from 'https://deno.land/std@0.220.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOSS_SECRET_KEY = Deno.env.get('TOSS_SECRET_KEY')!;
const KAKAO_ADMIN_KEY = Deno.env.get('KAKAO_ADMIN_KEY')!;
const KAKAO_CID = Deno.env.get('KAKAO_CID') ?? 'TC0SUBSCRIPTION';

const PRICING: Record<string, { monthly: number; yearly: number }> = {
  personal: { monthly: 9900, yearly: 99000 },
  business: { monthly: 29900, yearly: 299000 },
};

serve(async req => {
  // Service Role 인증 확인 (cron 호출 전용)
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.includes(SUPABASE_SERVICE_ROLE_KEY)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const stats = {
    processed: 0,
    renewed: 0,
    failed: 0,
    expired: 0,
    canceled: 0,
  };

  try {
    // 1. 이미 만료된 구독 처리 (canceled 상태로 전환)
    const { data: expired } = await supabase
      .from('subscriptions')
      .select('id, user_id')
      .eq('status', 'active')
      .lt('current_period_end', now.toISOString());

    for (const sub of expired || []) {
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', canceled_at: now.toISOString() })
        .eq('id', sub.id);

      await supabase
        .from('profiles')
        .update({ plan: 'free', plan_period: null, plan_expires_at: null, ai_credits_remaining: 50 })
        .eq('id', sub.user_id);

      await supabase.from('audit_logs').insert({
        user_id: sub.user_id,
        action: 'subscription.expired',
        resource_type: 'subscription',
        resource_id: sub.id,
        metadata: { reason: 'period_end_passed' },
      });

      stats.expired++;
    }

    // 2. 만료 임박 구독 갱신 (24시간 이내)
    const { data: dueSoon } = await supabase
      .from('subscriptions')
      .select('id, user_id, plan, period, provider, provider_subscription_id')
      .eq('status', 'active')
      .gte('current_period_end', now.toISOString())
      .lt('current_period_end', tomorrow.toISOString());

    for (const sub of dueSoon || []) {
      stats.processed++;

      const amount = PRICING[sub.plan]?.[sub.period] || 0;
      if (!amount) continue;

      // 사용자 정보 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('id', sub.user_id)
        .single();

      if (!profile) continue;

      const orderId = `RENEW-${Date.now()}-${sub.id.slice(0, 8)}`;
      let paymentSuccess = false;
      let providerPaymentId = '';
      let errorMsg = '';

      try {
        // Toss 정기결제 (billingKey 방식 — 사전 등록 필요)
        if (sub.provider === 'toss' && sub.provider_subscription_id) {
          const tossResponse = await fetch(
            `https://api.tosspayments.com/v1/billing/${sub.provider_subscription_id}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${btoa(TOSS_SECRET_KEY + ':')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                customerKey: sub.user_id,
                amount,
                orderId,
                orderName: `${sub.plan} 플랜 (${sub.period === 'monthly' ? '월간' : '연간'}) 정기결제`,
                customerEmail: profile.email,
                customerName: profile.name,
              }),
            },
          );

          if (tossResponse.ok) {
            const data = await tossResponse.json();
            paymentSuccess = true;
            providerPaymentId = data.paymentKey;
          } else {
            const err = await tossResponse.json();
            errorMsg = err.message || '결제 실패';
          }
        }
        // KakaoPay 정기결제 (sid 방식)
        else if (sub.provider === 'kakao' && sub.provider_subscription_id) {
          const params = new URLSearchParams({
            cid: KAKAO_CID,
            sid: sub.provider_subscription_id,
            partner_order_id: orderId,
            partner_user_id: sub.user_id,
            item_name: `${sub.plan} 플랜 정기결제`,
            quantity: '1',
            total_amount: String(amount),
            tax_free_amount: '0',
          });

          const kakaoResponse = await fetch('https://kapi.kakao.com/v1/payment/subscription', {
            method: 'POST',
            headers: {
              'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
            },
            body: params.toString(),
          });

          if (kakaoResponse.ok) {
            const data = await kakaoResponse.json();
            paymentSuccess = true;
            providerPaymentId = data.tid;
          } else {
            const err = await kakaoResponse.json();
            errorMsg = err.msg || '카카오페이 정기결제 실패';
          }
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
      }

      if (paymentSuccess) {
        // 갱신 성공
        const newEnd = new Date(sub.period === 'monthly'
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));

        await supabase
          .from('subscriptions')
          .update({ current_period_end: newEnd.toISOString() })
          .eq('id', sub.id);

        await supabase.from('payments').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          order_id: orderId,
          provider: sub.provider,
          provider_payment_id: providerPaymentId,
          amount,
          currency: 'KRW',
          status: 'completed',
          plan_id: sub.plan,
          plan_period: sub.period,
          method: sub.provider,
          paid_at: now.toISOString(),
          metadata: { type: 'recurring_renewal' },
        });

        await supabase
          .from('profiles')
          .update({ plan_expires_at: newEnd.toISOString() })
          .eq('id', sub.user_id);

        await supabase.from('audit_logs').insert({
          user_id: sub.user_id,
          action: 'subscription.renewed',
          resource_type: 'subscription',
          resource_id: sub.id,
          metadata: { provider: sub.provider, amount, orderId },
        });

        // 영수증 이메일 발송 (send-email 함수 호출)
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              template: 'subscription_renewal',
              to: profile.email,
              data: {
                name: profile.name,
                planName: sub.plan,
                amount,
                nextBillingDate: newEnd.toLocaleDateString('ko-KR'),
              },
            }),
          });
        } catch (emailErr) {
          console.warn('Renewal email failed:', emailErr);
        }

        stats.renewed++;
      } else {
        // 갱신 실패 → past_due 상태
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', sub.id);

        await supabase.from('payments').insert({
          user_id: sub.user_id,
          subscription_id: sub.id,
          order_id: orderId,
          provider: sub.provider,
          provider_payment_id: '',
          amount,
          currency: 'KRW',
          status: 'failed',
          plan_id: sub.plan,
          plan_period: sub.period,
          method: sub.provider,
          metadata: { type: 'recurring_renewal', error: errorMsg },
        });

        await supabase.from('audit_logs').insert({
          user_id: sub.user_id,
          action: 'subscription.renewal_failed',
          resource_type: 'subscription',
          resource_id: sub.id,
          metadata: { provider: sub.provider, error: errorMsg, amount },
        });

        stats.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...stats, runAt: now.toISOString() }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('process-renewals error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), partial: stats }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
