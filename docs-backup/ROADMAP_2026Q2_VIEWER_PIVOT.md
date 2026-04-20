# 오픈한글 AI — 뷰어 중심 피벗 및 AI 초안 생성 로드맵

> **작성일**: 2026-04-16 **버전**: Draft v1.0 **대상 릴리즈**: v5.0.0 (2026 Q3)

---

## 1. 전략 요지

현재 v4.0 은 **풀 기능 편집기 + AI 어시스턴트**로 포지셔닝되어 있으나, 편집 UI
완성도를 높이는 비용이 가파르게 증가하는 구간에 진입함. 시장 조사(ePapyrus 등)
결과 **뷰어 + 대용량 AI 초안 생성**이 차별화 가능 영역으로 판단됨.

### 1.1 피벗 방향

| 축                   | 기존 (v4)                        | 신규 (v5)                                       |
| -------------------- | -------------------------------- | ----------------------------------------------- |
| **편집 방식**        | 직접 편집(커서/툴바/단축키) + AI | **AI 전담 초안 생성** (본문 직접 편집 제거)     |
| **주 사용 시나리오** | 한컴 한글 대체                   | HWP 열람 + "한 문장 요청 → 완성 초안"           |
| **컨텍스트 한도**    | OpenAI GPT-4 (128K)              | **Google Vertex AI / Gemini 2.5 Pro (2M)**      |
| **차별화**           | 브라우저 HWP 편집기              | 초장문·참조 기반 공공문서·보고서 초안 자동 작성 |
| **타겟**             | 일반 사용자                      | 공공기관·교육·제조 기획팀·컨설팅                |

### 1.2 핵심 가설

1. **"편집기"는 레드오션**. 한글은 기능 동등성 경쟁이 무한대.
2. **"200만 토큰 한컴 초안 생성기"는 블루오션**. 대형 법규/표준/매뉴얼 통째로
   컨텍스트에 넣고 생성할 수 있는 국내 솔루션이 없음.
3. **뷰어 품질이 진입장벽**. HWP/HWPX 파싱 3.0 + 시맨틱 그리드 v3.0 은 이미 시장
   평균 이상.

---

## 2. 범위 재정의

### 2.1 유지 (Core)

| 영역                            | 현재 상태                   | v5 역할                         |
| ------------------------------- | --------------------------- | ------------------------------- |
| **HWP → HWPX 변환**             | ✅ 브라우저 변환 (Hwp2Hwpx) | 유지·강화                       |
| **HWPX 파서 v3.0**              | ✅ 시맨틱 그리드            | 유지                            |
| **DOCX/XLSX/PPTX/ODT/PDF 파서** | ✅                          | 유지 (뷰어 범위 확장)           |
| **렌더러**                      | ✅ 단락/표/이미지/도형      | 유지                            |
| **검색 (Ctrl+F)**               | ✅ 정규식 지원              | 유지                            |
| **HWPX·PDF Export**             | ✅                          | 유지                            |
| **OCR (신규)**                  | ✅ tesseract.js             | 유지                            |
| **Invisible Watermark (신규)**  | ✅                          | 유지                            |
| **Diff 비교 (신규)**            | ✅ 구조·서식 인식           | 유지                            |
| **RAG 추출 SDK (신규)**         | ✅                          | 유지 — **AI 프롬프팅에 재활용** |
| **컴플라이언스 대시보드**       | ✅ K-AI Act / EU / OWASP    | 유지                            |

### 2.2 제거 / 디프리케이션 (Deprecate)

편집 UI 의 복잡도 대부분을 제거. 뷰어 + AI 파이프라인만 남김.

| 제거 대상                                     | 사유             | 대체 방식                                  |
| --------------------------------------------- | ---------------- | ------------------------------------------ |
| 인라인 편집기 (`inline-editor.js`)            | AI 편집으로 대체 | AI 전면 초안 재생성 또는 부분 재생성       |
| 테이블 편집기 (`table-editor.js` — 편집 모드) | 편집 제거        | AI 가 셀 단위 재생성                       |
| HangulStyleToolbar (서식 버튼)                | 편집 기능 제거   | 툴바에 "AI 작성" / "저장" / "공유" 만 유지 |
| 단축키 편집 조합 (Ctrl+B/I/U 등)              | 편집 없음        | Ctrl+K (AI 명령창) 로 통합                 |
| 실행취소/다시실행 (Undo/Redo)                 | 편집 없음        | AI 버전 히스토리 (문서 스냅샷) 로 대체     |
| ContextMenu 편집 항목                         | 편집 없음        | "이 부분 AI로 수정" / "복사" 만 남김       |
| 특수문자 팔레트                               | 편집 없음        | AI 프롬프트로 요청                         |
| 머리글/바닥글 편집                            | 편집 없음        | AI 가 템플릿 기반 생성                     |

**유지 시간 스냅샷**: 디프리케이션 대상 코드 약 **~12,000 LOC** (vanilla
features). 단계적으로 `deprecated/` 폴더로 이동 후 v5.1 에서 삭제.

### 2.3 신규 추가 (Add)

| 기능                                | 설명                                      | 우선순위 |
| ----------------------------------- | ----------------------------------------- | -------- |
| **Vertex AI / Gemini 2.5 Pro 통합** | 2M 컨텍스트 백엔드                        | P0       |
| **대용량 초안 생성 파이프라인**     | 참조 문서(들) + 프롬프트 → HWPX 초안      | P0       |
| **참조 문서 업로더**                | 여러 PDF/HWPX/DOCX 업로드 → 컨텍스트 통합 | P0       |
| **AI 명령창 (Ctrl+K)**              | Raycast·Linear 스타일 커맨드 팔레트       | P1       |
| **부분 재생성**                     | 선택 영역에 한정한 재생성                 | P1       |
| **버전 히스토리**                   | AI 세션별 스냅샷 + 복원                   | P1       |
| **스트리밍 생성 UI**                | 토큰 단위 실시간 렌더링                   | P1       |
| **초안 템플릿 갤러리**              | 공문·보고서·회의록·제안서 프리셋          | P2       |
| **청구 미터링**                     | 토큰 사용량 집계·한도 관리                | P2       |

---

## 3. 기술 아키텍처

### 3.1 컴포넌트 다이어그램 (v5)

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (React 19)                       │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Viewer Surface │    │      AI Command Palette       │   │
│  │  (읽기 전용)     │◀──▶│  (Ctrl+K — 프롬프트 입력)     │   │
│  │  - HWPX 렌더     │    │  - 참조 문서 첨부             │   │
│  │  - 셀 선택       │    │  - 스트리밍 결과              │   │
│  │  - 검색·다이프   │    │  - 버전 히스토리              │   │
│  └────────┬────────┘    └──────────┬───────────────────┘   │
│           │                        │                         │
│           ▼                        ▼                         │
│  ┌────────────────────────────────────────────────────┐    │
│  │        Core Library (TypeScript)                    │    │
│  │  - Parser (HWPX/DOCX/PDF/...)                       │    │
│  │  - Renderer                                         │    │
│  │  - RAG Extractor (신규 — 참조 문서 → 청크)          │    │
│  │  - HWPX Exporter + Watermark                        │    │
│  │  - Diff / OCR                                       │    │
│  └───────────────────────┬────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │ HTTPS (streaming)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Edge / Server (Express — server/proxy.js)           │
│  - API Key 보호                                               │
│  - Rate Limit / Quota                                         │
│  - 스트리밍 SSE 중계                                          │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Vertex AI (Gemini 2.5 Pro)               │
│              - 2M token context window                        │
│              - Function calling (HWPX JSON 스키마)            │
│              - Safety filter                                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 AI 초안 생성 파이프라인

```
입력:
  - 사용자 프롬프트 (예: "2026년 상반기 영업성과 보고서 작성")
  - 참조 문서 N개 (최대 약 1.8M 토큰)
  - 선택 템플릿 (선택사항 — 예: "분기보고서 v2")

Step 1. RAG 추출
  → extractForRAG() 로 각 참조 문서를 청크·메타데이터화
  → 토큰 예산 계산: (현재 문서) + (참조) + (프롬프트) + (응답 예약 32K) ≤ 2M

Step 2. 프롬프트 조립
  → System: "당신은 한국 공공/기업 문서 작성 전문가입니다..."
  → User: 템플릿 구조 + 참조 청크 + 요청
  → Function schema: HWPX JSON 출력 스키마 (structure-extractor 역방향)

Step 3. Vertex AI 호출
  → generateContentStream() — SSE 로 토큰 스트림 수신
  → Function call 결과 누적: { sections: [...] }

Step 4. 스트리밍 렌더
  → 섹션 단위로 HWPX JSON → 뷰어 DOM 갱신 (기존 renderer.js 재사용)
  → "생성 중" 스피너 + 취소 버튼

Step 5. 최종화
  → 최종 JSON → HWPX Exporter (+ Invisible Watermark)
  → IndexedDB 에 버전 스냅샷 저장
```

### 3.3 Vertex AI 통합 세부

**인증 방식** (프로덕션):

- 서버 사이드에서 `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON) 사용
- 프론트엔드에는 키 노출 금지 — `server/proxy.js` 가 모든 요청 중계

**스트리밍 프로토콜**:

- Vertex AI `streamGenerateContent` → Express SSE → 프론트엔드 `EventSource`

**모델 선택**: | 모델 | 컨텍스트 | 용도 | |---|---|---| | `gemini-2.5-pro` | 2M
| 대용량 참조 초안 생성 (기본) | | `gemini-2.5-flash` | 1M | 빠른 요약·QA (부가
기능) |

**비용 가드레일**:

- 사용자별 일일 토큰 한도 (예: 500K 토큰/일 — 무료 tier)
- 200만 토큰 초과 요청 차단 + 축약 제안
- 기업 계정은 BYO API Key 옵션

### 3.4 데이터 모델 추가

```typescript
// src/types/ai-draft.d.ts
interface DraftSession {
  id: string;
  title: string;
  createdAt: string;
  prompt: string;
  references: Array<{ fileId: string; fileName: string; tokenCount: number }>;
  versions: DraftVersion[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

interface DraftVersion {
  id: string;
  createdAt: string;
  document: HWPXDocument; // 생성된 문서
  tokensUsed: number;
  model: string;
  prompt: string;
}
```

---

## 4. 개발 로드맵 (4단계, 12주)

### Phase 1 — Vertex AI 백엔드 & 인프라 (2주)

| 작업                                                | 산출물                        |
| --------------------------------------------------- | ----------------------------- |
| `server/proxy.js` → `server/vertex-proxy.ts` 리팩터 | SSE 스트리밍 프록시           |
| GCP 프로젝트 세팅 + 서비스 계정 발급                | IaC (Terraform 선택)          |
| `VertexAIClient` (TS) — generateContentStream 래퍼  | `src/lib/ai/vertex-client.ts` |
| 인증·쿼터·에러 처리                                 | `src/lib/ai/ai-quota.ts`      |
| 단위 테스트 (mocked) + 통합 테스트                  | Vitest + MSW                  |

**검수 기준**: 2M 토큰 요청이 타임아웃 없이 스트리밍되며, 잘못된 키·초과 쿼터에
대해 명확한 에러 반환.

### Phase 2 — AI 초안 생성 코어 (3주)

| 작업                                           | 산출물                                 |
| ---------------------------------------------- | -------------------------------------- |
| `DraftGenerator` — 프롬프트 조립 + 스트림 처리 | `src/lib/ai/draft-generator.ts`        |
| HWPX JSON 출력 스키마 (function calling)       | `src/lib/ai/hwpx-schema.ts`            |
| 참조 문서 업로더 UI                            | `src/components/ReferenceUploader.tsx` |
| 토큰 카운트·예산 표시                          | `src/components/TokenBudgetBar.tsx`    |
| 스트리밍 렌더 훅                               | `src/hooks/useDraftStream.ts`          |
| DraftSessionStore (Zustand)                    | `src/stores/draftStore.ts`             |

**검수 기준**: 3개 PDF + 프롬프트 입력 → 10페이지 분량 HWPX 초안이 3분 내 완성.
중간 취소 가능.

### Phase 3 — 뷰어 UI 정리 & AI 명령창 (3주)

| 작업                                                   | 산출물                                             |
| ------------------------------------------------------ | -------------------------------------------------- |
| 편집 UI 디프리케이션 — `deprecated/` 이동              | `src/lib/vanilla/deprecated/**`                    |
| 새 툴바 — "AI 작성" / "저장" / "공유" / "Diff" / "OCR" | `src/components/layout/ViewerToolbar.tsx` (재작성) |
| Ctrl+K 커맨드 팔레트                                   | `src/components/CommandPalette.tsx`                |
| 부분 재생성 (셀·단락 선택 후 AI 수정)                  | `src/lib/ai/partial-regen.ts`                      |
| 버전 히스토리 드로어                                   | `src/components/VersionHistoryDrawer.tsx`          |
| 키보드 단축키 재정의                                   | `src/hooks/useHotkeys.ts`                          |

**검수 기준**: 기존 편집 단축키 제거, 뷰어는 읽기 전용, AI 명령은 Ctrl+K 로
접근. E2E 테스트 전면 갱신.

### Phase 4 — 템플릿·폴리싱·출시 (4주)

| 작업                                             | 산출물                        |
| ------------------------------------------------ | ----------------------------- |
| 프리셋 템플릿 갤러리 (공문·보고서·회의록·제안서) | `src/templates/*.hwpx` + 메타 |
| 토큰 미터링 & 결제 연동 (Toss 기존 재활용)       | `src/pages/BillingPage.tsx`   |
| 문서 내보내기 — HWPX·PDF·DOCX(optional)          | 기존 export 재사용            |
| 마이그레이션 가이드 (v4 → v5)                    | `docs/MIGRATION_V4_TO_V5.md`  |
| 프로덕션 배포 (Docker + CDN)                     | `deploy/` 업데이트            |
| 마케팅 페이지·데모 비디오                        | 별도                          |

**검수 기준**: 베타 고객 5개사 온보딩, NPS 추적, 10분 내 첫 초안 생성 성공률 80%
이상.

---

## 5. 리스크 및 트레이드오프

### 5.1 리스크

| 리스크                                                      | 가능성 | 영향 | 완화                                                       |
| ----------------------------------------------------------- | ------ | ---- | ---------------------------------------------------------- |
| Vertex AI 가 200만 토큰을 실제로 활용할 때 지연 / 비용 폭증 | 중     | 높음 | 캐싱 (컨텍스트 캐시 기능 활용), 참조 문서 사전 요약 옵션   |
| 편집 기능 제거에 반발                                       | 중     | 중   | 단계적 디프리케이션, v4 병행 지원 6개월                    |
| Gemini 의 한국어 공문 품질                                  | 중     | 높음 | 파인튜닝·Few-shot 예시 강화, 품질 평가 벤치마크 구축       |
| HWPX 재생성 시 원본 서식 손실                               | 중     | 높음 | 원본 `header.xml` + 스타일 팔레트를 시스템 프롬프트로 전달 |
| GCP 의존 단일 지점                                          | 낮     | 중   | 어댑터 패턴 — Claude / GPT 스위치 가능                     |

### 5.2 트레이드오프

- **풍부한 직접 편집 vs 신속한 AI 초안**: 후자를 선택. 포지셔닝 단순화.
- **한글 네이티브 서식 정밀도 vs LLM 자유도**: 중간 지점 — LLM 은 구조·내용만
  생성, 서식은 템플릿·시스템 프롬프트가 제약.
- **Vertex 락인 vs 멀티-프로바이더**: 락인 감수 (성능·컨텍스트 최우선). 어댑터
  층은 유지.

---

## 6. 성공 지표 (KPI)

| 지표                                    | v4 현재 | v5 목표 (2026 Q4) |
| --------------------------------------- | ------- | ----------------- |
| 월간 활성 사용자 (MAU)                  | —       | 1,000             |
| 초안 생성 성공률 (프롬프트 → 완성 HWPX) | —       | 85%               |
| 첫 초안 생성 TTV (Time to Value)        | —       | ≤ 5분             |
| 평균 참조 문서 토큰                     | —       | 500K              |
| 유료 전환율                             | —       | 5%                |
| NPS                                     | —       | ≥ 40              |

---

## 7. 오픈 이슈 / 결정 필요

1. **GCP 프로젝트 소유자**: 개인 계정 vs 법인 계정 — Phase 1 시작 전 확정 필요
2. **무료 tier 토큰 한도**: 500K / 일 가정 — 실제 Vertex 단가 확인 후 조정
3. **v4 지원 기간**: 6개월 / 12개월 — 기존 유료 고객 커뮤니케이션 필요
4. **DOCX·PPTX export 확장**: Phase 4 스코프에 포함 여부
5. **모바일·태블릿**: 뷰어만 제공 vs AI 생성도 가능 — UX 탐색 필요

---

## 부록 A. v4 → v5 API 호환성

신규 라이브러리 빌드 (`vite.config.lib.ts`) 의 공개 API 중 유지·변경·제거 대상:

| API                                           | v4   | v5      | 비고                           |
| --------------------------------------------- | ---- | ------- | ------------------------------ |
| `HWPXViewer` (컴포넌트)                       | ✅   | ✅      | readOnly 기본값 true           |
| `HWPXViewerWrapper`                           | ✅   | ⚠️ 변경 | 편집 관련 prop 제거            |
| `InlineEditor`                                | ✅   | ❌ 제거 | deprecated                     |
| `TableEditor`                                 | ✅   | ❌ 제거 | deprecated                     |
| `AIDocumentController`                        | ✅   | ⚠️ 변경 | Vertex 클라이언트로 교체       |
| `DocumentStructureExtractor`                  | ✅   | ✅      | 유지 — RAG 파이프라인에서 사용 |
| `HwpxExporter`                                | ✅   | ✅      | 유지                           |
| `extractForRAG`                               | 신규 | ✅      | Phase 2 에서 확장              |
| `embedWatermark` / `applyWatermarkToDocument` | 신규 | ✅      | 유지                           |
| `diffDocumentsStructural`                     | 신규 | ✅      | 유지                           |
| `DraftGenerator`                              | —    | ✅ 신규 | Phase 2                        |

---

## 부록 B. 참고

- ePapyrus 제품군 분석 (2026-04-15, 대화 기록)
- Google Vertex AI 가격표: https://cloud.google.com/vertex-ai/pricing
- Gemini 2.5 Pro 스펙: https://ai.google.dev/gemini-api/docs/models/gemini
- 기존 구조 추출기: `src/lib/ai/structure-extractor.ts`
