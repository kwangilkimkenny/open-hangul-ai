/**
 * Hangul-Style Toolbar
 * 한글과컴퓨터 한글의 메뉴바 + 리본 도구모음 재현
 *
 * Layout:
 *   [메뉴바] 파일 | 편집 | 보기 | 삽입 | 서식 | 도구
 *   [리본탭] 홈 | 삽입 | 서식 | 도구 | 보기 | AI
 *   [리본패널] 글꼴그룹 | 단락그룹 | 편집그룹 | ...
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import type { HWPXViewerInstance } from '../types/viewer';
import { markdownToDocument } from '../lib/vanilla/utils/markdown-to-document';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Types
// ============================================================================

interface HangulStyleToolbarProps {
  viewer?: HWPXViewerInstance | null;
  onFileSelect?: (file: File) => void;
  onToggleAI?: () => void;
  showAIPanel?: boolean;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  children?: MenuItem[];
}

type RibbonTab = 'home' | 'insert' | 'format' | 'tools' | 'view' | 'ai';

// ============================================================================
// MenuBar
// ============================================================================

function MenuBar({ viewer, onFileSelect }: { viewer?: HWPXViewerInstance | null; onFileSelect?: (file: File) => void }) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showHelpDialog = useCallback(() => {
    const v = (viewer || (window as any).__hwpxViewer) as any;
    if (!v || typeof v.updateDocument !== 'function') {
      toast.error('뷰어가 초기화되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const helpMarkdown = `# 오픈한글 AI v3.0.0 도움말

*AI 기반 한글 문서(HWP/HWPX) 편집기*

## 1. 편집기 소개

오픈한글 AI는 웹 브라우저에서 한글 문서를 열고, 편집하고, AI로 업무를 자동화하는 문서 편집기입니다.

- **지원 파일:** HWP (레거시 바이너리) + HWPX (최신 XML)
- **AI 엔진:** OpenAI GPT-4 (커스텀 LLM 연동 가능)
- **기술 스택:** React 19 + TypeScript + Vite
- **테스트:** 964개 단위 테스트 통과

## 2. 주요 기능

- **[파일]** 새 문서, 열기(HWP/HWPX), 저장, 다른 이름으로 저장, PDF 내보내기, 인쇄
- **[편집]** 서식(굵게/기울임/밑줄), 글꼴 변경, 정렬, 목록, 들여쓰기, 실행취소/다시실행
- **[삽입]** 표, 이미지, 특수문자, 머리글/바닥글, 각주, 페이지 나누기
- **[AI]** 문서 편집, 요약, 메일 작성, 번역, 검토 의견, AI 친화 교정, 품질 검증 등 15개 AI 어시스턴트
- **[보기]** 줌(25%~400%), 다크 모드, 편집 모드 전환

## AI 문서 작성 방향

오픈한글 AI는 **"AI가 읽고 처리할 수 있는 데이터 구조 문서"** 를 지향합니다.

기존 문서 편집기가 "사람이 보기 좋은 문서"를 만드는 데 집중했다면, 오픈한글 AI는 **사람과 AI가 모두 이해하고 활용할 수 있는 구조화 문서 생성 엔진** 입니다.

이는 정부의 AI 친화 문서 작성 표준에 부합하며, 다음 원칙을 따릅니다:

**문서 작성 원칙:**
- 주어와 서술어가 분명한 완전한 문장으로 작성합니다
- 개조식 나열보다 의미가 완결된 서술형 문장을 우선합니다
- 모호한 지시어(이것, 그것, 해당)를 구체적인 명사로 교체합니다
- 불필요한 꾸밈, 장식 문구, 과도한 수식어를 제거합니다
- 한 문단에는 하나의 핵심 메시지만 담습니다

**표 작성 원칙:**
- 셀 병합을 사용하지 않습니다
- 하나의 셀에는 하나의 의미만 담습니다
- 열 제목과 행 제목을 명확히 구분합니다

**AI 문서 품질 기능 (AI 패널 > AI 문서 품질):**
- **AI 친화 교정** — AI가 위 원칙에 따라 문서 전체를 자동 교정합니다
- **AI 품질 검증** — 문서의 AI 처리 적합도를 5가지 기준(문장 독립성, 구조 추출성, 논리 연결성, 표현 명확성, 표 구조)으로 평가합니다 (0-100점)
- **빠른 검사** — GPT 호출 없이 로컬 규칙으로 즉시 품질을 체크합니다

**최종 목표:** 문서를 AI 요약, 검색, 질의응답, 분류, 자동 보고서 생성에 활용할 수 있는 형태로 작성하는 것입니다.

## 3. 키보드 단축키

| 단축키 | 기능 |
|---|---|
| Ctrl+N | 새 문서 |
| Ctrl+O | 열기 |
| Ctrl+S | 저장 |
| Ctrl+P | 인쇄 |
| Ctrl+B | 굵게 |
| Ctrl+I | 기울임 |
| Ctrl+U | 밑줄 |
| Ctrl+Z | 실행취소 |
| Ctrl+Y | 다시실행 |
| Ctrl+F | 찾기 |
| Ctrl+H | 바꾸기 |
| Ctrl+F10 | 특수문자 |
| Enter | 줄바꿈(단락) / 다음셀(표) |
| Escape | 편집 종료 |
| Tab | 다음 요소 이동 |
| Shift+Tab | 이전 요소 이동 |

## 4. AI 안전성 연동 가이드

### 4.1 연동이 필요한 이유

AI 문서 편집기는 LLM을 이용해 문서를 생성, 요약, 교정합니다. 이 과정에서 두 가지 위험이 발생합니다:

- **위험 1: 할루시네이션** — AI가 사실과 다른 내용을 생성할 수 있습니다.
- **위험 2: 보안** — 사용자의 민감 데이터가 LLM으로 유출되거나, 악의적 프롬프트 인젝션이 발생할 수 있습니다.

이를 해결하기 위해 두 가지 외부 서비스를 연동합니다:

### TruthAnchor — AI 품질 보증 서비스

- 할루시네이션 탐지: AI 생성 텍스트의 사실 여부를 97% 이상 정확도로 검증
- 근거 기반 생성(RAG): 내부 규정, 약관 등 신뢰할 수 있는 문서를 참조하여 생성
- 컴플라이언스 가드레일: 금투법 위반, 수익 보장 표현 등 자동 감지
- 인용 링킹: 생성된 문장마다 출처를 자동 첨부
- 불확실성 점수: 문장별 신뢰도를 0.0~1.0으로 정량화

### AEGIS — AI 보안 게이트웨이

- 입력 검사: 사용자 프롬프트가 LLM에 전달되기 전 위험 탐지
- 출력 검사: LLM 생성 결과가 사용자에게 표시되기 전 안전성 검증
- PII 보호: 문서 내 개인정보(주민번호, 전화번호 등) 자동 탐지 및 가명화
- 프롬프트 인젝션 방어: 직접/간접 인젝션, 유니코드 트릭, 스테가노그래피 탐지
- 다국어 방어: 한국어, 영어, 일본어, 중국어 등 6개 언어 우회 공격 탐지

## 5. 통합 아키텍처

아래는 오픈한글 AI에서 AEGIS와 TruthAnchor를 연동한 전체 데이터 흐름입니다:

\`\`\`
[사용자가 AI 기능 호출]
       |
       v
오픈한글 AI (브라우저)
       |  fetch(/api/ai/chat)
       v
server/proxy.js (백엔드 프록시)
       |
       +--- [단계 1] AEGIS 입력 검사 ---+
       |    POST /v1/judge              |
       |    - 프롬프트 인젝션 탐지        |
       |    - PII 자동 마스킹             |
       |    - 결과: APPROVE / BLOCK       |
       +--------------------------------+
       |
       +--- [단계 2] LLM API 호출 ------+
       |    POST (OpenAI / Custom LLM)   |
       |    - 마스킹된 프롬프트 전달       |
       |    - AI 응답 수신                |
       +--------------------------------+
       |
       +--- [단계 3] AEGIS 출력 검사 ---+
       |    POST /v1/judge              |
       |    - 응답 내 PII 노출 확인       |
       |    - 유해 콘텐츠 차단             |
       +--------------------------------+
       |
       +--- [단계 4] TruthAnchor 검증 --+
       |    POST /api/v2/validate/batch  |
       |    - 할루시네이션 감지 (97%+)     |
       |    - 문장별 신뢰도 점수           |
       |    - 인용 출처 첨부               |
       +--------------------------------+
       |
       v
브라우저에 안전한 결과 표시
  - 신뢰도 인디케이터 (색상 4단계)
  - 인용 사이드 패널
  - 위반 항목 하이라이트
\`\`\`

## 6. 단계별 연동 절차

### Step 1: 사전 준비

1. **TruthAnchor API Key 발급** — 관리자 포털에서 발급 (형식: \`ta-your-api-key\`)
2. **AEGIS API Key 발급** — 관리자 포털에서 발급 (형식: \`aegis_sk_xxxxxxxxxxxx\`)
3. **네트워크 확인** — 서버에서 두 서비스에 접근 가능한지 확인

### Step 2: .env 파일 설정

프로젝트 루트의 .env 파일에 다음 환경변수를 추가합니다:

\`\`\`
# === AEGIS (보안 게이트웨이) ===
AEGIS_URL=https://aegis.your-domain.com
AEGIS_API_KEY=aegis_sk_xxxxxxxxxxxx
AEGIS_TIMEOUT=3000
AEGIS_FAIL_POLICY=close

# === TruthAnchor (품질 보증) ===
TRUTHANCHOR_URL=https://api.truthanchor.io
TRUTHANCHOR_API_KEY=ta-your-api-key
TRUTHANCHOR_TENANT_ID=my-editor-service
TRUTHANCHOR_CONFIDENCE_THRESHOLD=0.5
\`\`\`

### Step 3: server/proxy.js 수정

proxy.js의 \`/api/ai/chat\` 핸들러에 전처리/후처리 훅을 추가합니다.

**[전처리 — AEGIS 입력 검사]**

\`\`\`
const aegisCheck = await fetch(AEGIS_URL + "/v1/judge", {
  method: "POST",
  headers: { "X-API-Key": AEGIS_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: requestData.messages[requestData.messages.length - 1].content,
    options: { scenario: "document_editor", enable_pii_scan: true }
  })
});
const aegisResult = await aegisCheck.json();
if (aegisResult.decision === "BLOCK") {
  return res.status(422).json({ error: aegisResult.risks[0]?.description });
}
\`\`\`

**[후처리 — TruthAnchor 품질 검증]**

\`\`\`
const taCheck = await fetch(TRUTHANCHOR_URL + "/api/v2/validate/batch", {
  method: "POST",
  headers: { "Authorization": "Bearer " + TA_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [{ id: "resp-1", response: llmResponseText, domain_id: "general" }]
  })
});
const taResult = await taCheck.json();
responseData.truthanchor = taResult.results;
\`\`\`

### Step 4: 인증 방식 선택

두 서비스 모두 3가지 인증 방식을 지원합니다:

- **방식 1: API Key** (개발/테스트용) — 헤더에 키 직접 전달
- **방식 2: OAuth 2.0 Client Credentials** (운영용) — 토큰 기반 인증
- **방식 3: mTLS 상호 인증** (보안 최우선) — 인증서 교환 방식

### Step 5: 테스트 및 검증

1. **정상 요청 테스트** — AI 채팅에서 일반 편집 요청, 신뢰도 점수 포함 확인
2. **보안 테스트** — 프롬프트 인젝션 시도, AEGIS BLOCK 확인
3. **품질 테스트** — 잘못된 사실 포함 문서 검증, 할루시네이션 감지 확인
4. **PII 테스트** — 개인정보 포함 문서로 요청, 자동 마스킹 확인

## 7. TruthAnchor API 상세

### 7.1 실시간 문서 생성 (스트리밍)

요청: \`POST /api/v1/chat\`

\`\`\`
{
  "message": "예금자보호 한도에 대해 고객 안내 문서를 작성해줘",
  "session_id": "editor-session-abc123",
  "options": { "stream": true, "require_citations": true }
}
\`\`\`

SSE 응답 이벤트:
- \`token\` — 생성된 텍스트 토큰 (실시간 삽입)
- \`sentence_verified\` — 문장 검증 결과 + 가드레일 위반 여부
- \`citation\` — 인용 출처 정보 (문서명, 관련도 점수)
- \`metadata\` — 불확실성 점수, 처리 시간
- \`done\` — 생성 완료

### 7.2 배치 검증 (작성된 문서 검증)

요청: \`POST /api/v2/validate/batch\`

\`\`\`
{
  "items": [
    { "id": "para-1", "response": "예금자보호 한도는 1억원입니다.",
      "evidence": "예금자보호법 제32조: 1인당 5천만원" }
  ]
}
\`\`\`

응답 예시:
- \`is_hallucination: true\` — 수치 불일치 (1억 vs 5천만원)
- \`confidence: 0.95\` — 높은 확신도로 할루시네이션 판정
- \`violations: [{ rule_id: "CG-007", description: "수치 불일치" }]\`

### 7.3 신뢰도 점수 해석

| 불확실성 점수 | 의미 | 편집기 표시 |
|---|---|---|
| 0.0 ~ 0.2 | 높은 신뢰도 — 근거 충분 | 녹색 표시 |
| 0.2 ~ 0.5 | 주의 — 일부 근거 부족 | 노란색 표시 |
| 0.5 ~ 0.8 | 낮은 신뢰도 — 수동 검토 권장 | 주황색 경고 |
| 0.8 ~ 1.0 | 매우 낮음 — 사용 금지 권고 | 빨간색 차단 |

## 8. AEGIS API 상세

### 8.1 판정 요청

요청: \`POST /v1/judge\`

\`\`\`
{
  "prompt": "이 계약서의 핵심 조항을 요약해줘",
  "context": "계약서 본문 텍스트...",
  "options": {
    "scenario": "document_editor",
    "enable_pii_scan": true,
    "enable_injection_detect": true
  }
}
\`\`\`

### 8.2 Decision 타입별 대응

| Decision | 의미 | 편집기 대응 |
|---|---|---|
| APPROVE | 안전함 | 정상 처리 — LLM 호출 진행 |
| MODIFY | 수정 필요 | modified_content로 교체 후 LLM 호출 |
| BLOCK | 차단 | 사용자에게 차단 안내 메시지 표시 |
| ESCALATE | 검토 필요 | 관리자 검토 큐에 전달, 사용자 대기 |
| REASK | 재입력 요구 | 프롬프트 수정 유도 안내 표시 |
| THROTTLE | 속도 제한 | Retry-After 시간 후 재시도 안내 |

### 8.3 에러 코드

- \`400\` — 요청 형식 오류 → 파라미터 확인 후 재시도
- \`401\` — 인증 실패 → API Key 또는 토큰 확인
- \`422\` — 입력 길이 초과 (4000자) → 문서를 분할하여 요청
- \`429\` — Rate Limit 초과 → retry_after_seconds 후 재시도
- \`500\` — 서버 오류 → 폴백 메시지 표시, 재시도

## 9. 핵심 코드 위치

| 파일 | 역할 |
|---|---|
| server/proxy.js | API 프록시 — AEGIS/TruthAnchor 연동 진입점 (여기만 수정하면 됨) |
| src/lib/vanilla/ai/gpt-content-generator.js | LLM API 호출 — callAPI() 메서드가 실제 fetch 수행 |
| src/lib/vanilla/ai/prompt-builder.js | 시스템/사용자 프롬프트 생성 — 보호 대상 프롬프트 |
| src/lib/vanilla/config/ai-config.js | API 키, 엔드포인트, 프록시 URL 등 설정 관리 |
| src/lib/vanilla/ai/ai-controller.js | AI 오케스트레이터 — 추출→생성→병합→렌더링 전체 흐름 제어 |

## 10. 보안 체크리스트

- API Key를 프론트엔드에 노출하지 않는다 (반드시 server/proxy.js 경유)
- HTTPS만 사용한다
- PII가 포함된 문서는 AEGIS의 PII 마스킹이 자동 적용됨을 확인한다
- OAuth 2.0 토큰은 만료 시간을 준수하고 안전하게 저장한다
- 감사 로그를 통해 모든 API 호출 이력을 추적할 수 있도록 한다
- Rate Limit 초과 시 사용자에게 명확한 안내를 제공한다
- AEGIS fail-close 정책을 적용한다 (서비스 장애 시 LLM 호출 차단)

---

**핵심: 모든 연동은 server/proxy.js에서 처리됩니다. 프론트엔드 코드 변경 없이 보안/품질 서비스를 추가할 수 있으며, API 키는 서버 .env에서 관리되어 브라우저에 노출되지 않습니다.**
`;

    const helpDocument = markdownToDocument(helpMarkdown);
    v.updateDocument(helpDocument);
    toast.success('도움말 문서가 로드되었습니다');
    document.body.classList.add('global-edit-mode');
  }, []);

  const handleFileOpen = useCallback(() => {
    fileInputRef.current?.click();
    setActiveMenu(null);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().match(/\.(hwpx|hwp|md)$/i)) {
        toast.error('HWP/HWPX/MD 파일만 지원됩니다');
        return;
      }
      onFileSelect?.(file);
    }
    e.target.value = '';
  }, [onFileSelect]);

  const handleSave = useCallback(async () => {
    setActiveMenu(null);
    if (viewer && typeof (viewer as any).saveFile === 'function') {
      try {
        toast.loading('저장 중...', { id: 'saving' });
        await (viewer as any).saveFile();
        toast.dismiss('saving');
        toast.success('저장 완료');
      } catch (err: any) {
        toast.dismiss('saving');
        toast.error(`저장 실패: ${err?.message}`);
      }
    } else {
      toast.error('저장할 문서가 없습니다');
    }
  }, [viewer]);

  const handleSaveAs = useCallback(async () => {
    setActiveMenu(null);
    const filename = window.prompt('파일명을 입력하세요', '새문서.hwpx');
    if (!filename) return;
    const name = filename.match(/\.(hwpx|hwp|md)$/i) ? filename : `${filename}.hwpx`;
    if (viewer && typeof (viewer as any).saveFile === 'function') {
      try {
        toast.loading('저장 중...', { id: 'saving' });
        await (viewer as any).saveFile(name);
        toast.dismiss('saving');
        toast.success(`"${name}" 저장 완료`);
      } catch (err: any) {
        toast.dismiss('saving');
        toast.error(`저장 실패: ${err?.message}`);
      }
    } else {
      toast.error('저장할 문서가 없습니다');
    }
  }, [viewer]);

  const handleExportPDF = useCallback(async () => {
    setActiveMenu(null);
    try {
      toast.loading('PDF 생성 중...', { id: 'pdf' });
      const { PDFExporter } = await import('../lib/vanilla/export/pdf-exporter.js');
      const exporter = new PDFExporter();
      await exporter.exportDocument('.hwp-page-container');
      toast.dismiss('pdf');
      toast.success('PDF 내보내기 완료');
    } catch (err: any) {
      toast.dismiss('pdf');
      toast.error(`PDF 내보내기 실패: ${err?.message}`);
    }
  }, []);

  const handlePrint = useCallback(() => {
    setActiveMenu(null);
    if (viewer && (viewer as any).printDocument) {
      (viewer as any).printDocument();
    } else {
      window.print();
    }
  }, [viewer]);

  const handleNewDocument = useCallback(async () => {
    setActiveMenu(null);
    const v = viewer as any;
    if (!v) {
      toast.error('뷰어가 초기화되지 않았습니다');
      return;
    }
    // 빈 A4 문서 생성
    const emptyDocument = {
      sections: [{
        elements: [
          {
            type: 'paragraph',
            runs: [{ text: '', style: {} }],
            text: '',
            style: { textAlign: 'left', lineHeight: '1.6' }
          }
        ],
        pageSettings: {
          width: '794px',
          height: '1123px',
          marginLeft: '85px',
          marginRight: '85px',
          marginTop: '71px',
          marginBottom: '57px',
        },
        pageWidth: 794,
        pageHeight: 1123,
        headers: { both: null, odd: null, even: null },
        footers: { both: null, odd: null, even: null },
      }],
      images: new Map(),
      borderFills: new Map(),
      metadata: {
        parsedAt: new Date().toISOString(),
        sectionsCount: 1,
        imagesCount: 0,
        borderFillsCount: 0,
      }
    };
    try {
      await v.createNewDocument(emptyDocument);
      document.body.classList.add('global-edit-mode');
      toast.success('새 문서가 생성되었습니다');
    } catch (err: any) {
      toast.error(`새 문서 생성 실패: ${err?.message}`);
    }
  }, [viewer]);

  const menus: Record<string, MenuItem[]> = {
    '파일(F)': [
      { label: '새 문서', shortcut: 'Ctrl+N', action: handleNewDocument },
      { label: '열기', shortcut: 'Ctrl+O', action: handleFileOpen },
      { label: '', divider: true },
      { label: '저장', shortcut: 'Ctrl+S', action: handleSave },
      { label: '다른 이름으로 저장', shortcut: 'Ctrl+Shift+S', action: handleSaveAs },
      { label: '', divider: true },
      { label: 'PDF로 내보내기', action: handleExportPDF },
      { label: 'Markdown으로 내보내기', action: async () => {
        setActiveMenu(null);
        const v = (viewer || (window as any).__hwpxViewer) as any;
        if (!v) { toast.error('뷰어가 초기화되지 않았습니다'); return; }
        try {
          const doc = v.getDocument?.();
          if (!doc) { toast.error('내보낼 문서가 없습니다'); return; }
          const { exportToMarkdown } = await import('../lib/markdown/parser');
          const md = exportToMarkdown(doc);
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '문서.md';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success('Markdown 내보내기 완료');
        } catch (err: any) {
          toast.error(`Markdown 내보내기 실패: ${err?.message}`);
        }
      }},
      { label: '인쇄', shortcut: 'Ctrl+P', action: handlePrint },
      { label: '', divider: true },
      { label: '문서 정보', action: () => { setActiveMenu(null); const doc = (viewer as any)?.getDocument?.(); const meta = doc?.metadata; if (meta) { toast(`섹션: ${meta.sectionsCount || 0}개, 이미지: ${meta.imagesCount || 0}개\n파싱: ${meta.parsedAt || '-'}`, { duration: 4000 }); } else { toast('문서가 로드되지 않았습니다'); } } },
    ],
    '편집(E)': [
      { label: '실행 취소', shortcut: 'Ctrl+Z', action: () => { setActiveMenu(null); (viewer as any)?.historyManager?.undo(); } },
      { label: '다시 실행', shortcut: 'Ctrl+Y', action: () => { setActiveMenu(null); (viewer as any)?.historyManager?.redo(); } },
      { label: '', divider: true },
      { label: '잘라내기', shortcut: 'Ctrl+X', action: () => { setActiveMenu(null); document.execCommand('cut'); } },
      { label: '복사', shortcut: 'Ctrl+C', action: () => { setActiveMenu(null); document.execCommand('copy'); } },
      { label: '붙여넣기', shortcut: 'Ctrl+V', action: () => { setActiveMenu(null); document.execCommand('paste'); } },
      { label: '', divider: true },
      { label: '찾기', shortcut: 'Ctrl+F', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.show?.(); } },
      { label: '찾아 바꾸기', shortcut: 'Ctrl+H', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.show?.('replace'); } },
    ],
    '보기(V)': [
      { label: '확대', shortcut: 'Ctrl++', action: () => { setActiveMenu(null); const pages = document.querySelectorAll('.hwp-page-container') as NodeListOf<HTMLElement>; pages.forEach(p => { const cur = parseFloat(p.style.transform?.replace(/scale\(([^)]+)\)/, '$1') || '1'); p.style.transform = `scale(${Math.min(4, cur + 0.25)})`; p.style.transformOrigin = 'top center'; }); } },
      { label: '축소', shortcut: 'Ctrl+-', action: () => { setActiveMenu(null); const pages = document.querySelectorAll('.hwp-page-container') as NodeListOf<HTMLElement>; pages.forEach(p => { const cur = parseFloat(p.style.transform?.replace(/scale\(([^)]+)\)/, '$1') || '1'); p.style.transform = `scale(${Math.max(0.25, cur - 0.25)})`; p.style.transformOrigin = 'top center'; }); } },
      { label: '100%', shortcut: 'Ctrl+0', action: () => { setActiveMenu(null); const pages = document.querySelectorAll('.hwp-page-container') as NodeListOf<HTMLElement>; pages.forEach(p => { p.style.transform = 'scale(1)'; }); } },
      { label: '', divider: true },
      { label: '편집 모드 전환', action: () => { setActiveMenu(null); (viewer as any)?.editModeManager?.toggleGlobalEditMode?.(); } },
      { label: '', divider: true },
      { label: '다크 모드 전환', action: () => { setActiveMenu(null); const isDark = document.documentElement.getAttribute('data-theme') === 'dark'; document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark'); (viewer as any)?.themeManager?.setTheme?.(isDark ? 'light' : 'dark'); } },
    ],
    '삽입(I)': [
      { label: '표 삽입 (3x3)', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeInsertTable(3, 3); } },
      { label: '그림 삽입', action: () => {
        setActiveMenu(null);
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (ev: any) => {
          const file = ev.target?.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            await (viewer as any)?.commandAdapt?.executeInsertImage(url, { width: 300 });
          }
        };
        input.click();
      }},
      { label: '특수 문자', shortcut: 'Ctrl+F10', action: () => { setActiveMenu(null); (viewer as any)?.specialCharPicker?.open?.(); } },
      { label: '', divider: true },
      { label: '글머리 기호', action: () => { setActiveMenu(null); const ec = (viewer as any)?.inlineEditor?.editingCell; if (ec) { ec.focus(); setTimeout(() => document.execCommand('insertUnorderedList', false), 0); } else { (viewer as any)?.command?.bulletList('bullet'); } } },
      { label: '번호 매기기', action: () => { setActiveMenu(null); const ec = (viewer as any)?.inlineEditor?.editingCell; if (ec) { ec.focus(); setTimeout(() => document.execCommand('insertOrderedList', false), 0); } else { (viewer as any)?.command?.numberedList('decimal'); } } },
      { label: '목록 제거', action: () => { setActiveMenu(null); const ec = (viewer as any)?.inlineEditor?.editingCell; if (ec) { ec.focus(); setTimeout(() => { document.execCommand('removeFormat', false); const lists = ec.querySelectorAll('ul, ol'); lists.forEach((l: Element) => { const items = l.querySelectorAll('li'); const frag = document.createDocumentFragment(); items.forEach((li: Element) => { const div = document.createElement('div'); div.innerHTML = li.innerHTML; frag.appendChild(div); }); l.replaceWith(frag); }); }, 0); } else { (viewer as any)?.command?.removeList?.(); } } },
      { label: '', divider: true },
      { label: '페이지 나누기', action: () => {
        setActiveMenu(null);
        const v = viewer as any;
        if (!v) return;
        const doc = v.getDocument?.();
        if (!doc) { toast.error('문서가 없습니다'); return; }
        const newSection = { elements: [{ type: 'paragraph', runs: [{ text: '', style: {} }], style: { textAlign: 'left', lineHeight: '1.6' } }], pageSettings: doc.sections[0]?.pageSettings || {}, pageWidth: doc.sections[0]?.pageWidth || 794, pageHeight: doc.sections[0]?.pageHeight || 1123, headers: { both: null, odd: null, even: null }, footers: { both: null, odd: null, even: null } };
        doc.sections.push(newSection);
        doc.metadata.sectionsCount = doc.sections.length;
        v.updateDocument(doc);
        toast.success(`페이지 ${doc.sections.length} 추가됨`);
      }},
      { label: '머리글 편집', action: () => {
        setActiveMenu(null);
        const v = viewer as any;
        const doc = v?.getDocument?.();
        if (!doc?.sections?.[0]) { toast.error('문서가 없습니다'); return; }
        const text = window.prompt('머리글 텍스트를 입력하세요', doc.sections[0].headers?.both?.elements?.[0]?.runs?.[0]?.text || '');
        if (text === null) return;
        doc.sections.forEach((s: any) => { s.headers = { both: text ? { elements: [{ type: 'paragraph', runs: [{ text }] }] } : null, odd: null, even: null }; });
        v.updateDocument(doc);
        toast.success(text ? '머리글이 설정되었습니다' : '머리글이 제거되었습니다');
      }},
      { label: '바닥글 편집', action: () => {
        setActiveMenu(null);
        const v = viewer as any;
        const doc = v?.getDocument?.();
        if (!doc?.sections?.[0]) { toast.error('문서가 없습니다'); return; }
        const text = window.prompt('바닥글 텍스트를 입력하세요', doc.sections[0].footers?.both?.elements?.[0]?.runs?.[0]?.text || '');
        if (text === null) return;
        doc.sections.forEach((s: any) => { s.footers = { both: text ? { elements: [{ type: 'paragraph', runs: [{ text }] }] } : null, odd: null, even: null }; });
        v.updateDocument(doc);
        toast.success(text ? '바닥글이 설정되었습니다' : '바닥글이 제거되었습니다');
      }},
      { label: '', divider: true },
      { label: '각주 삽입', action: () => {
        setActiveMenu(null);
        const sel = window.getSelection();
        const node = sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement;
        const editable = node?.closest('[contenteditable="true"]');
        if (!editable) { toast.error('편집 중인 텍스트에 커서를 놓으세요'); return; }
        const noteText = window.prompt('각주 내용을 입력하세요');
        if (!noteText) return;
        const sup = document.createElement('sup');
        sup.textContent = '*';
        sup.title = noteText;
        sup.style.color = '#2b579a';
        sup.style.cursor = 'help';
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.collapse(false);
          range.insertNode(sup);
          range.setStartAfter(sup);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        toast.success('각주가 삽입되었습니다');
      }},
    ],
    '서식(O)': [
      { label: '굵게', shortcut: 'Ctrl+B', action: () => { setActiveMenu(null); (viewer as any)?.command?.bold(); } },
      { label: '기울임', shortcut: 'Ctrl+I', action: () => { setActiveMenu(null); (viewer as any)?.command?.italic(); } },
      { label: '밑줄', shortcut: 'Ctrl+U', action: () => { setActiveMenu(null); (viewer as any)?.command?.underline(); } },
      { label: '취소선', action: () => { setActiveMenu(null); (viewer as any)?.command?.strikethrough(); } },
      { label: '', divider: true },
      { label: '왼쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignLeft(); } },
      { label: '가운데 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignCenter(); } },
      { label: '오른쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignRight(); } },
      { label: '양쪽 정렬', action: () => { setActiveMenu(null); (viewer as any)?.command?.alignJustify(); } },
      { label: '', divider: true },
      { label: '줄 간격 160%', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeLineSpacing(1.6); } },
      { label: '줄 간격 200%', action: () => { setActiveMenu(null); (viewer as any)?.commandAdapt?.executeLineSpacing(2.0); } },
    ],
    '도구(T)': [
      { label: '찾아 바꾸기', shortcut: 'Ctrl+H', action: () => { setActiveMenu(null); (viewer as any)?.searchDialog?.show?.('replace'); } },
      { label: '', divider: true },
      { label: '편집 모드 전환', shortcut: 'Ctrl+E', action: () => { setActiveMenu(null); (viewer as any)?.editModeManager?.toggleGlobalEditMode?.(); } },
      { label: '문서 검증', action: () => {
        setActiveMenu(null);
        const doc = (viewer as any)?.getDocument?.();
        if (!doc?.sections) { toast.error('문서가 없습니다'); return; }
        let chars = 0, paras = 0, tables = 0, images = 0, emptyParas = 0;
        doc.sections.forEach((s: any) => {
          (s.elements || []).forEach((el: any) => {
            if (el.type === 'paragraph') {
              paras++;
              const text = (el.runs || []).map((r: any) => r.text || '').join('');
              chars += text.length;
              if (!text.trim()) emptyParas++;
            } else if (el.type === 'table') {
              tables++;
              (el.rows || []).forEach((row: any) => (row.cells || []).forEach((cell: any) => (cell.elements || []).forEach((ce: any) => { if (ce.runs) chars += ce.runs.map((r: any) => r.text || '').join('').length; })));
            } else if (el.type === 'image') { images++; }
          });
        });
        toast(`문서 검증 결과:\n페이지: ${doc.sections.length}  단락: ${paras}  표: ${tables}  이미지: ${images}\n총 글자수: ${chars}  빈 단락: ${emptyParas}`, { duration: 5000 });
      }},
      { label: '', divider: true },
      { label: '키보드 단축키', action: () => {
        setActiveMenu(null);
        const shortcuts = [
          'Ctrl+N: 새 문서', 'Ctrl+O: 열기', 'Ctrl+S: 저장',
          'Ctrl+P: 인쇄', 'Ctrl+Z: 실행취소', 'Ctrl+Y: 다시실행',
          'Ctrl+B: 굵게', 'Ctrl+I: 기울임', 'Ctrl+U: 밑줄',
          'Ctrl+F: 찾기', 'Ctrl+H: 바꾸기', 'Ctrl+F10: 특수문자',
          'Enter: 줄바꿈(단락)/다음셀(표)', 'Escape: 편집 종료',
          'Tab: 다음 요소', 'Shift+Tab: 이전 요소',
        ];
        alert('키보드 단축키\n\n' + shortcuts.join('\n'));
      }},
      { label: '', divider: true },
      { label: '클라우드 동기화', action: () => {
        setActiveMenu(null);
        const v = viewer as any;
        if (v?.autoSaveManager) {
          const sessions = v.autoSaveManager.getSavedSessions?.();
          if (sessions && sessions.length > 0) {
            toast(`자동저장 세션 ${sessions.length}개 존재\n클라우드 동기화는 Google API 키 설정이 필요합니다.`, { duration: 4000 });
          } else {
            toast('자동저장된 세션이 없습니다');
          }
        } else {
          toast('자동저장 기능이 비활성화되어 있습니다');
        }
      }},
      { label: '언어 전환 (ko/en)', action: () => {
        setActiveMenu(null);
        import('../lib/i18n').then(({ getLocale, setLocale }) => {
          const next = getLocale() === 'ko' ? 'en' : 'ko';
          setLocale(next as any);
          toast(`언어가 ${next === 'ko' ? '한국어' : 'English'}로 변경되었습니다.\n새로고침 후 적용됩니다.`, { duration: 3000 });
        });
      }},
      { label: '', divider: true },
      { label: '도움말', shortcut: 'F1', action: () => {
        setActiveMenu(null);
        showHelpDialog();
      }},
      { label: '오픈한글 AI 정보', action: () => {
        setActiveMenu(null);
        toast('오픈한글 AI React v3.0.0\nAI 기반 한글 문서 편집기\n\n964 Tests Passing | TypeScript + React 19', { duration: 5000 });
      }},
    ],
  };

  return (
    <div ref={menuRef} className="hwp-menubar">
      <input ref={fileInputRef} type="file" accept=".hwpx,.hwp,.md" onChange={handleFileChange} style={{ display: 'none' }} />
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="hwp-menu-item-wrapper">
          <button
            className={`hwp-menu-trigger ${activeMenu === name ? 'active' : ''}`}
            onClick={() => setActiveMenu(activeMenu === name ? null : name)}
            onMouseEnter={() => { if (activeMenu) setActiveMenu(name); }}
          >
            {name}
          </button>
          {activeMenu === name && (
            <div className="hwp-menu-dropdown">
              {items.map((item, idx) =>
                item.divider ? (
                  <div key={idx} className="hwp-menu-divider" />
                ) : (
                  <button
                    key={idx}
                    className={`hwp-menu-option ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => item.action?.()}
                    disabled={item.disabled}
                  >
                    <span className="hwp-menu-label">{item.label}</span>
                    {item.shortcut && <span className="hwp-menu-shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Home
// ============================================================================

function RibbonHome({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;
  const [textColor, setTextColor] = useState('#000000');
  const [highlightColor, setHighlightColor] = useState('#ffff00');

  // Selection 저장/복원 (select, color input 등 포커스 탈취 시 사용)
  const savedSelectionRef = useRef<Range | null>(null);
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);
  const restoreSelection = useCallback((): boolean => {
    const range = savedSelectionRef.current;
    if (!range) return false;
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
    savedSelectionRef.current = null;
    return true;
  }, []);

  // contentEditable 내 selection이 있는지 확인하는 헬퍼
  const getEditableSelection = useCallback((): { sel: Selection; editable: Element } | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;
    const anchor = sel.anchorNode;
    const editable = anchor && (anchor instanceof HTMLElement ? anchor : anchor.parentElement)?.closest('[contenteditable="true"]');
    return editable ? { sel, editable } : null;
  }, []);

  // 선택 영역을 span으로 래핑하는 헬퍼 (execCommand 대신 직접 래핑)
  const wrapSelectionWithStyle = useCallback((style: Record<string, string>) => {
    const ctx = getEditableSelection();
    if (!ctx) return;
    const range = ctx.sel.getRangeAt(0);
    const span = document.createElement('span');
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      // 복잡한 선택(여러 노드 걸친 경우) → extractContents + wrap
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    // 래핑 후 선택 영역 복원
    ctx.sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    ctx.sel.addRange(newRange);
  }, [getEditableSelection]);

  // Bold/Italic/Underline/Strikethrough
  const execFormat = useCallback((format: string) => {
    const execMap: Record<string, string> = { bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strikeThrough' };
    const ctx = getEditableSelection();
    if (ctx) {
      document.execCommand(execMap[format], false);
    } else {
      // rangeManager 기반 (기존 문서 편집 시)
      const cmd = v?.command;
      if (cmd) {
        if (format === 'bold') cmd.bold();
        else if (format === 'italic') cmd.italic();
        else if (format === 'underline') cmd.underline();
        else if (format === 'strikethrough') cmd.strikethrough();
      }
    }
  }, [v, getEditableSelection]);

  // Font family change
  const handleFontChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const fontFamily = e.target.value;
    restoreSelection();
    const ctx = getEditableSelection();
    if (ctx) {
      wrapSelectionWithStyle({ fontFamily });
    } else {
      v?.command?.setFontFamily(fontFamily);
    }
  }, [v, restoreSelection, getEditableSelection, wrapSelectionWithStyle]);

  // Font size change (span wrapping - font 태그 사용 안 함)
  const handleSizeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const size = e.target.value;
    restoreSelection();
    const ctx = getEditableSelection();
    if (ctx) {
      wrapSelectionWithStyle({ fontSize: `${size}pt` });
    } else {
      v?.command?.setFontSize(parseInt(size));
    }
  }, [v, restoreSelection, getEditableSelection, wrapSelectionWithStyle]);

  // Alignment (contentEditable 부모 요소의 textAlign 직접 변경)
  const execAlign = useCallback((align: string) => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const node = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement;
      const editable = node?.closest('[contenteditable="true"]');
      if (editable) {
        (editable as HTMLElement).style.textAlign = align;
        return;
      }
    }
    const cmd = v?.command;
    if (cmd) {
      if (align === 'left') cmd.alignLeft();
      else if (align === 'center') cmd.alignCenter();
      else if (align === 'right') cmd.alignRight();
      else if (align === 'justify') cmd.alignJustify();
    }
  }, [v]);

  // Line spacing (contentEditable 부모의 lineHeight 직접 변경)
  const handleLineSpacing = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value) / 100;
    restoreSelection();
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const node = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement;
      const editable = node?.closest('[contenteditable="true"]');
      if (editable) {
        (editable as HTMLElement).style.lineHeight = String(value);
        return;
      }
    }
    v?.command?.lineSpacing?.(value) ?? v?.commandAdapt?.executeLineSpacing(value);
  }, [v, restoreSelection]);

  // Indent (contentEditable 부모의 paddingLeft 변경)
  const handleIndent = useCallback((delta: number) => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const node = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement;
      const editable = node?.closest('[contenteditable="true"]') as HTMLElement | null;
      if (editable) {
        const current = parseInt(editable.style.paddingLeft || '0');
        editable.style.paddingLeft = `${Math.max(0, current + delta * 20)}px`;
        return;
      }
    }
    if (delta > 0) v?.command?.increaseIndent?.() ?? v?.commandAdapt?.executeIncreaseIndent();
    else v?.command?.decreaseIndent?.() ?? v?.commandAdapt?.executeDecreaseIndent();
  }, [v]);

  // Text color
  const handleTextColor = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setTextColor(color);
    restoreSelection();
    const ctx = getEditableSelection();
    if (ctx) {
      document.execCommand('foreColor', false, color);
    } else {
      v?.command?.color?.(color) ?? v?.commandAdapt?.executeColor(color);
    }
  }, [v, restoreSelection, getEditableSelection]);

  // Highlight
  const handleHighlight = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setHighlightColor(color);
    restoreSelection();
    const ctx = getEditableSelection();
    if (ctx) {
      document.execCommand('hiliteColor', false, color);
    } else {
      v?.command?.highlight?.(color) ?? v?.commandAdapt?.executeHighlight(color);
    }
  }, [v, restoreSelection, getEditableSelection]);

  // 리본 패널 mousedown에서 포커스 탈취 방지
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'SELECT' || tag === 'OPTION') return;
    if ((e.target as HTMLInputElement).type === 'color') return;
    e.preventDefault();
  }, []);

  return (
    <div className="hwp-ribbon-panel" onMouseDown={preventFocusLoss}>
      {/* Font Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <select className="hwp-font-select" defaultValue="Malgun Gothic" title="글꼴" onMouseDown={saveSelection} onChange={handleFontChange}>
            <option value="Malgun Gothic">맑은 고딕</option>
            <option value="Batang">바탕</option>
            <option value="Dotum">돋움</option>
            <option value="Gulim">굴림</option>
            <option value="NanumGothic">나눔고딕</option>
            <option value="NanumMyeongjo">나눔명조</option>
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select className="hwp-size-select" defaultValue="10" title="글꼴 크기" onMouseDown={saveSelection} onChange={handleSizeChange}>
            {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => execFormat('bold')} title="굵게 (Ctrl+B)"><b>B</b></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('italic')} title="기울임 (Ctrl+I)"><i>I</i></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('underline')} title="밑줄 (Ctrl+U)"><u>U</u></button>
          <button className="hwp-ribbon-btn" onClick={() => execFormat('strikethrough')} title="취소선"><s>S</s></button>
          <span className="hwp-ribbon-sep" />
          <label className="hwp-ribbon-btn hwp-color-btn" title="글자 색">
            <span style={{ borderBottom: `3px solid ${textColor}` }}>A</span>
            <input type="color" value={textColor} onFocus={saveSelection} onChange={handleTextColor} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </label>
          <label className="hwp-ribbon-btn hwp-color-btn" title="강조 색">
            <span style={{ background: highlightColor, padding: '0 3px' }}>ab</span>
            <input type="color" value={highlightColor} onFocus={saveSelection} onChange={handleHighlight} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          </label>
        </div>
        <div className="hwp-ribbon-group-label">글꼴</div>
      </div>

      {/* Paragraph Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => execAlign('left')} title="왼쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M1 5h8M1 8h12M1 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('center')} title="가운데 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M3 5h8M1 8h12M4 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('right')} title="오른쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M1 8h12M7 11h6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => execAlign('justify')} title="양쪽 정렬">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M1 5h12M1 8h12M1 11h12" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-row">
          <select className="hwp-lineheight-select" defaultValue="160" title="줄 간격" onMouseDown={saveSelection} onChange={handleLineSpacing}>
            <option value="100">100%</option>
            <option value="130">130%</option>
            <option value="160">160%</option>
            <option value="200">200%</option>
            <option value="250">250%</option>
            <option value="300">300%</option>
          </select>
          <button className="hwp-ribbon-btn" onClick={() => handleIndent(-1)} title="들여쓰기 감소">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M5 8h8M1 11h12M3 4l-2 2.5L3 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => handleIndent(1)} title="들여쓰기 증가">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12M5 5h8M5 8h8M1 11h12M1 4l2 2.5L1 9" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">단락</div>
      </div>

      {/* Edit Group */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => v?.command?.undo() ?? v?.historyManager?.undo()} title="실행 취소 (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 5l-2 2 2 2M1 7h8a3 3 0 0 1 0 6H7" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => v?.command?.redo() ?? v?.historyManager?.redo()} title="다시 실행 (Ctrl+Y)">
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 5l2 2-2 2M13 7H5a3 3 0 0 0 0 6h2" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn" onClick={() => v?.searchDialog?.show?.()} title="찾기 (Ctrl+F)">
            <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" fill="none"/><path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.4"/></svg>
          </button>
          <button className="hwp-ribbon-btn" onClick={() => v?.clipboardManager?.copyFormat?.()} title="서식 복사 (Alt+C)">
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="3" y="1" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M5 4h4M5 7h4M5 10h2" stroke="currentColor" strokeWidth="1"/></svg>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">편집</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Insert (placeholder)
// ============================================================================

function RibbonInsert({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;

  const handleInsertTable = useCallback(() => {
    v?.commandAdapt?.executeInsertTable(3, 3);
  }, [v]);

  const handleInsertImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (ev: any) => {
      const file = ev.target?.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        await v?.commandAdapt?.executeInsertImage(url, { width: 300 });
      }
    };
    input.click();
  }, [v]);

  const handleBulletList = useCallback(() => {
    const ec = v?.inlineEditor?.editingCell;
    if (ec) { ec.focus(); setTimeout(() => document.execCommand('insertUnorderedList', false), 0); }
    else { v?.command?.bulletList('bullet'); }
  }, [v]);

  const handleNumberedList = useCallback(() => {
    const ec = v?.inlineEditor?.editingCell;
    if (ec) { ec.focus(); setTimeout(() => document.execCommand('insertOrderedList', false), 0); }
    else { v?.command?.numberedList('decimal'); }
  }, [v]);

  return (
    <div className="hwp-ribbon-panel">
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={handleInsertTable} title="표 삽입 (3x3)">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 7h18M1 13h18M7 1v18M13 1v18" stroke="currentColor" strokeWidth="1"/></svg>
            <span>표</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={handleInsertImage} title="그림 삽입">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="7" r="2" fill="currentColor"/><path d="M1 15l5-5 3 3 4-4 6 6" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span>그림</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.specialCharPicker?.open?.()} title="특수 문자 (Ctrl+F10)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="5" y="16" fontSize="16" fill="currentColor">&#937;</text></svg>
            <span>특수문자</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">삽입</div>
      </div>

      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={handleBulletList} title="글머리 기호">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="4" cy="5" r="2" fill="currentColor"/><path d="M9 5h9" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="10" r="2" fill="currentColor"/><path d="M9 10h9" stroke="currentColor" strokeWidth="1.5"/><circle cx="4" cy="15" r="2" fill="currentColor"/><path d="M9 15h9" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>글머리</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={handleNumberedList} title="번호 매기기">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="2" y="7" fontSize="7" fill="currentColor">1.</text><path d="M9 5h9" stroke="currentColor" strokeWidth="1.5"/><text x="2" y="12" fontSize="7" fill="currentColor">2.</text><path d="M9 10h9" stroke="currentColor" strokeWidth="1.5"/><text x="2" y="17" fontSize="7" fill="currentColor">3.</text><path d="M9 15h9" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>번호</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">목록</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - AI (unique feature)
// ============================================================================

function RibbonAI({ onToggleAI, showAIPanel }: { onToggleAI?: () => void; showAIPanel?: boolean }) {
  return (
    <div className="hwp-ribbon-panel">
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button
            className={`hwp-ribbon-btn-lg ${showAIPanel ? 'active' : ''}`}
            onClick={onToggleAI}
            title="AI 채팅 패널 열기/닫기"
          >
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 11l4 4 4-4" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="7" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="8" r="1" fill="currentColor"/></svg>
            <span>AI 채팅</span>
          </button>
          <button className="hwp-ribbon-btn-lg" title="AI 문서 생성" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 2l2 5h5l-4 3 1.5 5L10 12l-4.5 3L7 10 3 7h5z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span>AI 생성</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">AI 기능</div>
      </div>
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" title="템플릿 채우기" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 6h8M6 10h8M6 14h4" stroke="currentColor" strokeWidth="1"/><path d="M14 10l2 2-2 2" stroke="#2b579a" strokeWidth="1.5" fill="none"/></svg>
            <span>템플릿</span>
          </button>
          <button className="hwp-ribbon-btn-lg" title="문서 검증" disabled>
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="2" fill="none"/></svg>
            <span>검증</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">도구</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Format (서식)
// ============================================================================

function RibbonFormat({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;
  const cmd = v?.command;

  return (
    <div className="hwp-ribbon-panel">
      {/* Character Format */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('bold', false); else cmd?.bold(); }} title="굵게 (Ctrl+B)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="4" y="16" fontSize="16" fontWeight="bold" fill="currentColor">B</text></svg>
            <span>굵게</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('italic', false); else cmd?.italic(); }} title="기울임 (Ctrl+I)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="5" y="16" fontSize="16" fontStyle="italic" fill="currentColor">I</text></svg>
            <span>기울임</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('underline', false); else cmd?.underline(); }} title="밑줄 (Ctrl+U)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="4" y="14" fontSize="14" textDecoration="underline" fill="currentColor">U</text><path d="M3 18h14" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>밑줄</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('strikeThrough', false); else cmd?.strikethrough(); }} title="취소선">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="4" y="15" fontSize="15" fill="currentColor">S</text><path d="M2 10h16" stroke="currentColor" strokeWidth="1.2"/></svg>
            <span>취소선</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">글자 모양</div>
      </div>

      {/* Superscript/Subscript */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('superscript', false); else cmd?.superscript(); }} title="위 첨자">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="2" y="16" fontSize="14" fill="currentColor">X</text><text x="13" y="9" fontSize="9" fill="currentColor">2</text></svg>
            <span>위첨자</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const sel = window.getSelection(); if (sel && !sel.isCollapsed) document.execCommand('subscript', false); else cmd?.subscript(); }} title="아래 첨자">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="2" y="14" fontSize="14" fill="currentColor">X</text><text x="13" y="18" fontSize="9" fill="currentColor">2</text></svg>
            <span>아래첨자</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">첨자</div>
      </div>

      {/* Paragraph Format */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.textAlign = 'left'; else cmd?.alignLeft(); }} title="왼쪽 정렬">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 4h16M2 8h10M2 12h16M2 16h8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>왼쪽</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.textAlign = 'center'; else cmd?.alignCenter(); }} title="가운데 정렬">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 4h16M5 8h10M2 12h16M6 16h8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>가운데</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.textAlign = 'right'; else cmd?.alignRight(); }} title="오른쪽 정렬">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 4h16M8 8h10M2 12h16M10 16h8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>오른쪽</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.textAlign = 'justify'; else cmd?.alignJustify(); }} title="양쪽 정렬">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 4h16M2 8h16M2 12h16M2 16h16" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>양쪽</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">문단 정렬</div>
      </div>

      {/* Line Spacing */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.lineHeight = '1'; else v?.commandAdapt?.executeLineSpacing(1.0); }} title="줄 간격 100%">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 4h12M4 9h12M4 14h12" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 3v13" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 1"/></svg>
            <span>1.0</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.lineHeight = '1.6'; else v?.commandAdapt?.executeLineSpacing(1.6); }} title="줄 간격 160%">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 3h12M4 10h12M4 17h12" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 2v16" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 1"/></svg>
            <span>1.6</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => { const s = window.getSelection(); const n = s?.anchorNode instanceof HTMLElement ? s.anchorNode : s?.anchorNode?.parentElement; const e = n?.closest('[contenteditable="true"]') as HTMLElement; if (e) e.style.lineHeight = '2'; else v?.commandAdapt?.executeLineSpacing(2.0); }} title="줄 간격 200%">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 2h12M4 10h12M4 18h12" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 1v18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 1"/></svg>
            <span>2.0</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">줄 간격</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - Tools (도구)
// ============================================================================

function RibbonTools({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;

  return (
    <div className="hwp-ribbon-panel">
      {/* Find & Replace */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.searchDialog?.show?.()} title="찾기 (Ctrl+F)">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 12l5 5" stroke="currentColor" strokeWidth="2"/></svg>
            <span>찾기</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.searchDialog?.show?.('replace')} title="찾아 바꾸기 (Ctrl+H)">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5"/><path d="M12 5h5M12 8h5M12 14h5M12 17h5" stroke="currentColor" strokeWidth="1" opacity="0.5"/></svg>
            <span>바꾸기</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">찾기</div>
      </div>

      {/* Edit Mode */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.editModeManager?.toggleGlobalEditMode?.()} title="편집 모드 (Ctrl+E)">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 3l4 4-10 10H3v-4L13 3z" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M11 5l4 4" stroke="currentColor" strokeWidth="1"/></svg>
            <span>편집 모드</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.specialCharPicker?.open?.()} title="특수 문자 (Ctrl+F10)">
            <svg width="20" height="20" viewBox="0 0 20 20"><text x="4" y="16" fontSize="16" fill="currentColor">&#937;</text></svg>
            <span>특수문자</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">편집</div>
      </div>

      {/* Clipboard */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.clipboardManager?.copyFormat?.()} title="서식 복사 (Alt+C)">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="2" width="12" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M7 6h6M7 9h6M7 12h3" stroke="currentColor" strokeWidth="1"/><path d="M2 7h3M2 10h3" stroke="#2b579a" strokeWidth="1.5"/></svg>
            <span>서식 복사</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.clipboardManager?.pasteFormat?.()} title="서식 붙여넣기">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="2" width="12" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M7 6h6M7 9h6M7 12h3" stroke="currentColor" strokeWidth="1"/><path d="M15 10l3 3-3 3" stroke="#2b579a" strokeWidth="1.5" fill="none"/></svg>
            <span>서식 붙이기</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">서식</div>
      </div>

      {/* Undo / Redo */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.command?.undo() ?? v?.historyManager?.undo()} title="실행 취소 (Ctrl+Z)">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M5 7l-3 3 3 3M2 10h11a4 4 0 0 1 0 8H9" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>실행 취소</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.command?.redo() ?? v?.historyManager?.redo()} title="다시 실행 (Ctrl+Y)">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M15 7l3 3-3 3M18 10H7a4 4 0 0 0 0 8h4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>다시 실행</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">실행취소</div>
      </div>
    </div>
  );
}

// ============================================================================
// Ribbon Tab Content - View (보기)
// ============================================================================

function RibbonView({ viewer }: { viewer?: HWPXViewerInstance | null }) {
  const v = viewer as any;
  const [zoom, setZoom] = useState(100);

  const applyZoom = useCallback((z: number) => {
    const clamped = Math.min(400, Math.max(25, z));
    setZoom(clamped);
    const container = document.querySelector('.hwpx-viewer-wrapper') as HTMLElement;
    if (container) {
      const pages = container.querySelectorAll('.hwp-page-container') as NodeListOf<HTMLElement>;
      pages.forEach(page => {
        page.style.transform = `scale(${clamped / 100})`;
        page.style.transformOrigin = 'top center';
      });
    }
  }, []);

  return (
    <div className="hwp-ribbon-panel">
      {/* Zoom */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(zoom - 25)} title="축소">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M13 13l5 5" stroke="currentColor" strokeWidth="2"/><path d="M5 8h6" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>축소</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(100)} title="100%">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/><text x="5" y="14" fontSize="9" fill="currentColor">100</text></svg>
            <span>{zoom}%</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(zoom + 25)} title="확대">
            <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none"/><path d="M13 13l5 5" stroke="currentColor" strokeWidth="2"/><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5"/></svg>
            <span>확대</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">배율</div>
      </div>

      {/* Preset Zoom */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(75)} title="75%">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="4" y="3" width="12" height="14" rx="1" stroke="currentColor" strokeWidth="1" fill="none"/></svg>
            <span>75%</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(100)} title="100%">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            <span>100%</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(150)} title="150%">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="1" y="1" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
            <span>150%</span>
          </button>
          <button className="hwp-ribbon-btn-lg" onClick={() => applyZoom(200)} title="200%">
            <svg width="20" height="20" viewBox="0 0 20 20"><rect x="0" y="0" width="20" height="20" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            <span>200%</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">빠른 배율</div>
      </div>

      {/* Edit Mode */}
      <div className="hwp-ribbon-group">
        <div className="hwp-ribbon-row">
          <button className="hwp-ribbon-btn-lg" onClick={() => v?.editModeManager?.toggleGlobalEditMode?.()} title="편집 모드 전환 (Ctrl+E)">
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M13 3l4 4-10 10H3v-4L13 3z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
            <span>편집 모드</span>
          </button>
        </div>
        <div className="hwp-ribbon-group-label">모드</div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const HangulStyleToolbar = memo(function HangulStyleToolbar({
  viewer,
  onFileSelect,
  onToggleAI,
  showAIPanel,
}: HangulStyleToolbarProps) {
  const [activeTab, setActiveTab] = useState<RibbonTab>('home');

  const tabs: { id: RibbonTab; label: string }[] = [
    { id: 'home', label: '홈' },
    { id: 'insert', label: '삽입' },
    { id: 'format', label: '서식' },
    { id: 'tools', label: '도구' },
    { id: 'view', label: '보기' },
    { id: 'ai', label: 'AI' },
  ];

  const renderTabContent = (): ReactNode => {
    switch (activeTab) {
      case 'home': return <RibbonHome viewer={viewer} />;
      case 'insert': return <RibbonInsert viewer={viewer} />;
      case 'ai': return <RibbonAI onToggleAI={onToggleAI} showAIPanel={showAIPanel} />;
      case 'format': return <RibbonFormat viewer={viewer} />;
      case 'tools': return <RibbonTools viewer={viewer} />;
      case 'view': return <RibbonView viewer={viewer} />;
      default: return null;
    }
  };

  return (
    <div className="hwp-toolbar-root">
      {/* Menu Bar */}
      <MenuBar viewer={viewer} onFileSelect={onFileSelect} />

      {/* Ribbon Tabs */}
      <div className="hwp-ribbon-tabs" role="tablist" onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const idx = tabs.findIndex(t => t.id === activeTab);
          const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
          setActiveTab(tabs[next].id);
          (e.currentTarget.children[next] as HTMLElement)?.focus();
        }
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`hwp-ribbon-tab ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'ai' ? 'ai-tab' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ribbon Content */}
      <div className="hwp-ribbon-content">
        {renderTabContent()}
      </div>
    </div>
  );
});

export default HangulStyleToolbar;
