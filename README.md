# HAN-View React

> 웹 기반 HWPX (한컴 워드 프로세서 XML) 뷰어 & AI 문서 편집기

[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.2.4-646cff.svg)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-Commercial-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-success.svg)](CHANGELOG.md)
[![Tests](https://img.shields.io/badge/E2E_Tests-55_Passing-brightgreen.svg)](https://github.com)
[![Unit Tests](https://img.shields.io/badge/Unit_Tests-227_Passing-brightgreen.svg)](https://github.com)

---

## 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [문서](#문서)
- [아키텍처](#아키텍처)
- [빠른 시작](#빠른-시작)
- [사용 가이드](#사용-가이드)
- [사용 예제](#사용-예제)
- [키보드 단축키](#키보드-단축키)
- [개발](#개발)
- [테스트](#테스트)
- [배포](#배포)
- [트러블슈팅](#트러블슈팅)
- [FAQ](#faq)
- [보안](#보안)
- [기여 가이드](#기여-가이드)
- [성능 최적화](#성능-최적화)
- [버전 히스토리](#버전-히스토리)
- [라이선스](#라이선스)

---

## 개요

**HAN-View React v2.0.0**은 한컴 문서(HWPX)를 웹 브라우저에서 보고 편집할 수
있는 전문 뷰어/에디터입니다.

### 핵심 기능

- HWPX 문서 파싱 및 렌더링
- 인라인 편집 (셀, 표, 텍스트)
- GPT-4 기반 AI 문서 생성
- HWPX/PDF 내보내기
- 자동 저장 및 버전 관리

---

## 주요 기능

### 문서 뷰어

| 기능              | 설명                                     |
| ----------------- | ---------------------------------------- |
| HWPX 파싱         | 한컴 문서 완벽 지원                      |
| 드래그앤드롭      | 파일을 끌어다 놓으면 바로 열기           |
| 가상 스크롤링     | 대용량 문서 지원                         |
| 페이지 네비게이션 | 첫 페이지/마지막 페이지/특정 페이지 이동 |
| 인쇄              | Ctrl+P로 문서 인쇄                       |
| PDF 내보내기      | 문서를 PDF로 저장                        |

### 인라인 편집

| 기능        | 설명                            |
| ----------- | ------------------------------- |
| 셀 편집     | 클릭으로 테이블 셀 직접 편집    |
| 테이블 편집 | 행/열 추가/삭제 (우클릭 메뉴)   |
| 텍스트 서식 | 볼드, 이탤릭, 밑줄, 글꼴 크기   |
| 클립보드    | 복사/붙여넣기 지원              |
| Undo/Redo   | Ctrl+Z / Ctrl+Y (1ms 미만 성능) |
| 자동저장    | 30초 간격 IndexedDB 저장        |
| 충돌 복구   | 비정상 종료 시 자동 복구 제안   |

### AI 문서 편집

| 기능           | 설명                           |
| -------------- | ------------------------------ |
| GPT-4 연동     | OpenAI API로 지능형 편집       |
| 문서 구조 인식 | 헤더-내용 쌍 자동 감지         |
| 템플릿 생성    | 문서 구조만 추출               |
| 셀 선택 모드   | 유지/수정/생성 셀 선택         |
| 외부 API 연동  | JSON 데이터로 문서 자동 채우기 |

### 검색 기능

| 기능        | 설명                     |
| ----------- | ------------------------ |
| 빠른 검색   | Ctrl+F로 검색창 열기     |
| 정규식 지원 | 고급 검색 패턴           |
| 하이라이팅  | 검색 결과 시각적 표시    |
| 탐색        | Enter/Shift+Enter로 이동 |

### UI/UX

| 기능             | 설명                  |
| ---------------- | --------------------- |
| 다크/라이트 테마 | 시스템 설정 자동 감지 |
| 북마크           | 페이지 북마크 저장    |
| 컨텍스트 메뉴    | 우클릭으로 빠른 액션  |
| 토스트 알림      | 사용자 피드백         |
| 에러 바운더리    | 안정적인 에러 처리    |

---

## 기술 스택

### 핵심 기술

| 기술            | 버전    | 용도                      |
| --------------- | ------- | ------------------------- |
| React           | 19.2.0  | UI 프레임워크             |
| TypeScript      | 5.9.3   | 타입 안전성 (Strict 모드) |
| Vite            | 7.2.4   | 빌드 도구 (HMR 지원)      |
| Zustand         | 5.0.9   | 상태 관리                 |
| JSZip           | 3.10.1  | HWPX 파일 처리            |
| Lucide React    | 0.555.0 | 아이콘                    |
| React Hot Toast | 2.6.0   | 토스트 알림               |

### 개발 도구

| 기술       | 버전   | 용도        |
| ---------- | ------ | ----------- |
| Playwright | 1.57.0 | E2E 테스트  |
| Vitest     | 4.0.15 | 단위 테스트 |
| ESLint     | 9.39.1 | 코드 린팅   |
| Prettier   | 3.8.0  | 코드 포맷팅 |
| Husky      | 9.1.7  | Git 훅      |
| Terser     | 5.44.1 | 코드 압축   |

### 빌드 설정

- **Target**: ES2022 (TypeScript) / ES2020 (Vite)
- **Module**: ESNext
- **Minification**: Terser (console.log 제거)
- **Chunk 전략**: 11개 청크 분리
  - Vendor: `vendor-react`, `vendor-icons`, `vendor-ui`, `vendor`
  - Library: `lib-jszip`
  - Core: `core-viewer`, `core-utils`
  - Feature: `feature-ai`, `feature-export`, `feature-ui`, `feature-ui-editors`

---

## 프로젝트 구조

```
hanview-react-app/
├── src/
│   ├── components/                 # React 컴포넌트
│   │   ├── HWPXViewerWrapper.tsx      # Vanilla JS 래퍼
│   │   ├── SimpleHeader.tsx           # 헤더 (파일 열기, 저장, 내보내기)
│   │   ├── UndoRedoButtons.tsx        # Undo/Redo UI
│   │   ├── ErrorBoundary.tsx          # 에러 처리
│   │   ├── layout/                    # 레이아웃 컴포넌트
│   │   └── ui/                        # UI 컴포넌트
│   │
│   ├── contexts/                   # React Context
│   │   ├── HistoryContext.tsx         # Undo/Redo 상태
│   │   └── HanViewContext.tsx         # 뷰어 컨텍스트
│   │
│   ├── hooks/                      # 커스텀 훅
│   │   ├── useHistory.ts              # 히스토리 관리
│   │   ├── useAutoSave.ts             # 자동 저장
│   │   └── useContextMenu.ts          # 컨텍스트 메뉴
│   │
│   ├── stores/                     # Zustand 스토어
│   │   ├── documentStore.ts           # 문서 상태
│   │   ├── uiStore.ts                 # UI 상태
│   │   ├── aiStore.ts                 # AI 작업 상태
│   │   ├── cellSelectionStore.ts      # 셀 선택 상태
│   │   ├── editingStore.ts            # 편집 상태
│   │   └── templateStore.ts           # 템플릿 관리
│   │
│   ├── lib/                        # 비즈니스 로직
│   │   └── vanilla/                   # Vanilla JS 코어
│   │       ├── viewer.js                 # 메인 뷰어 클래스
│   │       ├── core/                     # 파서, 렌더러
│   │       │   ├── parser.js
│   │       │   ├── renderer.js
│   │       │   └── constants.js
│   │       ├── features/                 # 기능 모듈
│   │       │   ├── history-manager-v2.js
│   │       │   ├── inline-editor.js
│   │       │   ├── table-editor.js
│   │       │   ├── autosave-manager.js
│   │       │   ├── advanced-search.js
│   │       │   └── cell-selector.js
│   │       ├── ai/                       # AI 모듈 (lazy-load)
│   │       │   ├── ai-controller.js
│   │       │   ├── gpt-content-generator.js
│   │       │   └── structure-extractor.js
│   │       ├── export/                   # 내보내기 (lazy-load)
│   │       │   ├── hwpx-safe-exporter.js
│   │       │   └── pdf-exporter.js
│   │       ├── ui/                       # UI 모듈
│   │       │   ├── chat-panel.js
│   │       │   ├── context-menu.js
│   │       │   └── theme-manager.js
│   │       └── utils/                    # 유틸리티
│   │           ├── logger.js
│   │           └── error-boundary.js
│   │
│   ├── styles/                     # 스타일
│   │   └── vanilla/                   # Vanilla JS 스타일
│   │       ├── viewer.css
│   │       ├── variables.css
│   │       └── ai-chat.css
│   │
│   ├── types/                      # TypeScript 타입
│   │   ├── hwpx.d.ts
│   │   ├── viewer.d.ts
│   │   └── vanilla-modules.d.ts
│   │
│   ├── App.tsx                     # 루트 컴포넌트
│   └── main.tsx                    # 엔트리 포인트
│
├── tests/                          # E2E 테스트
├── docs/                           # 문서
├── public/                         # 정적 자산
│
├── package.json
├── vite.config.ts
├── tsconfig.json
├── playwright.config.js
├── Dockerfile
└── docker-compose.yml
```

### 핵심 파일

| 파일                           | 라인 수 | 역할                     |
| ------------------------------ | ------- | ------------------------ |
| viewer.js                      | ~2,000  | 메인 뷰어 오케스트레이터 |
| core/parser.js                 | ~1,500  | HWPX 파일 파싱           |
| core/renderer.js               | ~1,200  | 문서 렌더링              |
| features/inline-editor.js      | 1,238   | 인라인 편집              |
| ai/ai-controller.js            | 1,399   | AI 기능                  |
| export/hwpx-safe-exporter.js   | ~3,000  | HWPX 내보내기            |
| features/history-manager-v2.js | 401     | Undo/Redo 시스템         |

---

## 문서

| 가이드                                            | 설명             |
| ------------------------------------------------- | ---------------- |
| [커스터마이징](docs/CUSTOMIZATION.md)             | UI/UX 테마 설정  |
| [Cursor 시스템](docs/cursor-guide.md)             | 텍스트 커서 관리 |
| [Command Pattern](docs/command-pattern-guide.md)  | Undo/Redo 구현   |
| [RangeManager](docs/range-manager-guide.md)       | 텍스트 선택 관리 |
| [PositionManager](docs/position-manager-guide.md) | 위치 추적 시스템 |
| [Clipboard](docs/clipboard-guide.md)              | 복사/붙여넣기    |
| [Text Input](docs/text-input-commands.md)         | 텍스트 입력 처리 |

### 추가 문서

| 문서                                                     | 설명                |
| -------------------------------------------------------- | ------------------- |
| [API Reference](API_REFERENCE.md)                        | 전체 API 레퍼런스   |
| [CHANGELOG](CHANGELOG.md)                                | 버전 변경 이력      |
| [Developer Guide](DEVELOPER_GUIDE.md)                    | 개발자 가이드       |
| [Deployment Guide](DEPLOYMENT_GUIDE.md)                  | 배포 가이드         |
| [Docker Instructions](DOCKER_DEPLOYMENT_INSTRUCTIONS.md) | Docker 배포 방법    |
| [CSP Security](CSP_SECURITY_GUIDE.md)                    | 보안 헤더 설정      |
| [환경 변수 가이드](ENV_VARIABLES_GUIDE.md)               | 환경 변수 상세 설명 |

---

## 아키텍처

### 계층 구조

```
┌─────────────────────────────────────────────┐
│            React Components Layer           │
│   (HWPXViewerWrapper, Headers, Buttons)     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          Zustand State Management           │
│   (documentStore, uiStore, aiStore)         │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           Vanilla JS Core Layer             │
│   (Viewer, Parser, Renderer, Features)      │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Browser APIs & External Services       │
│   (DOM, IndexedDB, OpenAI API, JSZip)       │
└─────────────────────────────────────────────┘
```

### 데이터 흐름

```
파일 업로드
    ↓
HWPXViewerWrapper (React)
    ↓
HWPXViewer (Vanilla JS)
    ├→ SimpleHWPXParser (HWPX → JSON)
    ├→ DocumentRenderer (JSON → HTML)
    ├→ HistoryManagerV2 (변경 추적)
    ├→ InlineEditor (편집 처리)
    └→ AIController (AI 콘텐츠 생성)
        ↓
    React State (documentStore)
        ↓
    UI 리렌더링
```

### 디자인 패턴

| 패턴           | 적용 위치                               |
| -------------- | --------------------------------------- |
| MVC            | Parser (M) → Renderer (V) → Viewer (C)  |
| Command        | HistoryManagerV2 (execute/undo 함수)    |
| Observer       | Zustand 스토어 → React 컴포넌트         |
| Lazy Loading   | AI/Export 모듈 동적 로딩                |
| Error Boundary | React ErrorBoundary + withErrorBoundary |
| Factory        | 요소 렌더러 (paragraph, table, image)   |
| Singleton      | Logger, ThemeManager                    |

---

## 빠른 시작

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (선택)
cp .env.example .env.local

# 개발 서버 실행 (포트: 5090)
npm run dev

# 프로덕션 빌드
npm run build
```

### 환경 변수

AI 기능을 사용하려면 OpenAI API 키가 필요합니다.

**방법 1: 환경 변수 파일**

```bash
# .env.local 생성
VITE_OPENAI_API_KEY=sk-your-api-key-here
```

**방법 2: UI에서 입력**

개발 서버 실행 후 채팅 패널에서 "API 키 설정" 버튼 클릭

**방법 3: 서버 환경 변수**

```bash
# Docker
docker run -e VITE_OPENAI_API_KEY=sk-... my-app

# Vercel/Netlify
# Dashboard → Settings → Environment Variables
```

### 주요 환경 변수

| 변수                    | 개발                | 프로덕션 | 설명                |
| ----------------------- | ------------------- | -------- | ------------------- |
| VITE_LOG_LEVEL          | debug               | error    | 로그 레벨           |
| VITE_ENABLE_CONSOLE_LOG | true                | false    | 콘솔 로그 활성화    |
| VITE_ENABLE_AI_FEATURES | true                | true     | AI 기능 활성화      |
| VITE_OPENAI_MODEL       | gpt-4-turbo-preview | -        | GPT 모델            |
| VITE_MAX_FILE_SIZE_MB   | 50                  | 50       | 최대 파일 크기      |
| VITE_PORT               | 5090                | -        | 개발 서버 포트      |
| VITE_AUTO_SAVE_INTERVAL | 30000               | 30000    | 자동 저장 간격 (ms) |

---

## 사용 가이드

### 기본 사용

1. **파일 열기**: 드래그앤드롭 또는 Ctrl+O
2. **문서 편집**: 셀 클릭으로 직접 편집
3. **저장**: Ctrl+S (자동저장 30초마다 동작)

### AI 문서 편집

1. 우측 하단 채팅 버튼으로 AI 패널 열기
2. API 키 설정 버튼으로 OpenAI API 키 입력
3. 요청 입력:
   - "가을 소풍 주제로 내용을 바꿔줘"
   - "초등학생이 이해할 수 있게 쉽게 바꿔줘"
4. 결과 확인 후 Ctrl+S로 저장

### 셀 선택 모드 (표 문서)

1. "셀 선택" 버튼 클릭
2. 유지할 셀 선택 (헤더, 제목 등)
3. 모드 설정:
   - 자동: AI가 판단
   - 유지: 원본 유지
   - 수정: 편집 가능
   - 생성: AI가 생성
4. AI 요청 입력 후 생성

### 외부 API 연동

1. "외부 API" 버튼 클릭
2. API URL 입력
3. 필드 매핑 설정 (선택)
4. "적용" 버튼으로 문서에 데이터 채우기

---

## 사용 예제

### Zustand 스토어 사용

```tsx
import { useDocumentStore } from './stores/documentStore';

function DocumentViewer() {
  const { document, isLoading, error } = useDocumentStore();

  if (isLoading) return <div>로딩 중...</div>;
  if (error) return <div>오류: {error.message}</div>;

  return <div>{document?.title}</div>;
}
```

### History Context (Undo/Redo)

```tsx
import { useHistory } from './contexts/HistoryContext';

function UndoRedoButtons() {
  const { canUndo, canRedo, undo, redo, historyCount } = useHistory();

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>
        실행취소
      </button>
      <button onClick={redo} disabled={!canRedo}>
        다시실행
      </button>
      <span>히스토리: {historyCount}개</span>
    </div>
  );
}
```

### 커스텀 훅 사용

```tsx
import { useAutoSave } from './hooks/useAutoSave';
import { useContextMenu } from './hooks/useContextMenu';

function Editor({ viewerRef }) {
  // 30초마다 자동 저장
  useAutoSave(viewerRef, { interval: 30000 });

  // 컨텍스트 메뉴 설정
  const { menuItems, showMenu } = useContextMenu({
    onCopy: () => console.log('복사'),
    onPaste: () => console.log('붙여넣기'),
  });

  return <div onContextMenu={showMenu}>...</div>;
}
```

### HWPXViewer 직접 사용

```tsx
import { useRef, useEffect } from 'react';
import { HWPXViewer } from './lib/vanilla/viewer';

function CustomViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HWPXViewer | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      viewerRef.current = new HWPXViewer(containerRef.current, {
        enableEditing: true,
        enableAI: true,
        autoSave: true,
      });
    }

    return () => viewerRef.current?.destroy();
  }, []);

  const handleFileLoad = async (file: File) => {
    await viewerRef.current?.loadFile(file);
  };

  return <div ref={containerRef} />;
}
```

---

## 키보드 단축키

| 단축키           | 기능                    |
| ---------------- | ----------------------- |
| Ctrl + O         | 파일 열기               |
| Ctrl + S         | HWPX 저장               |
| Ctrl + P         | 인쇄                    |
| Ctrl + F         | 검색                    |
| Ctrl + Z         | 실행취소                |
| Ctrl + Y         | 다시실행                |
| Ctrl + Shift + Z | 다시실행 (대체)         |
| Escape           | 검색창 닫기 / 편집 취소 |
| Enter            | 다음 검색 결과          |
| Shift + Enter    | 이전 검색 결과          |

---

## 개발

### 스크립트

```bash
npm run dev       # 개발 서버 (http://localhost:5090)
npm run build     # 프로덕션 빌드
npm run preview   # 빌드 미리보기
npm run lint      # ESLint 검사
npm run test      # 단위 테스트 실행
npm run test:e2e  # E2E 테스트 실행
```

### 디버그 모드

브라우저 콘솔에서 사용:

```javascript
// 페이지네이션 디버그 모드 활성화
window.viewer.renderer.enablePaginationDebug();

// 히스토리 상태 확인
window.viewer.historyManager.getStats();

// 더티 페이지 확인
console.log(window.viewer.renderer.dirtyPages);
```

---

## 테스트

### E2E 테스트 (Playwright)

**55개 테스트** - 크로스 브라우저 자동화

```bash
npm run test:e2e              # 모든 브라우저
npm run test:e2e:chromium     # Chrome/Edge
npm run test:e2e:firefox      # Firefox
npm run test:e2e:webkit       # Safari
npm run test:e2e:mobile       # Mobile Chrome + Safari
npm run test:e2e:ui           # UI 모드 (인터랙티브)
npm run test:e2e:headed       # 헤드 모드 (브라우저 표시)
```

**테스트 범위:**

- 페이지 로드 및 초기 렌더링 (8 tests)
- HWPX 파일 로딩 및 에러 처리 (7 tests)
- 보안 헤더 및 CSP 검증 (10 tests)
- 반응형 디자인 (13 tests)
- 접근성 WCAG 2.1 AA (17 tests)

**브라우저 지원:**

| 브라우저      | 통과율        | 상태      |
| ------------- | ------------- | --------- |
| Chrome/Edge   | 100% (55/55)  | 지원      |
| Firefox       | 100% (55/55)  | 지원      |
| Safari        | 83.6% (46/55) | 부분 지원 |
| Mobile Chrome | 100% (55/55)  | 지원      |
| Mobile Safari | 81.8% (45/55) | 부분 지원 |

### 단위 테스트 (Vitest)

**227개 테스트** - 핵심 기능 검증 (96개 테스트 스위트)

```bash
npm run test
```

**테스트 카테고리:**

| 모듈 | 테스트 수 | 설명 |
|------|-----------|------|
| format.test.js | 50 | 날짜/숫자 포맷팅 |
| logger.test.js | 34 | 로깅 시스템 |
| ui.test.js | 32 | UI 유틸리티 |
| error.test.js | 31 | 에러 처리 |
| constants.test.js | 29 | 상수 및 단위 변환 |
| numbering.test.js | 19 | 번호 매기기 |
| useAutoSave.test.ts | 18 | 자동 저장 훅 |
| parser.test.js | 14 | HWPX 파싱 |

### 성능 벤치마크

| 항목                  | 결과               |
| --------------------- | ------------------ |
| Undo/Redo 속도        | <1ms per operation |
| 타이핑 성능           | >30 FPS 유지       |
| 페이지네이션 오버헤드 | 90% 감소           |
| 메모리 누수           | 없음 (WeakMap GC)  |
| 동시 요청 처리        | 100+               |

---

## 배포

### Docker

```bash
# 이미지 빌드
docker build -t hanview-react:2.0.0 .

# 컨테이너 실행
docker run -d -p 8080:80 \
  -e VITE_OPENAI_API_KEY=sk-... \
  -e VITE_ENABLE_AI_FEATURES=true \
  --name hanview \
  hanview-react:2.0.0

# 컨테이너 상태 확인
docker ps
docker logs hanview

# 컨테이너 중지/삭제
docker stop hanview && docker rm hanview
```

### Docker Compose

```bash
# 실행 (백그라운드)
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 중지
docker-compose down
```

**docker-compose.yml 예시:**

```yaml
version: '3.8'
services:
  hanview:
    build: .
    ports:
      - '8080:80'
    environment:
      - VITE_OPENAI_API_KEY=${OPENAI_API_KEY}
      - VITE_ENABLE_AI_FEATURES=true
      - VITE_LOG_LEVEL=warn
    restart: unless-stopped
```

> 상세 Docker 배포 가이드:
> [DOCKER_DEPLOYMENT_INSTRUCTIONS.md](DOCKER_DEPLOYMENT_INSTRUCTIONS.md)

### 클라우드 플랫폼

**Vercel:**

1. GitHub 저장소 연결
2. Framework Preset: Vite
3. Environment Variables 설정
4. Deploy

**Netlify:**

1. GitHub 저장소 연결
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Environment Variables 설정

**AWS S3 + CloudFront:**

1. `npm run build`로 빌드
2. `dist/` 폴더를 S3에 업로드
3. CloudFront 배포 생성

### CI/CD (GitHub Actions)

모든 Push 및 Pull Request에서 자동 실행:

- Chromium 테스트
- Firefox 테스트
- WebKit 테스트 (선택)
- Mobile 테스트 (선택)

**특징:**

- 병렬 실행 (4개 작업 동시)
- 자동 테스트 리포트 생성
- 실패 시 스크린샷/비디오 자동 저장
- npm 캐싱으로 빠른 빌드

---

## 트러블슈팅

### 파일 로드 실패

**증상:** HWPX 파일이 열리지 않음

```
해결 방법:
1. 파일 확장자가 .hwpx인지 확인
2. 파일 크기가 50MB 이하인지 확인 (VITE_MAX_FILE_SIZE_MB)
3. 브라우저 콘솔에서 오류 메시지 확인
4. 파일이 손상되지 않았는지 한컴 오피스에서 열어 확인
```

### 한글 입력 문제

**증상:** 한글 입력 시 글자가 깨지거나 중복됨

```
해결 방법:
1. 최신 Chrome/Edge 브라우저 사용
2. IME (입력기) 설정 확인
3. compositionstart/compositionend 이벤트 처리 확인
4. 디버그 모드에서 입력 이벤트 로그 확인
```

### Undo/Redo 작동 안함

**증상:** Ctrl+Z/Y가 반응하지 않음

```
해결 방법:
1. 편집 모드가 활성화되어 있는지 확인
2. 브라우저 콘솔에서 히스토리 상태 확인:
   window.viewer.historyManager.getStats()
3. 변경 사항이 실제로 기록되었는지 확인
4. 포커스가 뷰어에 있는지 확인
```

### 포트 충돌

**증상:** 개발 서버 시작 실패 (EADDRINUSE)

```bash
# 포트 사용 프로세스 확인
lsof -i :5090

# 프로세스 종료
kill -9 <PID>

# 또는 다른 포트 사용
VITE_PORT=5091 npm run dev
```

### 디버그 모드 사용법

```javascript
// 브라우저 콘솔에서 실행

// 전체 뷰어 상태 확인
console.log(window.viewer);

// 히스토리 상태 확인
window.viewer.historyManager.getStats();

// 페이지네이션 디버그
window.viewer.renderer.enablePaginationDebug();

// 현재 문서 구조 확인
console.log(window.viewer.documentData);

// 더티 페이지 확인
console.log(window.viewer.renderer.dirtyPages);
```

---

## FAQ

### AI 기능을 비활성화하려면?

```bash
# 환경 변수 설정
VITE_ENABLE_AI_FEATURES=false
```

또는 빌드 시 AI 모듈을 제외하면 번들 크기를 줄일 수 있습니다.

### 지원하는 파일 형식은?

현재 **HWPX (한컴 워드 프로세서 XML)** 형식만 지원합니다.

- ✅ HWPX (지원)
- ❌ HWP (미지원 - 바이너리 형식)
- ❌ DOCX, PDF (미지원)

### 브라우저 호환성

| 브라우저      | 최소 버전 | 상태         |
| ------------- | --------- | ------------ |
| Chrome        | 90+       | ✅ 완전 지원 |
| Edge          | 90+       | ✅ 완전 지원 |
| Firefox       | 88+       | ✅ 완전 지원 |
| Safari        | 14+       | ⚠️ 부분 지원 |
| Mobile Chrome | 90+       | ✅ 완전 지원 |
| Mobile Safari | 14+       | ⚠️ 부분 지원 |

### 오프라인 사용이 가능한가요?

문서 뷰어와 편집 기능은 오프라인에서도 작동합니다. 단, AI 기능은 OpenAI API
연결이 필요합니다.

### 최대 파일 크기는?

기본값은 50MB입니다. `VITE_MAX_FILE_SIZE_MB` 환경 변수로 변경 가능합니다.

### 동시에 여러 문서를 열 수 있나요?

현재 버전은 한 번에 하나의 문서만 지원합니다. 여러 탭에서 각각 열 수는 있습니다.

---

## 보안

### Content Security Policy (CSP)

프로덕션 환경에서는 다음 CSP 헤더를 설정하세요:

```nginx
# nginx 설정 예시
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'self' https://api.openai.com;
  font-src 'self';
" always;
```

> 상세 가이드: [CSP_SECURITY_GUIDE.md](CSP_SECURITY_GUIDE.md)

### API 키 관리

⚠️ **중요**: API 키를 클라이언트에 노출하지 마세요.

**권장 방법:**

1. **서버 프록시 사용** (권장)

   ```
   클라이언트 → 서버 프록시 → OpenAI API
   ```

2. **환경 변수 암호화**

   ```bash
   VITE_ENABLE_API_KEY_ENCRYPTION=true
   ```

3. **사용자 입력** (개발용)
   - UI에서 직접 API 키 입력
   - 브라우저 메모리에만 저장

### HTTPS 강제

프로덕션에서는 반드시 HTTPS를 사용하세요:

```bash
# 환경 변수
VITE_FORCE_HTTPS=true
```

### 민감 파일 관리

다음 파일들은 절대 커밋하지 마세요:

- `.env.local`
- `.env.*.local`
- `credentials.json`
- `*.pem`, `*.key`

---

## 기여 가이드

### 개발 환경 설정

```bash
# 저장소 클론
git clone <repository-url>
cd hanview-react-app

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local

# 개발 서버 실행
npm run dev
```

### 커밋 규칙 (Conventional Commits)

```
<type>(<scope>): <subject>

<body>

<footer>
```

**타입:**

| 타입     | 설명                    |
| -------- | ----------------------- |
| feat     | 새로운 기능             |
| fix      | 버그 수정               |
| docs     | 문서 변경               |
| style    | 코드 스타일 (포맷팅 등) |
| refactor | 리팩토링                |
| test     | 테스트 추가/수정        |
| chore    | 빌드, 설정 변경         |

**예시:**

```bash
git commit -m "feat(editor): 이미지 리사이즈 기능 추가"
git commit -m "fix(parser): 빈 테이블 파싱 오류 수정"
git commit -m "docs(readme): 설치 가이드 업데이트"
```

### PR 프로세스

1. **Fork & Clone**
2. **Feature Branch 생성**
   ```bash
   git checkout -b feature/my-feature
   ```
3. **코드 작성 & 테스트**
   ```bash
   npm run lint
   npm run test
   npm run test:e2e
   ```
4. **커밋 & Push**
5. **Pull Request 생성**
   - 변경 사항 설명
   - 관련 이슈 링크
   - 스크린샷 (UI 변경 시)

### 코드 스타일

- **ESLint**: `npm run lint`로 검사
- **Prettier**: `npm run format`으로 자동 포맷팅
- **TypeScript**: Strict 모드 사용
- **Husky**: 커밋 전 자동 린트 실행

```bash
# 커밋 전 자동 실행되는 훅
npx husky install
```

---

## 성능 최적화

### Undo/Redo 시스템 (Phase 2)

| 최적화           | 효과                        |
| ---------------- | --------------------------- |
| Command Pattern  | 함수 기반으로 1ms 미만 성능 |
| WeakMap          | 자동 GC로 90% 메모리 절감   |
| Batch Operations | 다중 작업 시 90% 빠름       |
| React Context    | 자동 UI 업데이트            |

### 페이지네이션 (Phase 3-4)

| 최적화          | 효과                   |
| --------------- | ---------------------- |
| Pagination Lock | 재귀 호출 방지         |
| FIFO Queue      | 10ms 간격 순차 처리    |
| Debouncing      | 타이핑 시 500ms 지연   |
| Dirty Flags     | 편집된 페이지만 재계산 |

### 빌드 최적화

| 최적화         | 효과                         |
| -------------- | ---------------------------- |
| Tree Shaking   | 사용하지 않는 코드 제거      |
| Code Splitting | 청크 분리로 초기 로딩 최적화 |
| Minification   | Terser로 console.log 제거    |
| Lazy Loading   | AI/Export 모듈 동적 로딩     |

---

## 버전 히스토리

### v2.0.0 (Current)

- React 19 + TypeScript 마이그레이션
- Command Pattern 기반 Undo/Redo 재설계
- WeakMap 메모리 최적화
- 동적 페이지네이션 성능 개선
- Vanilla JS 뷰어 통합
- 드래그앤드롭, 키보드 단축키
- 자동저장 & 충돌 복구
- 테이블 편집, 컨텍스트 메뉴
- 에러 바운더리 및 프로덕션 로깅
- 43개 단위 테스트, 55개 E2E 테스트

### v1.0.0

- 초기 Vanilla JS 버전

---

## 라이선스

**Commercial License** - 상업용 라이선스

| 유형       | 프로젝트 | 개발자 | 지원          |
| ---------- | -------- | ------ | ------------- |
| Personal   | 1개      | 1명    | 이메일        |
| Team       | 5개      | 10명   | 이메일 + 채팅 |
| Enterprise | 무제한   | 무제한 | 우선 지원     |

### 문의

- 라이선스: license@ism-team.com
- 기술 지원: support@ism-team.com
- 웹사이트: https://ism-team.com

---

<div align="center">
  <strong>HAN-View React</strong> - 웹 기반 HWPX 뷰어 & AI 문서 편집기
  <br><br>
  Made by ISM Team
</div>
