# 보안 감사 체크리스트 (OWASP ASVS Level 2)

오픈한글 AI 프로덕션 출시 전 자가 점검 체크리스트.
모든 항목 PASS 후 외부 보안 감사(예: 코니아랩, SK쉴더스, 한국인터넷진흥원) 신청을 권장합니다.

---

## 자동 점검

```bash
npm run security:check
```

수동 항목 점검:

---

## V1: 아키텍처, 설계 및 위협 모델링

- [x] 사용자/관리자 역할 분리 (`profile.plan` 기반)
- [x] 모든 API 요청은 서버 사이드 검증 (Edge Functions)
- [x] 결제 confirm은 클라이언트가 아닌 서버에서만 수행
- [ ] 위협 모델링 문서화 (STRIDE 분석)

## V2: 인증 (Authentication)

- [x] 비밀번호 bcrypt 해싱 (Supabase Auth 자동 처리)
- [x] 비밀번호 최소 8자 검증
- [x] 이메일 인증 후 로그인 활성화 (Supabase Auth `emailRedirectTo`)
- [x] JWT 토큰 자동 갱신 (`autoRefreshToken: true`)
- [x] 로그아웃 시 토큰 무효화 (`supabase.auth.signOut`)
- [ ] 비밀번호 재설정 토큰 1시간 내 만료 (Supabase 기본값 확인)
- [ ] 로그인 시도 5회 실패 시 일시 차단 (Supabase Auth Hook 필요)
- [ ] 2FA/MFA 옵션 제공 (선택)

## V3: 세션 관리

- [x] HttpOnly + Secure 쿠키 (Supabase Auth 자동)
- [x] 세션 만료 시간 합리적 (1시간 access + 7일 refresh)
- [x] 동시 세션 추적 (Supabase Dashboard에서 확인 가능)
- [ ] 명시적 로그아웃 외 세션 종료 메커니즘 (관리자 강제 로그아웃)

## V4: 접근 제어

- [x] Row Level Security 모든 테이블 적용
- [x] 사용자는 자신의 데이터만 조회/수정 가능
- [x] `profiles` INSERT는 트리거로만 (직접 차단)
- [x] `subscriptions`/`payments` 변경은 service_role만
- [x] Storage 버킷 폴더 격리 (`auth.uid()::text` 기반)
- [x] 어드민 대시보드 별도 권한 검증
- [ ] API 호출 횟수 제한 (Rate Limiting) — Supabase Pro 자동 적용

## V5: 입력 검증, 인코딩, 위변조 방지

- [x] 모든 사용자 입력 escapeHtml 처리 (math/renderer, format-converter, document-diff)
- [x] CSP 헤더 적용 (`script-src 'self'`)
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] CORS 명시적 화이트리스트
- [x] SQL 인젝션 방지 (Supabase prepared statements)
- [x] XSS 방지 검토 완료
- [ ] CSRF 토큰 (Supabase Auth는 SameSite=Strict 쿠키로 대응)

## V6: 암호화

- [x] HTTPS/TLS 1.3 강제 (Supabase 기본)
- [x] 비밀번호 단방향 해싱 (bcrypt)
- [ ] 민감 정보 저장 시 추가 암호화 (AES-256, 필요 시)
- [ ] 키 회전 정책 (90일마다)

## V7: 오류 처리 및 로깅

- [x] 사용자에게 스택 트레이스 노출 안 함
- [x] 결제 실패 사유 한글화 (Toss 에러 코드 매핑)
- [x] 모든 결제 행위 `audit_logs` 기록
- [x] 모든 인증 이벤트 audit_logs 기록
- [ ] Sentry 등 에러 추적 도구 통합 (`VITE_SENTRY_DSN`)
- [ ] 로그 위변조 방지 (audit_logs는 service_role만 INSERT)

## V8: 데이터 보호

- [x] PII 자동 탐지 (AEGIS — 선택적 활성화)
- [x] 결제 카드 정보 직접 저장 안 함 (PG사가 처리)
- [x] 사용자 데이터 EU/Korea 데이터센터 (Supabase Seoul region)
- [x] GDPR/PIPA 데이터 다운로드 (Supabase Auth 기본 지원)
- [x] 계정 삭제 시 cascade DELETE (RLS 정책)
- [ ] 데이터 보존 기간 정책 (5년 후 자동 익명화)

## V9: 통신

- [x] HTTPS 강제 (HSTS 헤더 추가 권장)
- [x] CSP frame-ancestors 'none' (Edge Function CSP)
- [x] 보안 헤더 모두 적용 (X-Frame-Options 등)
- [ ] HSTS preload list 등록 (`https://hstspreload.org`)
- [ ] mTLS (Enterprise 플랜에서 옵션 제공)

## V10: 악성 코드

- [x] `npm audit` 정기 실행 (CI에 통합)
- [x] Dependabot/Renovate 활성화
- [x] CSP로 inline script 제한
- [ ] 외부 스크립트 SRI (Subresource Integrity) — JSZip CDN

## V11: 비즈니스 로직

- [x] 결제 멱등성 (`order_id` UNIQUE)
- [x] 중복 결제 방지 (이미 completed인 order는 거절)
- [x] 환불 시 플랜 자동 다운그레이드
- [x] AI 크레딧 월별 자동 리셋 (pg_cron)
- [x] 만료 구독 자동 처리 (`process-renewals`)
- [ ] 정기결제 실패 시 dunning (재시도 + 알림)

## V12: 파일 및 리소스

- [x] 업로드 파일 크기 제한 (100MB)
- [x] MIME 타입 화이트리스트 (8개 포맷)
- [x] HWP 매직바이트 8바이트 검증
- [x] Storage 폴더 격리
- [ ] 업로드 파일 바이러스 스캔 (ClamAV 또는 Cloudflare)

## V13: API

- [x] Edge Functions 인증 헤더 검증
- [x] 모든 mutating endpoint POST 메서드만 허용
- [x] CORS preflight 대응 (`handleCors`)
- [ ] OpenAPI 스펙 문서화

## V14: 설정

- [x] `.env` 파일 git 제외
- [x] Service Role Key 프론트엔드에 노출 안 함
- [x] 운영 환경에서 디버그 모드 비활성화 (`drop_console: true`)
- [x] 보안 헤더 운영/개발 동시 적용
- [ ] 정기적 의존성 업데이트 (월 1회)
- [ ] secrets rotation 정책 (분기 1회)

---

## 외부 보안 감사 권장 시점

다음 마일스톤 도달 시 외부 감사 신청:

1. **MAU 1,000명 도달 시** — 모의 침투 테스트 (1주일, 약 500만원)
2. **MAU 10,000명 도달 시** — 종합 보안 감사 (2~4주, 약 2,000만원)
3. **B2B 계약 추진 시** — ISMS 인증 (6개월, 약 5,000만원)
4. **글로벌 진출 시** — SOC 2 Type II (1년, 약 1억원)

### 권장 감사 기관

| 기관 | 특화 | 비용 (참고) |
|------|------|------------|
| 한국인터넷진흥원 (KISA) | ISMS 인증 | 정부 지원금 활용 가능 |
| 코니아랩 | 모의해킹 + 코드 감사 | 500만~5,000만원 |
| SK쉴더스 / 안랩 | 종합 보안 컨설팅 | 1,000만원~ |
| Bishop Fox / NCC Group | SOC 2 / 글로벌 | $50,000~ |

---

## 침해 사고 대응 계획 (Incident Response Plan)

### 1단계: 탐지 (Detection)
- Sentry 알림
- Supabase Logs 이상 패턴
- audit_logs 비정상 액션

### 2단계: 격리 (Containment)
```sql
-- 침해 의심 사용자 즉시 차단
UPDATE auth.users SET banned_until = NOW() + INTERVAL '90 days'
WHERE id IN ('...');

-- 의심 토큰 무효화
DELETE FROM auth.refresh_tokens WHERE user_id IN ('...');
```

### 3단계: 분석 (Investigation)
- audit_logs 추적
- payments 이상 거래 확인
- Edge Function logs 분석

### 4단계: 복구 (Recovery)
- 영향받은 비밀번호 강제 재설정
- 결제 환불 (필요 시)
- 데이터 백업 복원

### 5단계: 보고 (Notification)
- 한국 PIPA: 72시간 내 KISA 신고
- 영향받은 사용자 통보
- 언론 대응 (필요 시)

연락처:
- KISA 침해사고대응팀: 118 (24시간)
- 개인정보침해신고센터: privacy.kisa.or.kr
