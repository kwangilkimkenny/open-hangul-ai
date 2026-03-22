# HAN-View React

> AI 기반 한글 문서(HWP/HWPX) 편집기 — 웹 브라우저에서 한글 문서를 열고, 편집하고, AI로 업무를 자동화합니다.

[![React](https://img.shields.io/badge/React-19.2.0-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7.2.7-646cff.svg)](https://vitejs.dev)
[![Tests](https://img.shields.io/badge/Tests-964_Passing-brightgreen.svg)](https://github.com)
[![Version](https://img.shields.io/badge/Version-3.0.0-success.svg)](CHANGELOG.md)

---

## 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [빠른 시작](#빠른-시작)
- [기술 스택](#기술-스택)
- [프로젝트 구조](#프로젝트-구조)
- [기능 상세](#기능-상세)
- [AI 문서 어시스턴트](#ai-문서-어시스턴트)
- [키보드 단축키](#키보드-단축키)
- [환경 설정](#환경-설정)
- [테스트](#테스트)
- [배포](#배포)
- [보안](#보안)
- [라이선스](#라이선스)

---

## 개요

**HAN-View React v3.0.0**은 한컴 문서(HWP/HWPX)를 웹 브라우저에서 열고, 편집하고, AI로 업무를 자동화하는 문서 편집기입니다.

### 핵심 특징

- **HWP + HWPX 지원** — HWP(레거시 바이너리)를 브라우저에서 자동 변환하여 열기
- **완전한 텍스트 편집** — 서식, 정렬, 목록, 표, 이미지 삽입
- **AI 문서 어시스턴트** — GPT 기반 12개 업무 자동화 (요약, 메일 작성, 검토 의견 등)
- **자동 페이지 분할** — 내용이 넘치면 자동으로 다음 페이지 생성
- **자동 저장** — IndexedDB 기반 30초 간격 저장 + 크래시 복구
- **HWPX/PDF 내보내기** — 서식 보존 저장

---

## 주요 기능

### 파일 관리

| 기능 | 설명 |
|------|------|
| HWP 파일 열기 | 레거시 HWP 파일을 브라우저에서 자동 변환 후 열기 |
| HWPX 파일 열기 | 드래그 앤 드롭 또는 Ctrl+O로 열기 |
| 새 문서 생성 | Ctrl+N으로 빈 A4 문서 생성 |
| 저장 / 다른 이름으로 저장 | Ctrl+S로 HWPX 파일 다운로드 |
| PDF 내보내기 | 문서를 PDF로 변환 |
| 인쇄 | Ctrl+P로 인쇄 |

### 텍스트 편집

| 기능 | 설명 |
|------|------|
| 서식 적용 | 굵게, 기울임, 밑줄, 취소선, 위첨자, 아래첨자 |
| 글꼴 변경 | 글꼴 종류, 크기, 색상, 강조색 |
| 단락 서식 | 정렬(좌/중/우/양쪽), 줄 간격, 들여쓰기 |
| 목록 | 글머리 기호, 번호 매기기 |
| 자동 페이지 분할 | 내용이 페이지를 넘으면 자동 분할 |
| 페이지 병합 | 삭제로 내용이 줄면 자동 병합 |

### 삽입 기능

| 기능 | 설명 |
|------|------|
| 표 삽입 | 3x3 표 삽입 (행/열 추가/삭제) |
| 이미지 삽입 | 파일 선택 또는 드래그 앤 드롭 |
| 특수 문자 | 8개 카테고리 특수 문자 선택 |
| 페이지 나누기 | 수동 페이지 분할 |
| 머리글/바닥글 | 문서 상하단 텍스트 설정 |
| 각주 | 본문에 각주 삽입 |

### AI 기능

| 기능 | 설명 |
|------|------|
| AI 문서 편집 | 채팅으로 문서 내용 변경 요청 |
| 문서 구조 분석 | 헤더-내용 쌍 자동 감지 |
| 스타일 적용 | 격식체/친근체/교육용 등 5가지 스타일 |
| 템플릿 추출/채우기 | 문서 구조만 추출 또는 AI로 채우기 |
| AI 어시스턴트 | 12개 업무 자동화 퀵 액션 |

### 편집 도구

| 기능 | 설명 |
|------|------|
| 실행취소/다시실행 | Ctrl+Z / Ctrl+Y |
| 찾기/바꾸기 | Ctrl+F / Ctrl+H (정규식 지원) |
| 문서 검증 | 글자수, 단락수, 빈 단락 검사 |
| 서식 복사 | 서식 복사/붙이기 |

---

## 빠른 시작

### 설치

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 VITE_OPENAI_API_KEY=sk-... 추가 (AI 기능 사용 시)

# 개발 서버 실행 (포트: 5090)
npm run dev
```

### AI 기능 사용 (API 프록시)

```bash
# .env 파일에 API 키 설정
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# 프록시 서버 + 프론트엔드 동시 실행
npm run dev:full
```

### 프로덕션 빌드

```bash
npm run build      # 빌드
npm run preview    # 미리보기
```

### Docker

```bash
docker build -t hanview .
docker run -p 80:80 hanview
```

---

## 기술 스택

### 핵심 기술

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.2.0 | UI 프레임워크 |
| TypeScript | 5.9.3 | 타입 안전성 (Strict 모드) |
| Vite | 7.2.7 | 빌드 도구 |
| Zustand | 5.0.9 | 상태 관리 |
| JSZip | 3.10.1 | HWPX/HWP 파일 처리 |

### 개발 도구

| 기술 | 용도 |
|------|------|
| Vitest | 단위 테스트 (964개) |
| Playwright | E2E 테스트 (11개 파일) |
| ESLint + Prettier | 코드 품질 |
| Husky + lint-staged | Git 훅 |

### 번들 분석

| 청크 | 크기 (gzip) | 로딩 시점 |
|------|-------------|-----------|
| index.js | 18.6 KB | 즉시 |
| vendor-react.js | 77.9 KB | 즉시 |
| core-viewer.js | 68.5 KB | 문서 렌더링 시 |
| Hwp2Hwpx.js | 59.4 KB | HWP 파일 열 때만 |
| feature-ai.js | 24.4 KB | AI 패널 열 때만 |
| **초기 로드 합계** | **~113 KB** | |

---

## 프로젝트 구조

```
hanview-react-app/
├── src/
│   ├── components/              # React 컴포넌트
│   │   ├── HWPXViewerWrapper.tsx   # 메인 뷰어 래퍼
│   │   ├── HangulStyleToolbar.tsx  # 한글 스타일 리본 메뉴
│   │   ├── HangulStatusBar.tsx     # 상태바 (페이지/글자수/줌)
│   │   └── ErrorBoundary.tsx       # 에러 처리
│   │
│   ├── lib/
│   │   ├── vanilla/                # Vanilla JS 코어 엔진
│   │   │   ├── viewer.js              # 메인 뷰어 (2,000줄)
│   │   │   ├── core/                  # 파서, 렌더러
│   │   │   ├── features/              # 편집, 검색, 히스토리
│   │   │   ├── ai/                    # AI 컨트롤러 (lazy-load)
│   │   │   ├── export/                # HWPX/PDF 내보내기
│   │   │   ├── command/               # Command 패턴 API
│   │   │   └── ui/                    # 채팅패널, 컨텍스트메뉴
│   │   ├── i18n/                   # 국제화 (ko/en)
│   │   └── hwp-converter/          # HWP→HWPX 변환기
│   │
│   ├── stores/                  # Zustand 상태 관리
│   ├── styles/                  # CSS 스타일
│   └── App.tsx                  # 루트 컴포넌트
│
├── server/
│   └── proxy.js                 # AI API 프록시 서버
│
├── hwpTohwpx/                   # HWP→HWPX 변환기 소스
│   └── hpw2hwpx_converter/
│       ├── hwplib-js/              # OLE 파서 (HWP 바이너리)
│       └── hwp2hwpx-js/            # 변환 엔진
│
├── tests/e2e/                   # Playwright E2E 테스트
├── public/nginx.conf            # Nginx 설정 (Docker)
├── Dockerfile                   # Docker 빌드
└── .env.example                 # 환경 변수 템플릿
```

---

## 기능 상세

### HWP 파일 지원

HWP(레거시 바이너리) 파일을 브라우저에서 자동으로 HWPX로 변환합니다.

```
사용자가 .hwp 파일 선택
  → 매직바이트 검증 (D0 CF 11 E0)
  → Hwp2Hwpx.convert() (lazy-load, 59KB)
  → HWPX Blob 반환
  → 기존 파서로 렌더링
```

- **변환 정확도**: 텍스트 100%, 표 100%, 이미지 90%, 도형 95%
- **브라우저 전용**: 서버 없이 클라이언트에서 변환

### 자동 페이지 분할/병합

편집 중 내용이 페이지를 넘으면 자동 분할, 삭제로 줄면 자동 병합합니다.

- **분할**: 500ms 디바운스로 오버플로우 감지 → 넘치는 노드를 새 페이지로 이동
- **병합**: 페이지 내용이 30% 이하이면 이전 페이지로 병합 → 빈 페이지 제거

### 저장 품질

새 문서 저장 시 서식이 HWPX XML에 보존됩니다.

- **서식**: bold, italic, fontSize, color → `<hp:charPr>` 속성
- **이미지**: DOM `<img>` → ZIP `BinData/` 폴더
- **구조**: 표, 단락, 줄바꿈 → HWPX XML 정확 변환

---

## AI 문서 어시스턴트

AI 패널에서 **[도구]** 탭과 **[어시스턴트]** 탭을 전환하여 사용합니다.

### 도구 탭 (문서 편집)

| 버튼 | 기능 |
|------|------|
| 문서 구조 보기 | 헤더-내용 쌍 분석 |
| 스타일 적용 | 5가지 스타일 선택 적용 |
| 템플릿 추출 | 헤더만 남기고 내용 제거 |
| 템플릿 채우기 | AI로 전체 내용 생성 |
| 셀 선택 | 유지/수정/생성 셀 선택 |
| HWPX 저장 | 원본 기반 안전 저장 |

### 어시스턴트 탭 (업무 자동화)

| 카테고리 | 기능 |
|----------|------|
| **문서 분석** | 핵심 요약, 키워드 추출, 독자 수준 분석 |
| **업무 커뮤니케이션** | 전달 메일 작성, 보고 메일 작성, 회의록 변환 |
| **검토/피드백** | 검토 의견, 개선 제안, 액션 아이템 |
| **변환** | 쉽게 풀어쓰기, 공식 문서화, 영문 번역 |

어시스턴트는 **문서를 수정하지 않고** 분석 결과만 채팅으로 표시합니다.
결과에 **복사 버튼**이 제공되어 원클릭으로 클립보드에 복사할 수 있습니다.

---

## 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| Ctrl+N | 새 문서 |
| Ctrl+O | 열기 |
| Ctrl+S | 저장 |
| Ctrl+P | 인쇄 |
| Ctrl+Z | 실행 취소 |
| Ctrl+Y | 다시 실행 |
| Ctrl+B | 굵게 |
| Ctrl+I | 기울임 |
| Ctrl+U | 밑줄 |
| Ctrl+F | 찾기 |
| Ctrl+H | 바꾸기 |
| Ctrl+F10 | 특수 문자 |
| Enter | 줄바꿈 (단락) / 다음 셀 (표) |
| Escape | 편집 종료 |
| Tab / Shift+Tab | 다음/이전 요소 이동 |

---

## 환경 설정

### .env 파일

```bash
# AI 기능 (필수)
VITE_OPENAI_API_KEY=sk-your-key-here

# AI 모델 설정
VITE_OPENAI_MODEL=gpt-4-turbo-preview
VITE_OPENAI_TEMPERATURE=0.7
VITE_OPENAI_MAX_TOKENS=4000

# API 프록시 (선택 — 프록시 서버 사용 시)
VITE_API_PROXY_URL=http://localhost:3001/api/ai/chat

# 기능 플래그
VITE_ENABLE_AI_FEATURES=true
VITE_ENABLE_AUTO_SAVE=true
VITE_AUTO_SAVE_INTERVAL=30000
```

### API 키 관리 방식

| 방식 | 설정 | 보안 |
|------|------|------|
| **.env 직접** | `VITE_OPENAI_API_KEY=sk-...` | 개발용 (빌드에 포함됨) |
| **프록시 서버** | `npm run proxy` + `OPENAI_API_KEY=sk-...` | 프로덕션 권장 |

---

## 테스트

```bash
# 단위 테스트 (964개)
npm run test:run

# 테스트 감시 모드
npm test

# 커버리지
npm run test:coverage

# E2E 테스트 (Playwright)
npm run test:e2e

# 크로스 브라우저 E2E
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

### 테스트 현황

| 카테고리 | 파일 수 | 테스트 수 |
|----------|---------|-----------|
| React 컴포넌트 | 11 | 90 |
| 코어 (파서/렌더러) | 7 | 120 |
| Features (편집/검색/히스토리) | 9 | 168 |
| AI (컨트롤러/병합/검증) | 3 | 54 |
| Export (저장/XML) | 3 | 61 |
| UI (채팅/툴바/검색) | 6 | 89 |
| Utils + Stores + Hooks | 11 | 263 |
| Command API | 1 | 25 |
| 렌더러 (단락/표/이미지/도형) | 4 | 94 |
| **합계** | **55** | **964** |

---

## 배포

### GitHub Pages

```bash
git push origin main  # 자동 배포 (CI/CD)
```

### Docker

```bash
docker build -t hanview .
docker run -p 80:80 hanview
```

### Nginx 설정

`public/nginx.conf`에 프로덕션 설정이 포함되어 있습니다:
- CSP (Content Security Policy) 헤더
- HSTS (Strict Transport Security)
- Gzip 압축
- 캐시 제어 (정적 파일 1년, HTML 1시간)

---

## 보안

| 항목 | 상태 |
|------|------|
| CSP 헤더 | nginx.conf + index.html meta 태그 |
| HSTS | nginx.conf 활성화 |
| XSS 방지 | `escapeHtml()` + `sanitizeHTML()` 적용 |
| API 키 보호 | 서버 프록시 패턴 또는 .env 관리 |
| 파일 크기 제한 | 최대 50MB |
| HWP 파일 검증 | OLE 매직바이트 체크 (D0 CF 11 E0) |
| 접근성 | Skip-to-content, focus-visible, ARIA, 44px 터치 타겟 |

---

## NPM Scripts

| 스크립트 | 설명 |
|----------|------|
| `npm run dev` | 개발 서버 (포트 5090) |
| `npm run proxy` | AI API 프록시 서버 (포트 3001) |
| `npm run dev:full` | 프록시 + 개발 서버 동시 실행 |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 미리보기 |
| `npm run test:run` | 단위 테스트 실행 |
| `npm run test:e2e` | E2E 테스트 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run format` | Prettier 포맷팅 |

---

## 라이선스

이 프로젝트는 상용 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.
