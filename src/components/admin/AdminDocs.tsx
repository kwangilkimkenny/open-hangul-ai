/**
 * Admin Docs
 * 어드민 대시보드 — Reference > Docs 패널
 * 서비스 제공자 / 관리자용 종합 운영 문서
 */
import { useState } from 'react';

type DocSection =
  | 'overview'
  | 'architecture'
  | 'database'
  | 'auth'
  | 'payments'
  | 'webhooks'
  | 'cron'
  | 'email'
  | 'storage'
  | 'security'
  | 'legal'
  | 'monitoring'
  | 'api-reference'
  | 'deployment'
  | 'troubleshooting';

interface SectionMeta {
  id: DocSection;
  title: string;
  group: string;
  icon: string;
}

const SECTIONS: SectionMeta[] = [
  { id: 'overview', title: '시스템 개요', group: '시작하기', icon: '◆' },
  { id: 'architecture', title: '아키텍처', group: '시작하기', icon: '◇' },

  { id: 'database', title: '데이터베이스 스키마', group: '백엔드', icon: '▤' },
  { id: 'auth', title: '인증 & RLS', group: '백엔드', icon: '◉' },
  { id: 'storage', title: 'Storage 버킷', group: '백엔드', icon: '▣' },

  { id: 'payments', title: '결제 시스템', group: '결제', icon: '₩' },
  { id: 'webhooks', title: 'Webhook 핸들러', group: '결제', icon: '↻' },
  { id: 'cron', title: '정기결제 Cron', group: '결제', icon: '◷' },

  { id: 'email', title: '이메일 시스템 (Resend)', group: '운영', icon: '✉' },
  { id: 'monitoring', title: '모니터링 & 감사로그', group: '운영', icon: '◎' },
  { id: 'security', title: '보안 감사', group: '운영', icon: '⛨' },
  { id: 'legal', title: '법적 컴플라이언스', group: '운영', icon: '§' },

  { id: 'api-reference', title: 'API Reference', group: '레퍼런스', icon: '⌘' },
  { id: 'deployment', title: '배포 가이드', group: '레퍼런스', icon: '▲' },
  { id: 'troubleshooting', title: '트러블슈팅', group: '레퍼런스', icon: '?' },
];

export function AdminDocs() {
  const [active, setActive] = useState<DocSection>('overview');

  const groups = Array.from(new Set(SECTIONS.map(s => s.group)));

  return (
    <div className="admin-docs">
      <aside className="docs-sidebar">
        <div className="docs-search">
          <input type="text" placeholder="문서 검색..." disabled />
        </div>
        {groups.map(group => (
          <div key={group} className="docs-group">
            <div className="group-label">{group}</div>
            {SECTIONS.filter(s => s.group === group).map(s => (
              <button
                key={s.id}
                className={`doc-link ${active === s.id ? 'active' : ''}`}
                onClick={() => setActive(s.id)}
              >
                <span className="doc-icon">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="docs-content">
        {renderSection(active)}
      </main>

      <style>{`
        .admin-docs {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 24px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          min-height: 70vh;
        }
        .docs-sidebar {
          background: #f9fafb;
          border-right: 1px solid #e5e7eb;
          padding: 20px 0;
          overflow-y: auto;
          max-height: 80vh;
        }
        .docs-search {
          padding: 0 20px 16px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 12px;
        }
        .docs-search input {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 12px;
          background: #fff;
        }
        .docs-group { margin-bottom: 16px; }
        .group-label {
          padding: 6px 20px;
          font-size: 10px;
          font-weight: 700;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        .doc-link {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 20px;
          background: none;
          border: none;
          font-size: 13px;
          color: #4b5563;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
        }
        .doc-link:hover { background: #f3f4f6; color: #111; }
        .doc-link.active {
          background: #eff6ff;
          color: #2b579a;
          font-weight: 600;
          border-right: 3px solid #2b579a;
        }
        .doc-icon {
          width: 18px;
          text-align: center;
          color: #9ca3af;
          font-size: 13px;
        }
        .doc-link.active .doc-icon { color: #2b579a; }

        .docs-content {
          padding: 32px 40px;
          overflow-y: auto;
          max-height: 80vh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .docs-content h1 {
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 8px;
          color: #111;
          letter-spacing: -0.3px;
        }
        .docs-content > p:first-of-type {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid #f3f4f6;
        }
        .docs-content h2 {
          font-size: 18px;
          font-weight: 700;
          margin: 32px 0 12px;
          color: #111;
        }
        .docs-content h3 {
          font-size: 14px;
          font-weight: 700;
          margin: 20px 0 8px;
          color: #2b579a;
        }
        .docs-content p {
          font-size: 13px;
          line-height: 1.7;
          color: #4b5563;
          margin: 0 0 12px;
        }
        .docs-content ul, .docs-content ol {
          font-size: 13px;
          line-height: 1.8;
          color: #4b5563;
          padding-left: 20px;
          margin: 8px 0 16px;
        }
        .docs-content li { margin-bottom: 4px; }
        .docs-content code {
          background: #f3f4f6;
          padding: 1px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 12px;
          color: #1e3f73;
        }
        .docs-content pre {
          background: #1f2937;
          color: #e5e7eb;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 12px;
          line-height: 1.6;
          margin: 12px 0;
        }
        .docs-content pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .docs-content table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          margin: 12px 0;
        }
        .docs-content th {
          background: #f9fafb;
          padding: 8px 12px;
          text-align: left;
          font-weight: 700;
          color: #111;
          border-bottom: 2px solid #e5e7eb;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .docs-content td {
          padding: 8px 12px;
          border-bottom: 1px solid #f3f4f6;
          color: #4b5563;
        }
        .docs-content .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin: 16px 0;
          font-size: 12.5px;
          line-height: 1.6;
          border-left: 4px solid;
        }
        .alert.info { background: #eff6ff; color: #1e40af; border-color: #2b579a; }
        .alert.warn { background: #fff7ed; color: #9a3412; border-color: #f59e0b; }
        .alert.danger { background: #fef2f2; color: #991b1b; border-color: #ef4444; }
        .alert.success { background: #f0fdf4; color: #166534; border-color: #10b981; }
        .alert strong { display: block; margin-bottom: 4px; }
        .file-path {
          display: inline-block;
          background: #1e3f73;
          color: #fff;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Consolas', monospace;
          font-size: 11px;
        }
        @media (max-width: 968px) {
          .admin-docs { grid-template-columns: 1fr; }
          .docs-sidebar { max-height: none; border-right: none; border-bottom: 1px solid #e5e7eb; }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// 섹션별 콘텐츠 렌더링
// ============================================================

function renderSection(id: DocSection) {
  switch (id) {
    case 'overview': return <Overview />;
    case 'architecture': return <Architecture />;
    case 'database': return <DatabaseDocs />;
    case 'auth': return <AuthDocs />;
    case 'storage': return <StorageDocs />;
    case 'payments': return <PaymentsDocs />;
    case 'webhooks': return <WebhooksDocs />;
    case 'cron': return <CronDocs />;
    case 'email': return <EmailDocs />;
    case 'monitoring': return <MonitoringDocs />;
    case 'security': return <SecurityDocs />;
    case 'legal': return <LegalDocs />;
    case 'api-reference': return <ApiReference />;
    case 'deployment': return <DeploymentDocs />;
    case 'troubleshooting': return <Troubleshooting />;
    default: return null;
  }
}

// ===== 1. 시스템 개요 =====
function Overview() {
  return (
    <article>
      <h1>시스템 개요</h1>
      <p>오픈한글 AI v4.0 — AI 기반 멀티포맷 문서 편집 SaaS 플랫폼의 운영 가이드</p>

      <div className="alert info">
        <strong>현재 모드</strong>
        이 문서는 <code>VITE_SUPABASE_URL</code> 환경변수 설정 여부에 따라 데모/실서버 모드가 자동 전환되는 듀얼 모드 아키텍처를 전제로 합니다.
      </div>

      <h2>제품 개요</h2>
      <ul>
        <li><strong>지원 포맷</strong>: HWPX, DOCX, XLSX, PDF, PPTX, ODT, ODS, Markdown (9종)</li>
        <li><strong>핵심 기능</strong>: AI 편집, 변경 추적, 댓글, OCR, 수식 렌더링, 문서 비교</li>
        <li><strong>플랜</strong>: Free / Personal (월 9,900원) / Business (월 29,900원) / Enterprise (협의)</li>
        <li><strong>결제 수단</strong>: 토스페이먼츠 (카드/계좌이체/가상계좌) + 카카오페이</li>
      </ul>

      <h2>기술 스택</h2>
      <table>
        <thead><tr><th>레이어</th><th>기술</th></tr></thead>
        <tbody>
          <tr><td>프론트엔드</td><td>React 19 + TypeScript + Vite + Zustand</td></tr>
          <tr><td>편집기 코어</td><td>Vanilla JavaScript (HWPX 파서/렌더러)</td></tr>
          <tr><td>인증</td><td>Supabase Auth (JWT, bcrypt, 이메일 인증)</td></tr>
          <tr><td>데이터베이스</td><td>Supabase PostgreSQL + Row Level Security</td></tr>
          <tr><td>스토리지</td><td>Supabase Storage (S3 호환)</td></tr>
          <tr><td>백엔드 함수</td><td>Supabase Edge Functions (Deno)</td></tr>
          <tr><td>결제</td><td>Toss Payments + KakaoPay (서버 검증)</td></tr>
          <tr><td>이메일</td><td>Resend (트랜잭션 메일 6종)</td></tr>
          <tr><td>AI</td><td>OpenAI GPT-4 (서버 프록시)</td></tr>
        </tbody>
      </table>

      <h2>주요 환경변수</h2>
      <pre><code>{`# 프론트엔드 (.env)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_TOSS_CLIENT_KEY=live_ck_...

# Edge Functions Secrets (Supabase Dashboard)
TOSS_SECRET_KEY=live_sk_...
KAKAO_ADMIN_KEY=...
KAKAO_CID=TC0ONETIME
RESEND_API_KEY=re_...
EMAIL_FROM=OpenHangul AI <noreply@yourdomain.com>`}</code></pre>

      <h2>핵심 경로</h2>
      <table>
        <thead><tr><th>경로</th><th>역할</th></tr></thead>
        <tbody>
          <tr><td><code>/</code></td><td>랜딩페이지 (마케팅)</td></tr>
          <tr><td><code>/login</code> · <code>/signup</code></td><td>인증</td></tr>
          <tr><td><code>/pricing</code></td><td>요금제 + 결제 시작</td></tr>
          <tr><td><code>/payment/success|fail</code></td><td>결제 콜백</td></tr>
          <tr><td><code>/editor</code></td><td>편집기 (로그인 필수)</td></tr>
          <tr><td><code>/admin</code></td><td>어드민 대시보드 (Enterprise만)</td></tr>
          <tr><td><code>/legal/{`{terms|privacy|refund}`}</code></td><td>법적 페이지</td></tr>
        </tbody>
      </table>
    </article>
  );
}

// ===== 2. 아키텍처 =====
function Architecture() {
  return (
    <article>
      <h1>아키텍처</h1>
      <p>듀얼 모드 (데모/실서버) + 클라이언트-서버 분리 + 서버리스 백엔드</p>

      <h2>전체 데이터 흐름</h2>
      <pre><code>{`┌──────────────────┐         ┌─────────────────────┐
│  React Frontend  │────────▶│  Supabase           │
│  (Vite + TS)     │  HTTPS  │  - PostgreSQL       │
│                  │◀────────│  - Auth             │
│  - Zustand       │         │  - Storage          │
│  - React Router  │         │  - Edge Functions   │
└────────┬─────────┘         └──────────┬──────────┘
         │                              │
         │ payment redirect             │ secret_key
         ▼                              ▼
┌──────────────────┐         ┌─────────────────────┐
│  Toss / Kakao    │────────▶│  External APIs      │
│  결제창           │ webhook │  - Toss /v1/...     │
│                  │         │  - Kakao /v1/...    │
└──────────────────┘         │  - Resend /emails   │
                             │  - OpenAI /chat     │
                             └─────────────────────┘`}</code></pre>

      <h2>듀얼 모드 동작</h2>
      <p>모든 핵심 모듈은 <code>isSupabaseEnabled</code> 플래그로 자동 전환됩니다.</p>
      <pre><code>{`// src/lib/supabase/client.ts
export const isSupabaseEnabled = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('YOUR_PROJECT'),
);`}</code></pre>

      <table>
        <thead><tr><th>모드</th><th>인증</th><th>결제</th><th>저장소</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>데모</strong></td>
            <td>메모리 + localStorage</td>
            <td>시뮬레이션</td>
            <td>localStorage</td>
          </tr>
          <tr>
            <td><strong>실서버</strong></td>
            <td>Supabase Auth (JWT)</td>
            <td>Edge Function 서버 검증</td>
            <td>Supabase Storage</td>
          </tr>
        </tbody>
      </table>

      <h2>모듈 의존성</h2>
      <pre><code>{`src/
├── App.tsx                    # 라우팅 (React Router v7)
├── stores/
│   └── authStore.ts           # 듀얼 모드 인증 (Zustand + persist)
├── lib/
│   ├── supabase/
│   │   ├── client.ts          # 싱글톤 클라이언트
│   │   └── types.ts           # DB 타입 정의
│   └── payments/
│       ├── toss.ts            # 토스 SDK + Edge Function 호출
│       ├── kakao.ts           # 카카오페이 ready/approve
│       └── types.ts           # 공통 결제 타입
├── pages/                     # 라우트 컴포넌트
└── components/
    ├── ProtectedRoute.tsx     # 인증 가드
    ├── PaymentMethodModal.tsx # 결제 수단 선택
    └── public/                # 공통 헤더/푸터

supabase/
├── migrations/                # SQL 마이그레이션 3개
└── functions/                 # Edge Functions 8개`}</code></pre>
    </article>
  );
}

// ===== 3. 데이터베이스 =====
function DatabaseDocs() {
  return (
    <article>
      <h1>데이터베이스 스키마</h1>
      <p>5개 테이블 + RLS + 트리거 + Storage 버킷</p>

      <div className="alert info">
        <strong>마이그레이션 파일</strong>
        <code>supabase/migrations/20260411000001_initial_schema.sql</code><br/>
        <code>supabase/migrations/20260411000002_rls_policies.sql</code><br/>
        <code>supabase/migrations/20260411000003_pg_cron.sql</code>
      </div>

      <h2>테이블 목록</h2>
      <table>
        <thead><tr><th>테이블</th><th>역할</th><th>FK</th></tr></thead>
        <tbody>
          <tr><td><code>profiles</code></td><td>사용자 프로필 (auth.users 확장)</td><td>auth.users</td></tr>
          <tr><td><code>subscriptions</code></td><td>구독 정보 (정기결제)</td><td>profiles</td></tr>
          <tr><td><code>payments</code></td><td>결제 이력 (idempotency: order_id UNIQUE)</td><td>profiles, subscriptions</td></tr>
          <tr><td><code>documents</code></td><td>사용자 문서 메타데이터</td><td>profiles</td></tr>
          <tr><td><code>audit_logs</code></td><td>감사 로그 (보안/컴플라이언스)</td><td>profiles</td></tr>
        </tbody>
      </table>

      <h2>profiles 테이블</h2>
      <pre><code>{`CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'personal', 'business', 'enterprise')),
  plan_period TEXT CHECK (plan_period IN ('monthly', 'yearly')),
  plan_expires_at TIMESTAMPTZ,
  ai_credits_remaining INTEGER NOT NULL DEFAULT 50,
  ai_credits_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}</code></pre>

      <h3>자동 트리거</h3>
      <ul>
        <li><code>handle_new_user()</code>: auth.users INSERT 시 profiles 자동 생성</li>
        <li><code>set_updated_at()</code>: profiles, subscriptions, documents의 updated_at 자동 갱신</li>
      </ul>

      <h2>payments 테이블 (멱등성)</h2>
      <pre><code>{`CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  subscription_id UUID REFERENCES public.subscriptions(id),
  order_id TEXT UNIQUE NOT NULL,  -- ⚠️ 중복 결제 방지
  provider TEXT NOT NULL CHECK (provider IN ('toss', 'kakao')),
  provider_payment_id TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'KRW',
  status TEXT NOT NULL CHECK (status IN
    ('pending', 'completed', 'failed', 'refunded', 'canceled')),
  plan_id TEXT NOT NULL,
  plan_period TEXT NOT NULL,
  method TEXT NOT NULL,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}</code></pre>

      <h2>인덱스</h2>
      <pre><code>{`-- 빠른 조회를 위한 인덱스
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_plan ON profiles(plan);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_paid_at ON payments(paid_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);`}</code></pre>
    </article>
  );
}

// ===== 4. 인증 & RLS =====
function AuthDocs() {
  return (
    <article>
      <h1>인증 & Row Level Security</h1>
      <p>Supabase Auth + RLS 정책으로 사용자 데이터 격리</p>

      <h2>인증 흐름</h2>
      <ol>
        <li>회원가입: <code>supabase.auth.signUp({`{ email, password }`})</code></li>
        <li>이메일 인증 메일 자동 발송 (Supabase 기본)</li>
        <li>인증 완료 후 <code>auth.users</code> INSERT → 트리거가 <code>profiles</code> 자동 생성</li>
        <li>로그인: <code>signInWithPassword</code> → JWT access_token + refresh_token</li>
        <li>토큰 자동 갱신: <code>autoRefreshToken: true</code></li>
        <li>로그아웃: <code>signOut()</code> → 로컬 세션 + 서버 토큰 무효화</li>
      </ol>

      <h2>RLS 정책 요약</h2>
      <table>
        <thead><tr><th>테이블</th><th>SELECT</th><th>INSERT</th><th>UPDATE</th><th>DELETE</th></tr></thead>
        <tbody>
          <tr><td>profiles</td><td>본인만</td><td>차단 (트리거)</td><td>본인만</td><td>cascade</td></tr>
          <tr><td>subscriptions</td><td>본인만</td><td>service_role</td><td>service_role</td><td>service_role</td></tr>
          <tr><td>payments</td><td>본인만</td><td>service_role</td><td>service_role</td><td>service_role</td></tr>
          <tr><td>documents</td><td>본인만</td><td>본인만</td><td>본인만</td><td>본인만</td></tr>
          <tr><td>audit_logs</td><td>본인만</td><td>service_role</td><td>차단</td><td>차단</td></tr>
        </tbody>
      </table>

      <div className="alert warn">
        <strong>중요</strong>
        <code>subscriptions</code>, <code>payments</code>, <code>audit_logs</code>의 변경은 Edge Function (service_role)을 통해서만 가능합니다. 클라이언트가 직접 수정할 수 없습니다.
      </div>

      <h2>RLS 정책 예시</h2>
      <pre><code>{`-- profiles: 사용자는 자신의 프로필만 조회/수정
CREATE POLICY "사용자는 자신의 프로필 조회 가능"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "사용자는 자신의 프로필 수정 가능"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- documents: 사용자는 자신의 문서만 CRUD
CREATE POLICY "사용자는 자신의 문서 조회 가능"
  ON public.documents FOR SELECT
  USING (auth.uid() = user_id AND is_archived = false);`}</code></pre>

      <h2>듀얼 모드 인증 코드</h2>
      <p><code>src/stores/authStore.ts</code> — 환경변수 기반 자동 전환</p>
      <pre><code>{`login: async (email, password) => {
  if (isSupabaseEnabled) {
    // 실서버 모드
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password
    });
    // profile 조회 후 상태 업데이트
  } else {
    // 데모 모드 폴백
    const record = DEMO_USERS[email.toLowerCase()];
    if (record && record.password === password) {
      set({ user: record.user, isAuthenticated: true });
    }
  }
}`}</code></pre>
    </article>
  );
}

// ===== 5. Storage =====
function StorageDocs() {
  return (
    <article>
      <h1>Storage 버킷</h1>
      <p>사용자 문서를 안전하게 저장하는 폴더 격리 구조</p>

      <h2>버킷 설정</h2>
      <pre><code>{`INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,                    -- 비공개 (RLS 적용)
  104857600,                -- 100MB 제한
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
);`}</code></pre>

      <h2>폴더 격리 정책</h2>
      <p>각 사용자는 <code>{`{user_id}/`}</code> 폴더에만 접근 가능합니다.</p>
      <pre><code>{`-- 업로드 정책
CREATE POLICY "사용자는 자신의 폴더에 업로드 가능"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 조회 정책
CREATE POLICY "사용자는 자신의 파일만 조회 가능"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );`}</code></pre>

      <h2>파일 경로 규약</h2>
      <pre><code>{`documents/
└── {user_id}/                       # auth.uid()
    ├── 2026/04/                     # 년/월별 구조
    │   ├── proposal.hwpx
    │   └── report.docx
    └── archive/
        └── old-doc.pdf`}</code></pre>

      <h2>업로드 예시</h2>
      <pre><code>{`const { data, error } = await supabase.storage
  .from('documents')
  .upload(\`\${user.id}/\${year}/\${month}/\${filename}\`, file, {
    cacheControl: '3600',
    upsert: false,
  });`}</code></pre>
    </article>
  );
}

// ===== 6. 결제 시스템 =====
function PaymentsDocs() {
  return (
    <article>
      <h1>결제 시스템</h1>
      <p>토스페이먼츠 + 카카오페이 통합 — 서버 사이드 검증</p>

      <h2>결제 흐름</h2>
      <pre><code>{`1. 사용자: /pricing 페이지에서 플랜 선택
   ↓
2. PaymentMethodModal: 결제수단 선택 (토스 카드/이체/가상계좌, 카카오페이)
   ↓
3. 프론트엔드: orderId 생성 + sessionStorage에 메타 저장
   ↓
4. SDK 호출:
   - Toss: tossPayments.requestPayment('카드', {...})
   - Kakao: Edge Function 'kakao-ready' → next_redirect_pc_url 리다이렉트
   ↓
5. 사용자가 결제창에서 결제 진행
   ↓
6. successUrl 또는 failUrl로 리다이렉트
   ↓
7. /payment/success: Edge Function 호출하여 서버 검증
   - Toss: 'toss-confirm' (paymentKey, orderId, amount)
   - Kakao: 'kakao-approve' (tid, pgToken)
   ↓
8. Edge Function이 결제사 API 직접 호출 (Secret Key 사용)
   ↓
9. 검증 성공 시:
   - subscriptions 테이블에 INSERT
   - payments 테이블에 INSERT (status='completed')
   - profiles.plan 업데이트
   - audit_logs 자동 기록
   - 영수증 이메일 발송 (선택)`}</code></pre>

      <div className="alert danger">
        <strong>보안 핵심</strong>
        결제 confirm은 절대로 클라이언트에서 수행하지 않습니다. 모든 검증은 Edge Function에서 Secret Key로 결제사 API를 호출합니다.
      </div>

      <h2>토스페이먼츠 통합</h2>
      <p>파일: <span className="file-path">src/lib/payments/toss.ts</span></p>
      <p>SDK: <code>@tosspayments/payment-sdk</code></p>
      <ul>
        <li><code>requestTossCardPayment(req)</code> — 카드 결제</li>
        <li><code>requestTossTransferPayment(req)</code> — 계좌이체</li>
        <li><code>requestTossVirtualAccountPayment(req)</code> — 가상계좌 (24시간 유효)</li>
        <li><code>confirmTossPayment(paymentKey, orderId, amount, meta)</code> — Edge Function 호출</li>
      </ul>

      <h2>카카오페이 통합</h2>
      <p>파일: <span className="file-path">src/lib/payments/kakao.ts</span></p>
      <p>SDK 없음 — REST API + 리다이렉트 방식</p>
      <ul>
        <li><code>readyKakaoPayment(req)</code> — Edge Function <code>kakao-ready</code> 호출</li>
        <li><code>requestKakaoPayment(req)</code> — 결제 페이지로 리다이렉트</li>
        <li><code>approveKakaoPayment(tid, pgToken, ...)</code> — Edge Function <code>kakao-approve</code> 호출</li>
      </ul>

      <h2>주문 ID 형식</h2>
      <pre><code>{`HV-YYYYMMDD-XXXXXX
예: HV-20260411-A3B7C9

생성: src/lib/payments/types.ts
export function generateOrderId(): string {
  const now = new Date();
  const date = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return \`HV-\${date}-\${rand}\`;
}`}</code></pre>

      <h2>플랜별 가격</h2>
      <table>
        <thead><tr><th>플랜</th><th>월간</th><th>연간</th><th>AI 크레딧</th></tr></thead>
        <tbody>
          <tr><td>Free</td><td>₩0</td><td>₩0</td><td>50/월</td></tr>
          <tr><td>Personal</td><td>₩9,900</td><td>₩99,000 (17% 할인)</td><td>1,000/월</td></tr>
          <tr><td>Business</td><td>₩29,900</td><td>₩299,000</td><td>10,000/월</td></tr>
          <tr><td>Enterprise</td><td>문의</td><td>문의</td><td>무제한</td></tr>
        </tbody>
      </table>
    </article>
  );
}

// ===== 7. Webhook =====
function WebhooksDocs() {
  return (
    <article>
      <h1>Webhook 핸들러</h1>
      <p>결제사 비동기 이벤트 수신 — 가상계좌 입금, 환불, 정기결제 갱신</p>

      <h2>토스페이먼츠 Webhook</h2>
      <p>파일: <span className="file-path">supabase/functions/toss-webhook/index.ts</span></p>
      <p>등록 URL: <code>https://xxxxx.supabase.co/functions/v1/toss-webhook</code></p>

      <h3>지원 이벤트</h3>
      <table>
        <thead><tr><th>이벤트</th><th>처리</th></tr></thead>
        <tbody>
          <tr><td><code>PAYMENT.STATUS_CHANGED</code></td><td>결제 상태 변경 (DONE/CANCELED 등)</td></tr>
          <tr><td><code>VIRTUAL_ACCOUNT.STATUS_CHANGED</code></td><td>가상계좌 입금 완료 시 자동 활성화</td></tr>
        </tbody>
      </table>

      <h3>상태 매핑</h3>
      <pre><code>{`const statusMap = {
  DONE: 'completed',          // 결제 완료 (가상계좌 입금)
  CANCELED: 'canceled',       // 전체 취소
  PARTIAL_CANCELED: 'refunded', // 부분 환불
  ABORTED: 'failed',          // 결제 중단
  EXPIRED: 'failed',          // 만료
  WAITING_FOR_DEPOSIT: 'pending', // 입금 대기
};`}</code></pre>

      <div className="alert info">
        <strong>멱등성 보장</strong>
        같은 webhook이 여러 번 호출되어도 안전합니다. 이미 처리된 상태는 무시하고, 미존재 결제는 200 OK로 응답하여 재시도를 방지합니다.
      </div>

      <h2>카카오페이 Webhook</h2>
      <p>파일: <span className="file-path">supabase/functions/kakao-webhook/index.ts</span></p>

      <h3>지원 이벤트</h3>
      <ul>
        <li><code>subscription.renewed</code>: 정기결제 갱신 → 새 결제 기록 + 만료일 연장</li>
        <li><code>subscription.canceled</code>: 구독 해지 → status='canceled'</li>
        <li><code>payment.refunded</code>: 환불 → 플랜 자동 다운그레이드</li>
      </ul>

      <h2>Webhook 등록 절차</h2>
      <ol>
        <li>토스페이먼츠 개발자 센터 → 상점 정보 → 결제 알림 URL 등록</li>
        <li>카카오 비즈니스 → 카카오페이 → 알림 URL 등록</li>
        <li>Supabase Edge Function 배포: <code>supabase functions deploy toss-webhook</code></li>
        <li>로그 확인: Supabase Dashboard → Edge Functions → toss-webhook → Logs</li>
      </ol>
    </article>
  );
}

// ===== 8. Cron =====
function CronDocs() {
  return (
    <article>
      <h1>정기결제 Cron</h1>
      <p>pg_cron 기반 자동화 — 정기결제 갱신, 만료 처리, AI 크레딧 리셋</p>

      <h2>등록된 cron 작업</h2>
      <table>
        <thead><tr><th>작업명</th><th>스케줄</th><th>역할</th></tr></thead>
        <tbody>
          <tr><td><code>process-renewals-daily</code></td><td>매일 자정</td><td>정기결제 자동 갱신</td></tr>
          <tr><td><code>expire-pending-payments</code></td><td>매시간</td><td>24시간 미완료 pending 결제 → failed</td></tr>
          <tr><td><code>reset-ai-credits-monthly</code></td><td>매월 1일</td><td>AI 크레딧 플랜별 리셋</td></tr>
        </tbody>
      </table>

      <h2>process-renewals 동작</h2>
      <p>파일: <span className="file-path">supabase/functions/process-renewals/index.ts</span></p>
      <ol>
        <li>이미 만료된 active 구독 조회 → status='canceled', 플랜='free'</li>
        <li>24시간 이내 만료 예정 active 구독 조회</li>
        <li>각 구독에 대해 결제사 정기결제 API 호출
          <ul>
            <li>Toss: <code>POST /v1/billing/{`{billingKey}`}</code></li>
            <li>Kakao: <code>POST /v1/payment/subscription</code></li>
          </ul>
        </li>
        <li>성공 시: subscription 만료일 연장 + payments 기록 + 영수증 이메일</li>
        <li>실패 시: status='past_due' + 알림 (실패 카운터 증가 → 3회 후 해지)</li>
      </ol>

      <h2>pg_cron 등록</h2>
      <pre><code>{`-- Supabase Dashboard SQL Editor에서 실행
SELECT cron.schedule(
  'process-renewals-daily',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-renewals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      )
    );
  $$
);`}</code></pre>

      <h2>cron 작업 관리</h2>
      <pre><code>{`-- 등록된 작업 조회
SELECT * FROM cron.job;

-- 실행 이력 조회
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- 작업 일시 정지
SELECT cron.unschedule('process-renewals-daily');

-- 수동 실행 (테스트)
SELECT net.http_post(
  url := 'https://xxxxx.supabase.co/functions/v1/process-renewals',
  headers := '{"Authorization": "Bearer ..."}'::jsonb
);`}</code></pre>

      <div className="alert warn">
        <strong>주의</strong>
        cron은 Supabase Pro 플랜 이상에서만 사용 가능합니다. 무료 플랜에서는 외부 cron 서비스 (cron-job.org 등)로 대체할 수 있습니다.
      </div>
    </article>
  );
}

// ===== 9. 이메일 =====
function EmailDocs() {
  return (
    <article>
      <h1>이메일 시스템 (Resend)</h1>
      <p>트랜잭션 이메일 6종 — 회원가입, 비밀번호 재설정, 영수증, 알림</p>

      <h2>이메일 템플릿</h2>
      <table>
        <thead><tr><th>템플릿</th><th>발송 시점</th><th>주요 데이터</th></tr></thead>
        <tbody>
          <tr><td><code>welcome</code></td><td>회원가입 직후</td><td>name, editorUrl</td></tr>
          <tr><td><code>password_reset</code></td><td>재설정 요청 시</td><td>resetUrl</td></tr>
          <tr><td><code>payment_receipt</code></td><td>결제 완료 시</td><td>orderId, planName, amount, method, paidAt</td></tr>
          <tr><td><code>plan_changed</code></td><td>플랜 변경 시</td><td>oldPlan, newPlan</td></tr>
          <tr><td><code>subscription_renewal</code></td><td>정기결제 갱신 시</td><td>planName, amount, nextBillingDate</td></tr>
          <tr><td><code>subscription_canceled</code></td><td>구독 해지 시</td><td>expiresAt</td></tr>
        </tbody>
      </table>

      <h2>호출 방법</h2>
      <pre><code>{`// 프론트엔드에서 호출
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    template: 'payment_receipt',
    to: user.email,
    data: {
      name: user.name,
      orderId: 'HV-20260411-A3B7C9',
      planName: 'Personal',
      period: 'monthly',
      amount: 9900,
      method: '카드',
      paidAt: new Date().toISOString(),
      receiptUrl: 'https://...',
    }
  }
});`}</code></pre>

      <h2>Resend 설정</h2>
      <ol>
        <li>https://resend.com 가입</li>
        <li>Domains 메뉴에서 도메인 추가</li>
        <li>DNS TXT 레코드 등록 (SPF/DKIM)</li>
        <li>API Keys에서 새 키 발급</li>
        <li>Supabase Functions Secrets에 등록:
          <pre><code>{`supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM="OpenHangul AI <noreply@yourdomain.com>"`}</code></pre>
        </li>
      </ol>

      <h2>발송 권한 검증</h2>
      <div className="alert warn">
        <strong>보안</strong>
        send-email Edge Function은 인증된 사용자가 자신의 이메일 주소로만 발송할 수 있도록 검증합니다. 다른 사용자에게 보낼 수 없습니다.
      </div>
      <pre><code>{`// supabase/functions/send-email/index.ts
if (user.email !== to) {
  return jsonResponse({ error: '권한 없음' }, 403);
}`}</code></pre>

      <h2>한글 이메일 최적화</h2>
      <ul>
        <li>HTML 템플릿: <code>font-family: -apple-system, 'Malgun Gothic', sans-serif</code></li>
        <li>charset: UTF-8 명시</li>
        <li>한국 시간 (KST) 표시: <code>toLocaleString('ko-KR')</code></li>
        <li>금액 포맷: <code>₩{`{amount.toLocaleString()}`}</code></li>
      </ul>
    </article>
  );
}

// ===== 10. 모니터링 =====
function MonitoringDocs() {
  return (
    <article>
      <h1>모니터링 & 감사로그</h1>
      <p>운영 가시성 — audit_logs + 어드민 대시보드 + 외부 모니터링</p>

      <h2>audit_logs 활용</h2>
      <p>모든 결제, 인증, 구독 이벤트는 자동으로 <code>audit_logs</code>에 기록됩니다.</p>

      <h3>주요 액션</h3>
      <table>
        <thead><tr><th>액션</th><th>발생 시점</th></tr></thead>
        <tbody>
          <tr><td><code>payment.completed</code></td><td>결제 완료</td></tr>
          <tr><td><code>subscription.renewed</code></td><td>정기결제 갱신</td></tr>
          <tr><td><code>subscription.expired</code></td><td>구독 만료</td></tr>
          <tr><td><code>subscription.renewal_failed</code></td><td>갱신 실패</td></tr>
          <tr><td><code>webhook.toss.done</code></td><td>토스 webhook 수신</td></tr>
          <tr><td><code>webhook.kakao.subscription.renewed</code></td><td>카카오 webhook 수신</td></tr>
        </tbody>
      </table>

      <h2>유용한 SQL 쿼리</h2>

      <h3>일일 매출</h3>
      <pre><code>{`SELECT
  DATE(paid_at) AS date,
  SUM(amount) AS total_revenue,
  COUNT(*) AS transaction_count
FROM payments
WHERE status = 'completed'
  AND paid_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(paid_at)
ORDER BY date DESC;`}</code></pre>

      <h3>플랜별 활성 사용자 수</h3>
      <pre><code>{`SELECT plan, COUNT(*) AS user_count
FROM profiles
GROUP BY plan
ORDER BY
  CASE plan
    WHEN 'enterprise' THEN 1
    WHEN 'business' THEN 2
    WHEN 'personal' THEN 3
    WHEN 'free' THEN 4
  END;`}</code></pre>

      <h3>이탈 위험 사용자 (30일 미접속)</h3>
      <pre><code>{`SELECT p.email, p.plan, MAX(a.created_at) AS last_activity
FROM profiles p
LEFT JOIN audit_logs a ON a.user_id = p.id
WHERE p.plan != 'free'
GROUP BY p.id, p.email, p.plan
HAVING MAX(a.created_at) < NOW() - INTERVAL '30 days'
ORDER BY last_activity ASC;`}</code></pre>

      <h3>결제 실패 추적</h3>
      <pre><code>{`SELECT order_id, user_id, amount, plan_id, metadata->>'error' AS error
FROM payments
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;`}</code></pre>

      <h2>외부 모니터링 권장 도구</h2>
      <table>
        <thead><tr><th>도구</th><th>역할</th><th>비용</th></tr></thead>
        <tbody>
          <tr><td>Sentry</td><td>프론트엔드 에러 추적</td><td>무료 ~ $26/월</td></tr>
          <tr><td>Better Stack Uptime</td><td>업타임 모니터링 + 알림</td><td>무료 ~ $24/월</td></tr>
          <tr><td>PostHog</td><td>사용자 행동 분석</td><td>무료 ~ $450/월</td></tr>
          <tr><td>Plausible</td><td>경량 분석 (GDPR 친화)</td><td>$9/월</td></tr>
        </tbody>
      </table>
    </article>
  );
}

// ===== 11. 보안 =====
function SecurityDocs() {
  return (
    <article>
      <h1>보안 감사</h1>
      <p>OWASP ASVS Level 2 기준 + 자동 점검 스크립트</p>

      <h2>자동 점검 실행</h2>
      <pre><code>{`npm run security:check`}</code></pre>

      <h3>점검 항목 (9개)</h3>
      <ol>
        <li>npm audit (취약점)</li>
        <li>하드코딩 시크릿 (OpenAI/Stripe/Toss/AWS/JWT)</li>
        <li>eval/new Function 사용</li>
        <li>innerHTML 직접 할당 (XSS)</li>
        <li>보안 헤더 (X-Frame-Options 등)</li>
        <li>.env gitignore 보호</li>
        <li>Edge Functions 인증 검증</li>
        <li>RLS 정책 5개 테이블</li>
        <li>HTTP URL (Mixed Content)</li>
      </ol>

      <h2>주요 보안 조치</h2>

      <h3>1. 결제 보안</h3>
      <ul>
        <li>모든 confirm은 Edge Function에서 Secret Key로 수행</li>
        <li>order_id UNIQUE 제약으로 중복 결제 차단</li>
        <li>금액 위변조 방지 (서버에서 amount 재검증)</li>
      </ul>

      <h3>2. 인증 보안</h3>
      <ul>
        <li>bcrypt 해싱 (Supabase Auth 자동)</li>
        <li>JWT 토큰 자동 갱신 + httpOnly 쿠키</li>
        <li>이메일 인증 후 로그인 활성화</li>
      </ul>

      <h3>3. 데이터 보안</h3>
      <ul>
        <li>Row Level Security 모든 테이블 적용</li>
        <li>Storage 폴더 격리 (auth.uid 기반)</li>
        <li>service_role 키 절대 프론트엔드 노출 금지</li>
      </ul>

      <h3>4. 통신 보안</h3>
      <ul>
        <li>HTTPS/TLS 1.3 강제 (Supabase 기본)</li>
        <li>CSP 헤더 (script-src 'self')</li>
        <li>X-Frame-Options: DENY (clickjacking 방지)</li>
        <li>worker-src blob: (CSP fix)</li>
      </ul>

      <h2>침해 사고 대응</h2>
      <p>상세 가이드: <span className="file-path">SECURITY_AUDIT.md</span></p>
      <ol>
        <li><strong>탐지</strong>: Sentry 알림, Supabase Logs 이상 패턴, audit_logs 비정상 액션</li>
        <li><strong>격리</strong>: 침해 의심 사용자 즉시 차단 (auth.users.banned_until)</li>
        <li><strong>분석</strong>: audit_logs 추적, payments 이상 거래, Edge Function logs</li>
        <li><strong>복구</strong>: 비밀번호 강제 재설정, 결제 환불, 백업 복원</li>
        <li><strong>보고</strong>: 한국 PIPA 72시간 내 KISA 신고</li>
      </ol>

      <div className="alert danger">
        <strong>비상 연락처</strong>
        KISA 침해사고대응팀: 118 (24시간 운영)<br/>
        개인정보침해신고센터: privacy.kisa.or.kr
      </div>
    </article>
  );
}

// ===== 12. 법적 컴플라이언스 =====
function LegalDocs() {
  return (
    <article>
      <h1>법적 컴플라이언스</h1>
      <p>한국 PIPA + GDPR + 전자상거래법 준수 사항</p>

      <h2>법적 페이지 (3종)</h2>
      <table>
        <thead><tr><th>경로</th><th>내용</th><th>법적 근거</th></tr></thead>
        <tbody>
          <tr><td><code>/legal/terms</code></td><td>이용약관 (9조)</td><td>전자상거래법 제13조</td></tr>
          <tr><td><code>/legal/privacy</code></td><td>개인정보처리방침 (8항)</td><td>PIPA 제30조</td></tr>
          <tr><td><code>/legal/refund</code></td><td>환불정책 (7섹션)</td><td>전자상거래법 제17조</td></tr>
        </tbody>
      </table>

      <h2>쿠키 동의 (Cookie Consent)</h2>
      <p>파일: <span className="file-path">src/components/CookieConsent.tsx</span></p>
      <p>3가지 카테고리 분리 동의 — GDPR + 한국 PIPA 요건 충족</p>
      <ul>
        <li><strong>필수 쿠키</strong>: 로그인, 보안 (변경 불가)</li>
        <li><strong>분석 쿠키</strong>: GA, PostHog (선택)</li>
        <li><strong>마케팅 쿠키</strong>: 광고, 리타게팅 (선택)</li>
      </ul>

      <h2>개인정보 수집 항목</h2>
      <table>
        <thead><tr><th>항목</th><th>구분</th><th>수집 시점</th><th>보유 기간</th></tr></thead>
        <tbody>
          <tr><td>이메일</td><td>필수</td><td>회원가입</td><td>탈퇴 시까지</td></tr>
          <tr><td>비밀번호 (해시)</td><td>필수</td><td>회원가입</td><td>탈퇴 시까지</td></tr>
          <tr><td>이름</td><td>필수</td><td>회원가입</td><td>탈퇴 시까지</td></tr>
          <tr><td>IP 주소</td><td>자동</td><td>로그인</td><td>3개월 (통신비밀보호법)</td></tr>
          <tr><td>결제 내역</td><td>거래</td><td>결제 시</td><td>5년 (전자상거래법)</td></tr>
        </tbody>
      </table>

      <h2>GDPR/PIPA 권리 행사</h2>
      <p>사용자는 다음 권리를 행사할 수 있습니다 (Edge Function 또는 직접 SQL):</p>

      <h3>1. 데이터 다운로드 (Article 15)</h3>
      <pre><code>{`-- 사용자 데이터 전체 export
SELECT
  (SELECT row_to_json(p) FROM profiles p WHERE id = 'USER_ID') AS profile,
  (SELECT json_agg(s) FROM subscriptions s WHERE user_id = 'USER_ID') AS subscriptions,
  (SELECT json_agg(pay) FROM payments pay WHERE user_id = 'USER_ID') AS payments,
  (SELECT json_agg(d) FROM documents d WHERE user_id = 'USER_ID') AS documents;`}</code></pre>

      <h3>2. 계정 삭제 (Article 17)</h3>
      <pre><code>{`-- auth.users 삭제 → CASCADE로 모든 관련 데이터 삭제
DELETE FROM auth.users WHERE id = 'USER_ID';`}</code></pre>

      <h3>3. 계정 처리 동결 (Article 18)</h3>
      <pre><code>{`UPDATE auth.users
SET banned_until = NOW() + INTERVAL '30 days'
WHERE id = 'USER_ID';`}</code></pre>

      <div className="alert info">
        <strong>개인정보 보호책임자</strong>
        이메일: privacy@hanview.ai<br/>
        응답 의무: 영업일 기준 10일 이내 (PIPA 제35조)
      </div>
    </article>
  );
}

// ===== 13. API Reference =====
function ApiReference() {
  return (
    <article>
      <h1>API Reference</h1>
      <p>Edge Functions 8종 + 결제 API 엔드포인트</p>

      <h2>Edge Functions</h2>

      <h3>POST /functions/v1/toss-confirm</h3>
      <p>토스페이먼츠 결제 승인 (서버 검증)</p>
      <pre><code>{`// 요청
{
  "paymentKey": "string",
  "orderId": "string",
  "amount": 9900,
  "planId": "personal",
  "planName": "Personal",
  "period": "monthly"
}

// 응답 (성공)
{
  "success": true,
  "orderId": "HV-20260411-A3B7C9",
  "planId": "personal",
  "receiptUrl": "https://...",
  "approvedAt": "2026-04-11T..."
}

// 응답 (실패)
{ "error": "결제 승인 실패", "code": "..." }`}</code></pre>

      <h3>POST /functions/v1/kakao-ready</h3>
      <p>카카오페이 결제 준비</p>
      <pre><code>{`// 요청
{
  "orderId": "string",
  "orderName": "string",
  "amount": 9900,
  "planId": "personal",
  "period": "monthly",
  "successUrl": "https://...",
  "failUrl": "https://..."
}

// 응답
{
  "tid": "T1234...",
  "next_redirect_pc_url": "https://kakaopay.com/...",
  "next_redirect_mobile_url": "...",
  "created_at": "..."
}`}</code></pre>

      <h3>POST /functions/v1/kakao-approve</h3>
      <p>카카오페이 결제 승인</p>
      <pre><code>{`// 요청
{
  "tid": "string",
  "pgToken": "string",
  "orderId": "string",
  "planId": "personal",
  "planName": "Personal",
  "period": "monthly",
  "amount": 9900
}`}</code></pre>

      <h3>POST /functions/v1/toss-webhook</h3>
      <p>토스페이먼츠 webhook 수신 (인증 불필요 — 결제사가 직접 호출)</p>

      <h3>POST /functions/v1/kakao-webhook</h3>
      <p>카카오페이 webhook 수신</p>

      <h3>POST /functions/v1/process-renewals</h3>
      <p>정기결제 cron (service_role 인증 필수)</p>
      <pre><code>{`// 호출 (cron 또는 수동)
curl -X POST https://xxxxx.supabase.co/functions/v1/process-renewals \\
  -H "Authorization: Bearer SERVICE_ROLE_KEY"

// 응답
{
  "ok": true,
  "processed": 12,
  "renewed": 10,
  "failed": 2,
  "expired": 5,
  "runAt": "2026-04-11T00:00:00Z"
}`}</code></pre>

      <h3>POST /functions/v1/send-email</h3>
      <p>이메일 발송 (사용자 본인만)</p>
      <pre><code>{`// 요청
{
  "template": "payment_receipt",
  "to": "user@example.com",
  "data": { ... }
}`}</code></pre>

      <h2>Supabase Client API</h2>
      <pre><code>{`// 인증
await supabase.auth.signUp({ email, password, options: { data: { name } } });
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signOut();
await supabase.auth.resetPasswordForEmail(email, { redirectTo });

// 데이터 조회
const { data } = await supabase
  .from('payments')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(10);

// Storage
await supabase.storage
  .from('documents')
  .upload(\`\${userId}/\${filename}\`, file);

// Edge Function 호출
await supabase.functions.invoke('toss-confirm', { body: {...} });`}</code></pre>
    </article>
  );
}

// ===== 14. 배포 가이드 =====
function DeploymentDocs() {
  return (
    <article>
      <h1>배포 가이드</h1>
      <p>전체 가이드: <span className="file-path">SUPABASE_SETUP.md</span></p>

      <h2>11단계 운영 전환</h2>
      <ol>
        <li>Supabase 프로젝트 생성 (Seoul 리전)</li>
        <li>마이그레이션 SQL 3개 실행 (SQL Editor)</li>
        <li>환경변수 설정 (.env + Edge Functions Secrets)</li>
        <li>Edge Functions 배포 (8개)</li>
        <li>결제 게이트웨이 가맹 신청 (Toss/Kakao)</li>
        <li>Resend 도메인 인증 (DNS TXT)</li>
        <li>Storage 버킷 + CORS 설정</li>
        <li>동작 확인 (인증/결제/이메일)</li>
        <li>pg_cron 등록 (정기결제)</li>
        <li>모니터링 설정 (Sentry/Better Stack)</li>
        <li>법무 검토 (약관/개인정보)</li>
      </ol>

      <h2>Edge Functions 배포</h2>
      <pre><code>{`# Supabase CLI 설치
npm install -g supabase

# 로그인 + 프로젝트 연결
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# 일괄 배포
supabase functions deploy toss-confirm
supabase functions deploy kakao-ready
supabase functions deploy kakao-approve
supabase functions deploy toss-webhook
supabase functions deploy kakao-webhook
supabase functions deploy process-renewals
supabase functions deploy send-email

# 마이그레이션 실행
supabase db push

# Secrets 등록
supabase secrets set TOSS_SECRET_KEY=live_sk_...
supabase secrets set KAKAO_ADMIN_KEY=...
supabase secrets set RESEND_API_KEY=re_...`}</code></pre>

      <h2>프론트엔드 배포 옵션</h2>
      <table>
        <thead><tr><th>플랫폼</th><th>장점</th><th>비용</th></tr></thead>
        <tbody>
          <tr><td>Vercel</td><td>Vite 자동 인식, Edge Network</td><td>무료 ~ $20/월</td></tr>
          <tr><td>Cloudflare Pages</td><td>무제한 대역폭, 글로벌 CDN</td><td>무료</td></tr>
          <tr><td>Netlify</td><td>간편 배포</td><td>무료 ~ $19/월</td></tr>
          <tr><td>GitHub Pages</td><td>무료, 정적</td><td>무료</td></tr>
        </tbody>
      </table>

      <h2>운영 비용 예측 (월)</h2>
      <table>
        <thead><tr><th>서비스</th><th>1,000 MAU</th><th>10,000 MAU</th></tr></thead>
        <tbody>
          <tr><td>Supabase Pro</td><td>$25</td><td>$25 + 추가</td></tr>
          <tr><td>Resend</td><td>$20</td><td>$80</td></tr>
          <tr><td>Vercel Pro</td><td>$20</td><td>$20</td></tr>
          <tr><td>도메인</td><td>$1</td><td>$1</td></tr>
          <tr><td>OpenAI API</td><td>~$50</td><td>~$500</td></tr>
          <tr><td>결제 수수료</td><td>매출 2.5~3.3%</td><td>매출 2.5~3.3%</td></tr>
          <tr><td><strong>합계</strong></td><td><strong>~$120 + 수수료</strong></td><td><strong>~$650 + 수수료</strong></td></tr>
        </tbody>
      </table>
    </article>
  );
}

// ===== 15. 트러블슈팅 =====
function Troubleshooting() {
  return (
    <article>
      <h1>트러블슈팅</h1>
      <p>자주 발생하는 문제와 해결 방법</p>

      <h2>인증 관련</h2>

      <h3>이메일 인증 메일이 오지 않음</h3>
      <ul>
        <li>Supabase Dashboard → Authentication → Email Templates 확인</li>
        <li>Auth → URL Configuration → Site URL 정확히 등록</li>
        <li>이메일 제공자가 Supabase 기본 SMTP를 차단할 수 있음 → Resend SMTP로 교체</li>
        <li>스팸 폴더 확인 안내</li>
      </ul>

      <h3>로그인 후 즉시 로그아웃됨</h3>
      <ul>
        <li>localStorage가 차단된 환경 (incognito) 확인</li>
        <li>토큰 만료 시간 확인 (Supabase Dashboard → Auth → JWT Settings)</li>
        <li><code>autoRefreshToken: true</code> 확인</li>
      </ul>

      <h2>결제 관련</h2>

      <h3>결제 후 플랜이 반영되지 않음</h3>
      <ol>
        <li>Edge Functions Logs 확인 (Dashboard → Edge Functions → toss-confirm → Logs)</li>
        <li>payments 테이블 직접 조회: <code>SELECT * FROM payments WHERE order_id = '...'</code></li>
        <li>subscriptions 생성 여부 확인</li>
        <li>profiles.plan 직접 업데이트로 임시 복구 가능</li>
      </ol>

      <h3>중복 결제 발생</h3>
      <p>order_id UNIQUE 제약이 있어 발생할 수 없습니다. 만약 발생했다면 두 다른 order_id로 결제된 것이며 webhook으로 한쪽 환불 처리.</p>

      <h3>가상계좌 입금 후 활성화 안 됨</h3>
      <ul>
        <li>토스 webhook URL이 올바르게 등록되었는지 확인</li>
        <li>VIRTUAL_ACCOUNT.STATUS_CHANGED 이벤트 구독 여부</li>
        <li>Edge Function logs에 webhook 호출 기록 확인</li>
      </ul>

      <h2>이메일 관련</h2>

      <h3>이메일이 발송되지 않음</h3>
      <ul>
        <li>Resend Domain 인증 상태 확인 (DNS 전파 최대 48시간)</li>
        <li>Resend Dashboard → Logs 에서 발송 시도 확인</li>
        <li>Bounces / Spam 폴더 확인</li>
        <li>EMAIL_FROM 도메인이 인증된 도메인과 일치하는지</li>
      </ul>

      <h2>RLS 관련</h2>

      <h3>"Permission denied" 오류</h3>
      <ul>
        <li>해당 테이블의 RLS 정책 확인</li>
        <li>auth.uid()가 NULL이 아닌지 (로그인 상태)</li>
        <li>service_role을 사용하면 RLS가 우회되므로 백엔드 작업은 service_role로</li>
      </ul>

      <h2>Storage 관련</h2>

      <h3>파일 업로드 실패</h3>
      <ul>
        <li>파일 크기 100MB 초과 여부</li>
        <li>MIME 타입이 허용된 8개 타입에 포함되는지</li>
        <li>경로가 <code>{`{user_id}/`}</code>로 시작하는지 (RLS)</li>
      </ul>

      <h2>cron 관련</h2>

      <h3>cron 작업이 실행되지 않음</h3>
      <pre><code>{`-- 등록 확인
SELECT * FROM cron.job;

-- 실행 이력
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 10;

-- 실패한 작업 확인
SELECT * FROM cron.job_run_details
WHERE status = 'failed';`}</code></pre>

      <h2>긴급 복구</h2>

      <h3>전체 환불이 필요한 경우</h3>
      <pre><code>{`-- 1. 영향받은 결제 식별
SELECT * FROM payments
WHERE created_at > '2026-04-11 00:00:00'
  AND status = 'completed';

-- 2. 토스 환불 API 호출 (Edge Function 또는 수동)
-- POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
-- Body: { "cancelReason": "시스템 오류" }

-- 3. payments 테이블 업데이트
UPDATE payments
SET status = 'refunded', refunded_at = NOW()
WHERE order_id = '...';

-- 4. 사용자 플랜 다운그레이드
UPDATE profiles
SET plan = 'free', plan_period = NULL, plan_expires_at = NULL
WHERE id IN (SELECT user_id FROM payments WHERE order_id = '...');`}</code></pre>

      <div className="alert info">
        <strong>지원 채널</strong>
        기술 지원: support@hanview.ai<br/>
        보안 신고: security@hanview.ai<br/>
        긴급 (24시간): +82-XXX-XXXX-XXXX
      </div>
    </article>
  );
}

export default AdminDocs;
