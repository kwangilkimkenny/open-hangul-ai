-- HanView AI — Row Level Security Policies
-- 모든 테이블에 RLS 적용 — 사용자는 자신의 데이터만 접근 가능

-- ============================================================
-- profiles
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 프로필 조회 가능"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "사용자는 자신의 프로필 수정 가능"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT는 트리거(handle_new_user)로만 — 직접 INSERT 차단
CREATE POLICY "프로필 INSERT 차단 (트리거 전용)"
  ON public.profiles FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- subscriptions
-- ============================================================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 구독 조회 가능"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE는 service_role(Edge Function)만
CREATE POLICY "구독 변경은 service_role만"
  ON public.subscriptions FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- payments
-- ============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 결제 이력 조회 가능"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "결제 변경은 service_role만"
  ON public.payments FOR ALL
  USING (false)
  WITH CHECK (false);

-- ============================================================
-- documents
-- ============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 문서 조회 가능"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id AND is_archived = false);

CREATE POLICY "사용자는 자신의 문서 생성 가능"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 문서 수정 가능"
  ON public.documents FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "사용자는 자신의 문서 삭제 가능"
  ON public.documents FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- audit_logs (read-only)
-- ============================================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "사용자는 자신의 감사 로그 조회 가능"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT는 service_role만 (위변조 방지)
CREATE POLICY "감사 로그 INSERT는 service_role만"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

-- ============================================================
-- Storage 버킷 생성 + 정책
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  104857600,  -- 100MB
  ARRAY[
    'application/octet-stream',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/pdf',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'text/markdown',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "사용자는 자신의 폴더에 업로드 가능"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "사용자는 자신의 파일만 조회 가능"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "사용자는 자신의 파일만 삭제 가능"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
