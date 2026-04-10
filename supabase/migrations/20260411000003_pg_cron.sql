-- pg_cron 정기 작업 등록
-- 주의: 이 마이그레이션은 Supabase Dashboard에서 수동 실행 권장
-- (SUPABASE_URL과 SERVICE_ROLE_KEY를 실제 값으로 교체 필요)

-- pg_cron 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 매일 자정 (KST 09:00 UTC) — 정기결제 자동 갱신
-- ⚠️ YOUR_PROJECT_REF와 YOUR_SERVICE_ROLE_KEY를 실제 값으로 교체
SELECT cron.schedule(
  'process-renewals-daily',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-renewals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- 매시간 — 만료된 결제 세션 정리 (pending → expired)
SELECT cron.schedule(
  'expire-pending-payments',
  '0 * * * *',
  $$
    UPDATE public.payments
    SET status = 'failed',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{auto_expired}', 'true')
    WHERE status = 'pending'
      AND created_at < NOW() - INTERVAL '24 hours';
  $$
);

-- 매월 1일 — AI 크레딧 리셋
SELECT cron.schedule(
  'reset-ai-credits-monthly',
  '0 0 1 * *',
  $$
    UPDATE public.profiles
    SET ai_credits_remaining = CASE plan
      WHEN 'free' THEN 50
      WHEN 'personal' THEN 1000
      WHEN 'business' THEN 10000
      WHEN 'enterprise' THEN 999999
      ELSE 50
    END,
    ai_credits_reset_at = NOW();
  $$
);

-- 등록된 cron 작업 확인
-- SELECT * FROM cron.job;

-- cron 작업 제거 (필요 시)
-- SELECT cron.unschedule('process-renewals-daily');
-- SELECT cron.unschedule('expire-pending-payments');
-- SELECT cron.unschedule('reset-ai-credits-monthly');
