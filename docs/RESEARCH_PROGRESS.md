# 오픈한글AI(Open Hangul AI) — 연구개발 진행현황 종합 보고서

> **문서 작성일:** 2026-05-16
> **현재 버전:** v5.0.5 (npm 패키지) · 내부 코어 v2.1.0
> **운영 주체:** YATAV (yatav@yatavent.com)
> **저장소:** https://github.com/kwangilkimkenny/open-hangul-ai
> **라이선스:** MIT
> **연구 기간:** 2025년 ~ 2026-04 (총 189개 커밋)

---

## 0. 임원 요약 (Executive Summary)

오픈한글AI는 한컴오피스의 표준 문서 포맷인 **HWPX**를 브라우저에서 직접 파싱·렌더링·편집·저장할 수 있는 **세계 최초의 본격적인 오픈소스 React 라이브러리**다. 한컴 한글 라이선스가 없어도 한국 정부·법무·교육 문서를 처리할 수 있는 차세대 웹 에디터를 목표로 한다.

본 연구는 다음 5개 핵심 축에서 진행되었다:

1. **문서 처리 엔진** — HWPX/HWP/PDF/DOCX/XLSX/PPTX/ODF/Markdown 등 9개 포맷 단일 컴포넌트 지원
2. **AI 문서 인텔리전스** — 7개 LLM Provider(OpenAI · Claude · Gemini · Grok · Azure · Cohere · Local) 통합, 구조 보존 편집·생성·요약·번역
3. **보안·신뢰성 레이어** — AEGIS(프롬프트 인젝션·PII 보호) + TruthAnchor(할루시네이션 검증) + 다중 컴플라이언스(EU AI Act · K-AI Act · NIST AI RMF · OWASP LLM Top 10) + Zero-Width 워터마크
4. **사업화 인프라** — Supabase 풀스택(Auth/DB/Edge Functions) + Toss/KakaoPay 결제 + 정기결제 cron + 어드민 대시보드
5. **품질·운영** — 1,168개 단위 테스트 통과 + Playwright E2E 매트릭스(Chromium/Firefox/WebKit/Mobile) + GitHub Actions 5개 워크플로우 CI/CD + Docker 배포

코드 규모는 **소스 267개 모듈 / 약 122,000 라인**, 테스트 86개 파일이며, **npm 패키지 `open-hangul-ai@5.0.5`**로 공개 배포 중이다.

---

## 1. 프로젝트 개요

### 1.1 연구 배경 및 동기

- **HWPX 포맷의 폐쇄성**: 한국 공공·법무·교육 문서는 HWPX가 표준이지만 웹 환경에서 직접 다루는 오픈소스 솔루션이 사실상 부재.
- **AI-친화 문서 처리의 필요**: 한컴 한글에 종속된 워크플로우는 AI 시대의 자동화·구조화·RAG에 적합하지 않음.
- **한국어 문서 AI의 안전성**: 한국어 환경에서 PII 보호·할루시네이션 차단·규제 컴플라이언스를 모두 만족하는 도구 부재.

### 1.2 핵심 가치 제안

| 가치 | 설명 |
|------|------|
| **🇰🇷 한글 네이티브** | HWPX/HWP 직접 파싱·렌더링·저장 (변환 단계 불필요) |
| **📄 멀티 포맷** | 9개 포맷을 단일 React 컴포넌트로 통합 처리 |
| **🤖 AI 통합** | 7개 LLM 공급자 추상화, 구조 보존 편집·장문 초안 생성 |
| **🔒 프라이버시** | 파싱·편집은 클라이언트 측 100% 수행, 외부 전송 없음 |
| **⚛️ React 친화** | peer dependency가 React 18+만, TypeScript 정의 완비 |
| **🪶 경량 번들** | manualChunks 코드 스플리팅 (-38% 초기 로드) |

### 1.3 라이선스 정책 진화

- **2025-12 ~ 2026-04 초:** Dual License(MIT + Commercial) 모델 검토
- **2026-04-19 이후:** 순수 **MIT License**로 완전 전환, 모든 상업용 잔재 제거(`packages-aegis/`, `TruthAnchor-core/` git history 완전 삭제)
- **현재:** 오픈소스 정합성 100% 확보 (Apr 20 ~ 22 다수의 정리 커밋)

---

## 2. 시스템 아키텍처

### 2.1 모듈 계층 구조

```
open-hangul-ai/
├── src/                              # 메인 소스 (267 modules / ~122k LOC)
│   ├── components/                   # React 컴포넌트 (40+개)
│   ├── pages/                        # 라우팅 페이지 (9개)
│   ├── contexts/ · hooks/ · stores/  # 상태 관리 (Zustand + React Context)
│   ├── lib/
│   │   ├── core/                     # parser.ts (HWPX 코어 파서)
│   │   ├── vanilla/                  # 프레임워크 독립 코어 엔진
│   │   │   ├── core/                 # constants/parser/renderer + canvas-editor 변환기
│   │   │   ├── renderers/            # paragraph/table/shape/image/container
│   │   │   ├── command/              # 12개 전문 Command 모듈
│   │   │   ├── features/             # 30+ 편집 기능 (autosave, change-tracker, table-editor 등)
│   │   │   ├── ai/                   # 22개 AI 파이프라인 모듈
│   │   │   ├── export/               # HwpxSafeExporter + PDF Exporter
│   │   │   ├── ui/                   # ChatPanel · ContextMenu · ThemeManager
│   │   │   └── workers/              # parser.worker.js (오프스레드 파싱)
│   │   ├── ai/                       # TypeScript AI Layer (Vertex, providers, schema)
│   │   │   ├── providers/            # OpenAI/Claude/Vertex/Grok/Azure/Cohere/Local
│   │   │   ├── benchmark/            # AEGIS · TruthAnchor 벤치마크
│   │   │   └── compliance-rules/     # EU AI Act / K-AI Act / NIST / OWASP
│   │   ├── docx/ pdf/ pptx/ excel/ odf/ markdown/  # 멀티포맷 파서
│   │   ├── ocr/                      # Tesseract.js 래퍼 + 파이프라인
│   │   ├── diff/                     # 구조/서식 인식 문서 diff
│   │   ├── rag/                      # RAG/LLM 입력용 청크 추출기
│   │   ├── security/                 # Zero-Width 워터마크
│   │   ├── a11y/                     # 접근성 유틸
│   │   ├── i18n/                     # 국제화
│   │   ├── payments/                 # Toss · KakaoPay
│   │   ├── supabase/                 # 풀스택 백엔드 클라이언트
│   │   └── math/                     # KaTeX 수식 렌더러
│   └── types/                        # 9개 도메인 .d.ts (HWPX/Universal-LLM/Compliance 등)
├── server/
│   ├── proxy.js                      # OpenAI API 프록시 (브라우저 키 노출 차단)
│   ├── vertex-proxy.js               # Vertex AI 프록시 (2M 토큰 컨텍스트)
│   └── hwpx-generator.py             # Python 기반 HWPX 네이티브 저장
├── supabase/
│   ├── migrations/                   # initial_schema + RLS + pg_cron
│   └── functions/                    # Edge Functions (kakao/toss/webhook/email)
├── hanview-mcp/                      # MCP Server (Claude Code 통합, 20 리소스/17 툴/8 프롬프트)
├── hwpTohwpx/hpw2hwpx_converter/     # HWP→HWPX 변환기 (외부)
├── packages/hwpx-parser/             # HWPX 파서 독립 패키지
├── tests/e2e/                        # Playwright 시나리오 12개
└── .github/workflows/                # CI/CD 5개 워크플로우
```

### 2.2 데이터 플로우 (AI 문서 편집)

```
사용자 입력 (Chat / CommandPalette / InlineAssist)
        ↓
AI Controller (vanilla/ai/ai-controller.js)
        ↓
Structure Extractor ← Parsed HWPX Document
        ↓ {structure, textSlots(UUID 매핑)}
Security Gateway (AEGIS: PII 마스킹 · 프롬프트 인젝션 차단)
        ↓
Prompt Builder (구조 JSON + 사용자 요청 + System Message)
        ↓
Universal LLM Service (Provider 선택·폴백·메트릭)
        ↓ stream
TruthAnchor (할루시네이션 검증: 금융/의료/교육/국방/행정 도메인)
        ↓
Validation (슬롯 ID 보존 + 표 행/열 검증)
        ↓
Content Merger (원본 깊은 복사 + 슬롯 텍스트 교체)
        ↓
Renderer 재렌더 → DOM 업데이트
        ↓
HWPX Safe Exporter → ZIP 재패키징 (네이티브 XML 유지)
```

---

## 3. 핵심 연구 성과

### 3.1 HWPX 파서 / 렌더러 / 익스포터

| 단계 | 핵심 기술 | 주요 커밋 |
|------|----------|----------|
| **파싱** | ZIP 압축 해제 + XML 트리 파싱, Web Worker 오프스레드 처리, 이미지/스타일 자동 로드, secPr 정밀 추출 | `73a2402`, `b76b19f` |
| **렌더링** | paragraph/table/shape/image/container 분리형 렌더러, DPI 단위 변환(pt↔px↔mm↔HWPU), 시맨틱 표 정규화 | `b31c263`, `df1447d`, `b5c4768` |
| **편집** | Inline / Canvas 듀얼 모드 (`@hufe921/canvas-editor` 통합), IME/paste/도형 라운드트립 | `fba6148`, `c0d297c`, `0187fce` |
| **저장** | HwpxSafeExporter — 네이티브 XML 보존, 텍스트 스타일(bold/italic/fontSize/color/fontFamily) 정확 반영, Python 보조 서버로 100% 호환 | `d5d7cbb`, `e010606`, `d231728` |
| **HWP 지원** | hwp2hwpx-js 외부 변환기 통합으로 구형 HWP 파일도 열람 가능 | `7968707`, `b0824fb` |

**핵심 성과 지표 (Phase 2-5):**

| 메트릭 | 개선 전 | 개선 후 | 향상도 |
|--------|---------|---------|--------|
| Undo/Redo 속도 | 10–50ms | <1ms | **10–50x** |
| UI 응답 시간 | ~300ms | <30ms | **10x** |
| 메모리 사용량 | 누적 증가 | 안정 | **90%↓** |
| 페이지 분할 오버헤드 | 높음 | 최소 | **90%↓** |
| 타이핑 FPS | 15–20 | >30 | **2x** |

핵심 알고리즘:
- **Phase 2 P0–P3** — Command Pattern + WeakMap GC + Batch Undo/Redo + React Context (`cf76d58`–`fa3d459`)
- **Phase 3** — 재귀 깊이 제한(10), 마진 콜랩스 계산, 표 행 단위 분할, 헤더 반복(`3170513`)
- **Phase 4** — 페이지네이션 세마포어 + FIFO 큐 + Debounce(500ms) + dirty page 추적(`106083e`)

### 3.2 멀티포맷 지원 매트릭스

| 포맷 | 열기 | 편집 | 내보내기 | 라이브러리 |
|------|:---:|:---:|:---:|---------|
| HWPX | ✅ | ✅ | ✅ | 자체 파서 |
| HWP | ✅ | ❌ | ❌ | hwp2hwpx-js |
| PDF | ✅ | ❌ | ✅ | pdfjs-dist 5.6 + jspdf 4.2 |
| DOCX | ✅ | ✅ | ✅ | docx 9.6 |
| XLSX | ✅ | ✅ | ✅ | exceljs 4.4 + xlsx 0.18 |
| PPTX | ✅ | ✅ | ✅ | 자체 파서 |
| ODF | ✅ | — | — | 자체 파서 (Phase 4) |
| Markdown | ✅ | ✅ | ✅ | 자체 파서 |
| 이미지 | OCR | — | — | tesseract.js 7.0 |

**Phase 4 (2026-04 초)** — `598697a` 커밋으로 PDF/ODF/PPTX/OCR/수식(KaTeX 0.16)/문서 비교/접근성 일괄 확장.

### 3.3 AI 문서 인텔리전스

#### 3.3.1 Universal LLM Service

7개 Provider를 단일 인터페이스로 추상화:

```
UniversalLLMService
├── OpenAIProvider       (GPT-4o, GPT-4-turbo, GPT-3.5)
├── ClaudeProvider       (3.5 Sonnet / Haiku / Opus)
├── VertexProvider       (Gemini 2.5 Pro · 2M 토큰)
├── GrokProvider         (X.AI)
├── AzureOpenAIProvider
├── CohereProvider       (Command R / R+)
└── LocalProvider        (Ollama / vLLM / TGI)
```

**부가 기능:**
- 동적 import 기반 코드 스플리팅 (provider별 lazy load)
- Smart Provider Selection & Fallback
- LoadBalancer · MetricsCollector · ValidationCache · Dashboard
- Cost Optimization & Rate Limiting (`ai-quota.ts`)

#### 3.3.2 Vertex AI 장문 초안 생성 (v5)

- **모델:** gemini-2.5-pro (기본), 2M 토큰 컨텍스트 활용
- **파이프라인:** 토큰 예산 계산 → 참조 문서 트리밍 → 프롬프트 조립 → streamGenerateContent → JSON 파싱 → `HWPXDocument` 변환
- **하드 스키마:** `DRAFT_FUNCTION_DECLARATION` (Function Calling) + `HWPX_DRAFT_SCHEMA` (Zod 검증)
- **UI:** CommandPalette, ReferenceUploader, TokenBudgetBar, DraftAIModal, TemplateGallery (`05b73…`, v5 시리즈)

#### 3.3.3 구조 보존 AI 편집

- **Structure Extractor** — UUID 기반 textSlot 매핑으로 LLM이 텍스트만 교체하도록 강제
- **Content Merger** — 깊은 복사 후 슬롯 ID 매핑, 표 행/열·이미지 위치·스타일 무결성 보장
- **검증 규칙:** 섹션 수 동일, 요소 순서 보존, 표 구조 불변, GPT 응답 형식 강제

#### 3.3.4 멀티 패스 / 멀티 페이지 생성

- **AI 레퍼런스 기반 생성** (`e5be851`) — 업로드 PDF/HWP/이미지를 컨텍스트로 활용
- **멀티패스 확장** (`fb5c996`) — 각 `## 섹션`을 A4 1쪽 분량으로 병렬 확장
- **적응형 배치 + 동적 타임아웃** (`ed4dbe4`, `3f7be4b`) — API 타임아웃 방지, 중간 저장으로 회복력 확보
- **시맨틱 표 인텔리전스 v3.0** (`992206b`) — 인간 수준 표 이해 + 병렬 LLM 생성

#### 3.3.5 인라인/셀렉션 AI 어시스턴트 (최신)

- **셀렉션 기반 AI 인라인 어시스트** (`d9f10a4`, 2026-04-24) — 요약 / 번역 / 리라이트 / 맞춤법을 선택 영역에 즉시 적용
- **InlineAIAssistant.tsx** + AI Edit Toolbar / Suggestion Engine

### 3.4 보안·신뢰성 레이어

#### 3.4.1 AEGIS Security Gateway

`src/lib/vanilla/ai/security-gateway.js` — AI 입출력 보호 래퍼

- 프롬프트 인젝션 차단
- PII 자동 마스킹 (주민번호/계좌/카드/이메일 등)
- 출력 필터링 (정상 통과 / 위협 차단 / FP·FN 분류)
- 오픈소스 빌드에서는 no-op 모드 (`aegis-noop.ts`), 자체 SDK 분리

**벤치마크 메트릭 (`benchmark/types.ts`):**
- 카테고리: prompt-injection · jailbreak · pii · normal · social-engineering · code-injection
- 측정: Precision/Recall/F1/Support, FP Rate · FN Rate, Avg Latency

#### 3.4.2 TruthAnchor v2.0 (할루시네이션 검증)

- **다도메인 지원:** general · finance · medical · education · defense · admin (`d231728`)
- **검증 결과:** supported / contradicted / neutral + confidence + matched evidence
- **카테고리:** guardrail · numeric · factual · mixed
- **UI 통합:** 검증 리포트 접이식 패널 + 할루시네이션 자동 교정 (`37be72f`)

#### 3.4.3 AI 컴플라이언스 시스템 (4대 프레임워크)

`src/lib/ai/compliance-rules/` — `5baf843` 커밋으로 도입:

| 프레임워크 | 파일 | 범위 |
|----------|------|------|
| **EU AI Act** | `eu-ai-act.ts` | EU 인공지능 규정(2024) — 위험 등급 분류, 금지 시스템, 고위험 의무 |
| **K-AI Act** | `k-ai-act.ts` | 한국 AI 기본법 — 고영향 AI 사업자 의무, 안전성·신뢰성 확보 |
| **NIST AI RMF** | `nist-ai-rmf.ts` | 미국 NIST 위험관리 프레임워크 1.0 |
| **OWASP LLM Top 10** | `owasp-llm-top10.ts` | LLM 애플리케이션 보안 위협 Top 10 |

- **compliance-reporter.ts / compliance-pdf.ts** — PDF 리포트 자동 생성
- **OW-06b PII 자동 마스킹 증거 검증** (`2875ceb`) — 컴플라이언스 증거 채증 강화
- **실시간 모니터링** (`f05e1e4`) — 보안 시스템 데모 + 모니터링 대시보드
- **QUICK/BENCHMARK 탭 통합** (`676cf77`) — 26개 용어 툴팁, Portal 기반 팝업

#### 3.4.4 Invisible Watermark (Zero-Width 스테가노그래피)

`src/lib/security/watermark.ts`

- 인코딩: ZWSP(U+200B)=0, ZWNJ(U+200C)=1, ZWJ(U+200D)=프레임 마커
- 본문 32자 간격 분산 + 페이로드 redundancy 2회 — 일부 텍스트 유실에도 복구
- 페이로드: `userId`, `timestamp`, `documentId`, `custom`
- 적용/추출/검증 API: `embedWatermark`, `extractWatermark`, `hasWatermark`, `stripWatermark`

#### 3.4.5 RAG Extractor

`src/lib/rag/rag-extractor.ts` — LLM 입력용 청크 JSON 변환

- **청크 전략:** 시맨틱 그리드 기반 표 → "header: content" 페어, 단락 → 토큰 길이 기반 머지/분할, 이미지 → alt/캡션
- **메타데이터:** path(section/element/row/cell) + 헤더/콘텐츠 타입 보존
- **출력 포맷:** RAGDocument, NDJSON, LangChain Documents

### 3.5 통합 시스템 특허

`a147da7` (2026-03-30) — **"AI 보안검증 + 규제준수 지능형 문서편집 시스템"** 특허 명세서 작성. AEGIS + TruthAnchor + 컴플라이언스 + HWPX 편집의 통합 아키텍처가 핵심 청구항.

---

## 4. UI / UX

### 4.1 페이지·라우팅 (`src/pages/`)

- LandingPage (한컴 스타일, 미디어아트 파티클 배경 — `402b0d8`, `78948ad`)
- LoginPage / SignupPage (`69d598e`)
- EditorPage (`HanViewApp` 호스트)
- PricingPage / PaymentSuccessPage / PaymentFailPage
- LegalPages (이용약관/개인정보처리방침)
- AdminDashboard — Reference > Docs 메뉴 포함 (`d1deacb`)

### 4.2 핵심 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `HanViewApp` | 툴바 + 뷰어 + AI 패널 결합 통합 셸 |
| `HWPXViewerWrapper` | 단일 뷰어, `editorType?: 'inline' \| 'canvas'` prop으로 모드 선택 |
| `CanvasEditorPanel` | canvas-editor 기반 전체 문서 편집 surface |
| `CommandPalette` | ⌘K 기반 명령 팔레트 |
| `DraftAIModal` / `TemplateGallery` | 장문 초안 생성 UI |
| `InlineAIAssistant` | 셀렉션 기반 AI 작업 (요약/번역/리라이트/맞춤법) |
| `DiffViewer` | 구조 인식 문서 비교 |
| `OCRDialog` | Tesseract.js 기반 한국어 OCR |
| `TrackChangesPanel` / `CommentsPanel` | 변경추적 · 댓글 |
| `SecurityTestPanel` / `AIBenchmarkDashboard` | 보안 테스트 · AI 벤치마크 |
| `TokenBudgetBar` | 실시간 토큰 사용량 표시 |
| `FeedbackWidget` / `CookieConsent` | 사용자 피드백 · GDPR 쿠키 동의 |

### 4.3 커스터마이징 API

`HanViewProvider` + `useHanView` / `useHanViewConfig` / `useHanViewTheme` / `useHanViewToolbar` / `useHanViewAIPanel` Hook으로 테마·툴바·AI 패널을 외부 주입 가능.

`useHotkeys` / `useDraftStream` (v5) Hook 제공.

---

## 5. 사업화 인프라

### 5.1 Supabase 풀스택 통합 (`49074a2`)

- **Auth:** 이메일/비밀번호 + OAuth, ProtectedRoute (`e64bdda`)
- **DB:** `20260411000001_initial_schema.sql` — 사용자/구독/결제/문서 메타 테이블
- **RLS:** `20260411000002_rls_policies.sql` — 행 수준 보안 정책
- **pg_cron:** `20260411000003_pg_cron.sql` — 정기결제·만료 처리 스케줄
- **Edge Functions:** kakao-ready/kakao-approve/kakao-webhook/toss-confirm/toss-webhook/process-renewals/send-email

### 5.2 결제 시스템

- **Toss Payments + KakaoPay** 동시 지원 (`496ef7b`)
- 결제 SDK: `@tosspayments/payment-sdk` 1.9
- Webhook 핸들러 + 정기결제 cron + 어드민 대시보드 + E2E 12번 시나리오 + 보안감사 (`d038e91`)

### 5.3 배포 인프라

- **GitHub Pages** — 공식 문서 사이트 + 랜딩 페이지 (`12e043b`)
- **Docker** — Dockerfile + Dockerfile.nginx + docker-compose.yml
- **CI/CD 5개 워크플로우:** `ci.yml`, `deploy.yml`, `deploy-docs.yml`, `docs.yml`, `e2e-tests.yml`, `performance.yml`, `pr-check.yml`, `release.yml`, `security.yml`
- **npm 패키지** — `open-hangul-ai@5.0.5` 공개 게시 (`fd46b23`)

### 5.4 보안 강화

- **CSP** — 포괄적 Content Security Policy + 보안 헤더 (`5faca00`, `ac9e0dd`)
- **CSP worker-src blob:** Web Worker 차단 해결 (`f436817`)
- **빌드 타임 API 키 인라인 제거** — 라이브러리 번들에서 키 노출 차단 (`a12899b`)
- **security:check 스크립트** — `scripts/security-check.mjs`

---

## 6. 품질·테스트

### 6.1 단위 테스트

- **총 1,168개 단위 테스트 100% 통과** (`8d52074`, 2026-04-11)
- 테스트 파일: 86개
- 테스트 프레임워크: Vitest 4.0 + @testing-library/react 16.3 + jsdom 27.2
- 커버리지 도구: `@vitest/coverage-v8`

**주요 테스트 모듈:**
- viewer/parser/renderers (paragraph/table/shape/image/container)
- ai-controller / structure-extractor / validation / content-merger
- history-manager-v2 (Phase 2 P0-P3 각 6 시나리오)
- table-editor / inline-editor / range-manager / cell-selector
- compliance-rules / compliance-reporter / compliance-pdf
- watermark / ocr-service / document-diff / rag-extractor
- universal-llm-service (provider별)
- ai-quota / draft-generator / hwpx-schema / vertex-client

### 6.2 E2E 테스트 (Playwright)

12개 시나리오 (`tests/e2e/01~12`):
- 페이지 로드 / HWPX 로딩 / 보안 / 반응형 / 접근성
- 편집 워크플로우 / 표 편집 / 검색 치환 / 저장 / 키보드 단축키
- 신규 문서 편집 / 결제 플로우

**브라우저 매트릭스:** Chromium / Firefox / WebKit / Mobile Chrome / Mobile Safari

### 6.3 빌드·번들

- Vite 7.2 + TypeScript 5.9 + React 19.2
- 라이브러리 빌드: `vite.config.lib.ts` — ESM + UMD, vite-plugin-dts로 타입 정의 자동 생성
- 번들 크기 (v2.1):
  - ES 모듈: 429.6 KB (gzip: 122.3 KB)
  - UMD: 428.1 KB (gzip: 122.1 KB)
  - CSS: 94 KB
- **manualChunks 코드 스플리팅** — 초기 로드 38% 감소

---

## 7. 개발자 도구

### 7.1 HanView MCP Server v2.0

`hanview-mcp/` — Claude Code 통합용 Model Context Protocol 서버

- **20개 Resource** — `hanview://docs/*`, `hanview://src/*`, `hanview://phase/*`, `hanview://security/*` 등
- **17개 Tool** — `search_code`, `find_function`, `analyze_imports`, `find_todos`, `analyze_hwpx_parser`, `get_hwpx_elements`, `get_component_info`, `list_components`, `check_build_status`, `run_lint`, `analyze_dependencies` 등
- **8개 Prompt** — `analyze-codebase`, `implement-feature`, `fix-bug`, `optimize-performance`, `add-hwpx-element`, `review-code`, `write-test`, `debug-issue`

### 7.2 진단·검증 스크립트

- `scripts/diagnostic-test.mjs`
- `scripts/security-check.mjs`
- `scripts/prepare-package.js`
- `src/lib/vanilla/tools/inspector.js`

---

## 8. 연구 진행 타임라인 (요약)

| 시기 | 마일스톤 | 대표 커밋 |
|------|---------|----------|
| **2025 (Phase 1)** | 초기 HWPX 뷰어 → Vanilla JS 아키텍처 전환 → 종합 편집(테이블/이미지/도형) → IME 처리 | `1fd4a42` ~ `b3bd91b` |
| **2025 (Phase 2-5)** | Command Pattern + WeakMap + Batch Undo + Page Splitting + Dynamic Pagination + 43개 자동화 테스트 | `cf76d58` ~ `eccb932` |
| **2025-12** | 상업용 라이선스 전환 검토 + 편집 모드 기본 활성화 | `2.0.0-commercial` |
| **2026-01 (v2.1)** | TypeScript 마이그레이션 완료 + Phase 2-5 통합 + 프로덕션 배포 | `2.1.0` |
| **2026-02 ~ 03** | 멀티페이지 AI 편집 + 표 그리드 정규화 + HWP 변환기 통합 + AI 채팅 → 본문 적용 | `b76b19f`, `7968707`, `0a276ea` |
| **2026-03 후반** | **AEGIS + TruthAnchor 통합** + HWPX 네이티브 저장 + AI 컴플라이언스 4대 프레임워크 + 시맨틱 표 v3 + 특허 명세서 | `b43c4b4`, `5baf843`, `992206b`, `a147da7` |
| **2026-04 초** | **멀티포맷 대확장** (PDF/ODF/PPTX/OCR/수식/diff/a11y) + 변경추적·댓글 + Supabase 풀백엔드 + Toss/KakaoPay 결제 + Webhook + 어드민 + 1,168 테스트 통과 | `598697a`, `49074a2`, `d038e91` |
| **2026-04-19** | **npm 패키지 첫 공개 v5.0.1** + YATAV 운영 주체 확정 + CI/CD 5개 워크플로우 | `267b458`, `8734f2e` |
| **2026-04-20 ~ 22** | **MIT 오픈소스 완전 정합화** — 상업용 라이선스/AEGIS 비공개 모듈 git history 삭제, README 한/영 이중 구조, 랜딩 페이지 전면 개선 | `71615bc`, `45257a0`, `301755b`, `78948ad` |
| **2026-04-22 ~ 24** | **canvas-editor 통합** — HWPX ↔ canvas-editor 양방향 변환, 듀얼 편집 모드, IME/paste/도형 라운드트립, 셀렉션 기반 AI 인라인 어시스트 | `fba6148`, `0187fce`, `c0d297c`, `d9f10a4` |

총 **189개 커밋 / 약 6개월 집중 개발 / 122,000 라인 / 267 모듈 / 1,168 테스트**.

---

## 9. 현재 한계 및 후속 연구 과제

### 9.1 알려진 제약

| 영역 | 현 상태 | 향후 보완 |
|------|---------|----------|
| HWP (구형) | 열람만 가능, 편집/내보내기 미지원 | 양방향 변환기 안정화 |
| canvas-editor 모드 | Vue 종속성 검증 완료, 실험적 | 안정화 후 기본 모드 승격 검토 |
| AEGIS SDK | OSS 빌드는 no-op | 별도 상업 모듈 또는 오픈 대체 구현 |
| 협업 편집 | 미지원 | CRDT/OT 기반 실시간 협업 |
| 모바일 UX | 기본 반응형 | 터치 제스처·가상 키보드 최적화 |

### 9.2 계획된 연구 (CHANGELOG `[Unreleased]` 기준)

1. **실시간 협업 편집** — CRDT 기반 멀티 커서·동시 편집
2. **추가 AI Provider 통합** — Mistral, Llama 등
3. **플러그인 시스템** — 외부 개발자 확장 포인트 노출
4. **모바일 최적화** — 터치/제스처/오프라인 모드
5. **CI/CD 고도화** — 자동 시각 회귀 테스트, 패키지 사이즈 가드레일

---

## 10. 결론

오픈한글AI는 **HWPX 네이티브 처리 + 7-Provider AI 추상화 + 보안/컴플라이언스 통합 + 사업화 인프라**를 모두 갖춘, 현 시점 한국어 문서 처리 분야에서 가장 종합적인 오픈소스 스택이다. v5.0.5 npm 공개 이후 라이선스/저장소/연락처가 YATAV로 일원화되었고, AEGIS·TruthAnchor 등 핵심 IP는 별도 비공개 자산으로 분리되어 오픈소스 코어와 상업 IP가 명확히 구분된다.

다음 단계는 **(1) canvas-editor 모드 정식화 → (2) 협업 편집/플러그인/모바일 확장 → (3) 컴플라이언스 자동 채증 리포트의 SaaS화**로 정리할 수 있다.

---

### 부록 A. 핵심 외부 의존성

| 카테고리 | 패키지 (버전) | 용도 |
|---------|--------------|------|
| 프레임워크 | react 19.2 / react-dom 19.2 / react-router-dom 7.14 | UI |
| 상태관리 | zustand 5.0 | 전역 스토어 |
| 문서 처리 | jszip 3.10, pdfjs-dist 5.6, jspdf 4.2, docx 9.6, exceljs 4.4, xlsx 0.18 | 멀티포맷 파싱/내보내기 |
| 편집기 | @hufe921/canvas-editor 0.9.131 | Canvas 기반 편집 (옵션) |
| AI/OCR | tesseract.js 7.0 | OCR |
| 수식 | katex 0.16 | LaTeX 렌더 |
| 백엔드 | @supabase/supabase-js 2.103 | Auth/DB/Edge |
| 결제 | @tosspayments/payment-sdk 1.9 | 결제 |
| UI 보조 | lucide-react 0.555, react-hot-toast 2.6, html2canvas 1.4 | 아이콘/토스트/캡처 |

### 부록 B. 주요 파일 인덱스

| 파일 | 역할 |
|------|------|
| `src/lib/index.ts` | npm 패키지 메인 진입점 (230 라인) |
| `src/lib/vanilla/viewer.js` | HWPXViewerCore 통합 진입점 |
| `src/lib/vanilla/core/parser.js` | SimpleHWPXParser |
| `src/lib/vanilla/core/renderer.js` | DocumentRenderer |
| `src/lib/vanilla/ai/ai-controller.js` | AIDocumentController |
| `src/lib/vanilla/ai/structure-extractor.js` | UUID 슬롯 매핑 |
| `src/lib/vanilla/ai/security-gateway.js` | AEGIS 래퍼 |
| `src/lib/vanilla/ai/truthanchor-client.js` | TruthAnchor 클라이언트 |
| `src/lib/vanilla/export/hwpx-safe-exporter.js` | 네이티브 XML 보존 저장 |
| `src/lib/ai/universal-llm-service.ts` | 7-Provider 통합 서비스 |
| `src/lib/ai/draft-generator.ts` | Vertex 장문 초안 생성 |
| `src/lib/ai/hwpx-schema.ts` | DraftOutput 스키마 + Function Calling 선언 |
| `src/lib/ai/compliance-rules/index.ts` | 4대 컴플라이언스 프레임워크 |
| `src/lib/security/watermark.ts` | Zero-Width 워터마크 |
| `src/lib/rag/rag-extractor.ts` | RAG 청크 추출 |
| `server/proxy.js` · `server/vertex-proxy.js` · `server/hwpx-generator.py` | 서버 사이드 보조 도구 |

---

_본 문서는 2026-05-16 기준 저장소 상태를 종합 정리한 연구 진행 보고서이다. 세부 API 사용법은 `README.md`와 `docs/index.html`을, 버전별 변경 이력은 `CHANGELOG.md`를 참조한다._
