# Supabase 백엔드 배포 가이드

오픈한글 AI를 **데모 모드**에서 **실서버 모드**로 전환하기 위한 단계별 가이드입니다.

> **소요 시간**: 약 1~2시간 (계정 발급 시간 제외)

---

## 1. Supabase 프로젝트 생성

1. https://supabase.com 가입 후 새 프로젝트 생성
2. 리전: `Northeast Asia (Seoul)` 권장
3. DB 비밀번호 안전하게 보관
4. 프로젝트 생성 완료 후 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: 프론트엔드용 (공개 가능)
   - **service_role key**: 백엔드 전용 (절대 공개 금지)

---

## 2. 데이터베이스 마이그레이션 실행

### 옵션 A: Supabase Dashboard SQL Editor 사용

1. Dashboard → **SQL Editor** 이동
2. `supabase/migrations/20260411000001_initial_schema.sql` 내용 전체 복사 → 실행
3. `supabase/migrations/20260411000002_rls_policies.sql` 내용 전체 복사 → 실행
4. **Table Editor**에서 5개 테이블 생성 확인:
   - `profiles`, `subscriptions`, `payments`, `documents`, `audit_logs`

### 옵션 B: Supabase CLI 사용

```bash
# CLI 설치
npm install -g supabase

# 프로젝트 연결
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 마이그레이션 실행
supabase db push
```

---

## 3. 환경변수 설정

### 3-1. 프론트엔드 (`.env`)

프로젝트 루트에 `.env` 파일을 생성하고 다음을 추가:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Toss Payments (운영 키 — 발급 후 입력)
VITE_TOSS_CLIENT_KEY=live_ck_...
```

### 3-2. Edge Functions Secrets

Supabase Dashboard → **Edge Functions** → **Secrets**에서 다음 환경변수 설정:

```
TOSS_SECRET_KEY=live_sk_...           # 토스페이먼츠 시크릿 키
KAKAO_ADMIN_KEY=YOUR_KAKAO_ADMIN_KEY  # 카카오 어드민 키
KAKAO_CID=TC0ONETIME                  # 운영 시 실제 CID로 교체
RESEND_API_KEY=re_...                 # Resend API 키
EMAIL_FROM=OpenHangul AI <noreply@yourdomain.com>
```

CLI로 설정하려면:

```bash
supabase secrets set TOSS_SECRET_KEY=live_sk_...
supabase secrets set KAKAO_ADMIN_KEY=...
supabase secrets set KAKAO_CID=TC0ONETIME
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM="OpenHangul AI <noreply@yourdomain.com>"
```

---

## 4. Edge Functions 배포

```bash
# 모든 Functions 일괄 배포
supabase functions deploy toss-confirm
supabase functions deploy kakao-ready
supabase functions deploy kakao-approve
supabase functions deploy send-email
```

배포 후 확인:
- Dashboard → **Edge Functions** 메뉴에서 4개 함수 실행 상태 확인
- 각 함수의 **Logs** 탭에서 호출 내역 모니터링 가능

---

## 5. 결제 게이트웨이 설정

### 5-1. 토스페이먼츠

1. https://www.tosspayments.com 가맹 신청
2. 가맹 승인 후 **개발자 센터** → **API 키**에서 운영 키 발급
3. **상점 정보** → **결제 알림(Webhook) URL**에 다음 등록:
   ```
   https://xxxxx.supabase.co/functions/v1/toss-webhook
   ```
   (webhook 함수는 별도 추가 가능)

### 5-2. 카카오페이

1. https://developers.kakao.com 앱 등록
2. **카카오페이** 설정에서 **단건결제** 활성화
3. **CID** 발급 (테스트: `TC0ONETIME`, 운영: 별도 발급)
4. **Admin 키** 복사 → `KAKAO_ADMIN_KEY` 환경변수에 등록

---

## 6. Resend 이메일 설정

1. https://resend.com 가입
2. **Domains**에서 본인 도메인 추가 (DNS TXT 레코드 설정)
3. **API Keys**에서 새 키 발급
4. `RESEND_API_KEY` 및 `EMAIL_FROM` 환경변수 설정

---

## 7. Storage 버킷 설정

마이그레이션 SQL이 자동으로 `documents` 버킷을 생성합니다. 추가 설정:

1. Dashboard → **Storage** → `documents` 버킷 확인
2. **Policies** 탭에서 RLS 정책 적용 확인
3. **CORS Configuration** 추가 (필요 시):
   ```json
   [{
     "origin": "https://yourdomain.com",
     "method": ["GET", "POST", "PUT", "DELETE"],
     "headers": ["*"]
   }]
   ```

---

## 8. 동작 확인

### 8-1. 인증
1. 프론트엔드에서 `/signup` 접근
2. 새 이메일로 가입 → 인증 메일 수신 확인 (Supabase Auth 기본 메일)
3. 인증 완료 후 `/login`에서 로그인 → `/editor`로 이동 확인
4. Dashboard → **Authentication** → **Users**에서 신규 사용자 확인
5. **Table Editor** → `profiles`에서 프로필 자동 생성 확인

### 8-2. 결제 플로우
1. `/pricing`에서 Personal 플랜 선택
2. **토스 카드** 선택 후 결제 진행
3. 테스트 카드 정보 입력 (테스트 키 사용 시 임의 카드 사용 가능)
4. `/payment/success` 페이지 표시 확인
5. **Table Editor** → `payments`에 결제 기록 생성 확인
6. **Table Editor** → `subscriptions`에 구독 생성 확인
7. **Table Editor** → `profiles.plan`이 `personal`로 변경 확인

### 8-3. 카카오페이
1. `/pricing`에서 카카오페이 선택
2. 카카오페이 결제창으로 이동 → 결제 진행
3. 콜백 후 `/payment/success` → 동일하게 DB 확인

### 8-4. 이메일 발송 테스트
브라우저 콘솔에서 직접 호출:

```javascript
const { data, error } = await window.__supabase.functions.invoke('send-email', {
  body: {
    template: 'welcome',
    to: 'your@email.com',
    data: { name: '테스트' }
  }
});
console.log(data, error);
```

---

## 9. 정기 결제 (Cron Job)

Supabase Cron으로 만료 임박 구독을 자동 갱신:

```sql
-- pg_cron 확장 활성화 (Dashboard → Database → Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 매일 자정에 만료 예정 구독 처리
SELECT cron.schedule(
  'process-renewals',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://xxxxx.supabase.co/functions/v1/process-renewals',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);
```

(별도 `process-renewals` Edge Function 구현 필요)

---

## 10. 모니터링 & 운영

### 권장 도구
- **Sentry**: 프론트엔드 에러 추적 (`VITE_SENTRY_DSN` 환경변수)
- **Supabase Logs**: Edge Functions 호출 로그
- **Resend Dashboard**: 이메일 발송 통계 / Bounce 모니터링
- **토스/카카오 Dashboard**: 결제 통계 / 환불 처리

### 보안 점검
- [ ] 모든 RLS 정책 활성화 확인
- [ ] `service_role` 키는 절대 프론트엔드에 노출 X
- [ ] CORS 정책 도메인 화이트리스트
- [ ] 정기적 보안 감사 (npm audit, Snyk)

---

## 11. 데모 모드 ↔ 실서버 모드 전환

`.env` 파일의 `VITE_SUPABASE_URL`만 비우면 즉시 데모 모드로 전환됩니다.
이 듀얼 모드 덕분에 개발/스테이징/프로덕션 환경을 같은 코드베이스로 운영할 수 있습니다.

```env
# 데모 모드 (백엔드 없이 동작)
# VITE_SUPABASE_URL=

# 실서버 모드
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

브라우저 콘솔에서 현재 모드 확인:
```
[Supabase] Mode: production (https://xxxxx.supabase.co)
```

---

## 트러블슈팅

### "Failed to fetch" 오류
- Edge Functions의 CORS 헤더 확인
- 프론트엔드 origin이 Supabase Dashboard에서 허용되어 있는지 확인

### 결제 후 플랜 미반영
- Edge Functions Logs 확인
- `payments` / `subscriptions` 테이블 직접 조회
- `profiles.plan` 컬럼 직접 업데이트하여 복구

### 이메일 미수신
- Resend Domain 인증 상태 확인 (DNS 전파 최대 48시간)
- Bounces / Spam folder 확인
- `EMAIL_FROM` 도메인이 인증된 도메인과 일치하는지

---

## 비용 견적 (월 1,000명 활성 사용자 기준)

| 서비스 | 무료 한도 | 예상 비용 |
|--------|----------|----------|
| Supabase Pro | $25/월 (DB 8GB, 50GB 대역폭) | $25 |
| Toss Payments | 결제액의 2.5%~3.3% | 매출 연동 |
| KakaoPay | 결제액의 2.9% | 매출 연동 |
| Resend | 100/일 무료, 그 후 $20/월 | $20 |
| 도메인 + DNS | - | $15/년 |
| **합계** | | **약 $50/월 + 결제 수수료** |

---

## 다음 단계

이 가이드를 완료하면 프로덕션 SaaS 출시가 가능합니다. 추가 권장 작업:

1. **CDN 추가**: Cloudflare 무료 플랜
2. **모니터링**: Sentry + Better Stack Uptime
3. **분석**: PostHog / Plausible
4. **고객지원**: Channel.io / Crisp
5. **백업**: Supabase 일일 백업 활성화 (Pro 플랜 기본 제공)
6. **법무 검토**: 약관/개인정보처리방침 변호사 검토
