# HAN-View React

> 전문적인 웹 기반 HWPX (한컴 워드 프로세서 XML) 뷰어 - **React + TypeScript** 버전

[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7+-646cff.svg)](https://vitejs.dev)
[![Zustand](https://img.shields.io/badge/Zustand-5+-orange.svg)](https://zustand-demo.pmnd.rs)

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 📦 기술 스택

- **React 18+** - UI 라이브러리
- **TypeScript 5+** - 타입 안전성
- **Vite 7+** - 빠른 빌드 도구
- **Zustand 5+** - 상태 관리
- **JSZip** - HWPX 파일 파싱
- **Lucide React** - 아이콘

## 📁 프로젝트 구조

```
hanview-react-app/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── viewer/          # 뷰어 컴포넌트
│   │   │   ├── DocumentViewer.tsx
│   │   │   ├── PageContainer.tsx
│   │   │   ├── Paragraph.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Image.tsx
│   │   │   └── Shape.tsx
│   │   ├── ai/              # AI 관련 컴포넌트
│   │   │   └── ChatPanel.tsx
│   │   ├── ui/              # UI 컴포넌트
│   │   │   ├── Toolbar.tsx
│   │   │   └── Toast.tsx
│   │   └── common/          # 공통 컴포넌트
│   │       └── LoadingOverlay.tsx
│   │
│   ├── stores/              # Zustand 스토어
│   │   ├── documentStore.ts # 문서 상태
│   │   ├── aiStore.ts       # AI 상태
│   │   └── uiStore.ts       # UI 상태
│   │
│   ├── hooks/               # Custom Hooks
│   │   ├── useAutoSave.ts   # 자동 저장
│   │   └── useHistory.ts    # Undo/Redo
│   │
│   ├── lib/                 # 순수 JS 로직
│   │   ├── core/
│   │   │   ├── parser.ts    # HWPX 파서
│   │   │   └── constants.ts # 상수
│   │   └── utils/
│   │       ├── logger.ts    # 로깅
│   │       ├── error.ts     # 에러 처리
│   │       └── format.ts    # 포맷팅
│   │
│   ├── types/               # TypeScript 타입
│   │   └── hwpx.d.ts
│   │
│   ├── styles/              # CSS 스타일
│   │   ├── viewer.css
│   │   ├── chat-panel.css
│   │   └── toolbar.css
│   │
│   ├── App.tsx              # 메인 App
│   ├── App.css              # 글로벌 스타일
│   └── main.tsx             # 엔트리 포인트
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## ✨ 주요 기능

### 📄 문서 뷰어
- HWPX 파일 파싱 및 렌더링
- 드래그 앤 드롭으로 파일 열기
- 확대/축소 (25% ~ 400%)
- 인쇄 지원

### 🎨 렌더링
- 문단 (단락, 텍스트 스타일)
- 테이블 (셀 병합, 테두리, 배경색)
- 이미지
- 도형 (사각형, 원, 텍스트박스)

### 🤖 AI 기능 (완료 ✅)
- ✅ AI 채팅 패널
- ✅ OpenAI GPT-4 API 연동
- ✅ 문서 구조 자동 인식 및 편집
- ✅ 헤더-내용 쌍 기반 지능형 편집
- ✅ 토큰/비용 추적
- 🔧 커스텀 API 지원 (준비)

### 💾 생산성
- 자동 저장 (IndexedDB)
- Undo/Redo 히스토리
- 토스트 알림

## 🔧 스크립트

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # ESLint 실행
```

## 🎯 사용법

### 기본 기능
1. **파일 열기**: 드래그 앤 드롭 또는 "파일 열기" 버튼 클릭 (Ctrl+O)
2. **HWPX 저장**: 편집된 문서를 HWPX 파일로 저장 (Ctrl+S)
   - 빠른 저장: Ctrl+S (파일명 재사용)
   - 다른 이름으로 저장: "HWPX 저장" 버튼 클릭
   - 수정됨 표시: 문서 수정 시 저장 버튼이 빨간색으로 변경
3. **PDF 다운로드**: 도구 모음의 "PDF 다운로드" 버튼으로 PDF 저장
4. **인쇄**: 도구 모음의 인쇄 버튼 클릭 (Ctrl+P)
5. **자동저장**: 30초마다 자동으로 IndexedDB에 세션 저장 (복원용)

### 🤖 AI 기능 사용하기

#### 1. API 키 설정
1. 우측 하단 💬 채팅 아이콘 클릭
2. 🔑 아이콘 클릭
3. OpenAI API 키 입력
   - API 키 발급: https://platform.openai.com/api-keys
   - 브라우저 로컬 저장 (안전)

#### 2. AI 문서 편집
1. HWPX 문서 열기
2. 채팅 패널에서 요청 입력
   - 예: "가을 여행 주제로 놀이중심 주간 계획서를 생성해줘"
   - 예: "초등학생이 이해할 수 있게 쉽게 바꿔줘"
   - 예: "더 창의적이고 재미있게 만들어줘"
3. AI가 자동으로 문서 구조를 유지하면서 내용만 변경
4. 결과 확인 후 저장 또는 추가 수정

#### 3. 템플릿 생성
1. 완성된 문서를 템플릿으로 변환
2. 채팅 패널 하단 "🎨 템플릿 생성" 버튼 클릭
3. 옵션 선택:
   - 제목 유지/삭제
   - 이미지 유지/삭제
   - 도형 유지/삭제
4. 텍스트만 삭제된 템플릿 다운로드

#### 4. 선택적 AI 생성 (표 기반 문서)
1. 문서를 열고 채팅 패널에서 "🎯 셀 선택 모드" 클릭
2. 표에서 유지할 셀 클릭 (제목, 헤더 등)
3. "🤖 자동 헤더 감지" 버튼으로 자동 선택 가능
4. AI 요청 입력 (예: "여름 캠프 프로그램으로 내용을 채워줘")
5. AI가 유지된 셀을 컨텍스트로 사용하여 빈 셀 자동 채움
6. Ctrl+S로 HWPX 저장

### ⌨️ 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl + O` | 파일 열기 |
| `Ctrl + S` | HWPX 빠른 저장 |
| `Ctrl + P` | 인쇄 |

> 단축키 목록은 사이드바의 "🎹 키보드 단축키" 패널에서도 확인할 수 있습니다.

## 🔄 기존 프로젝트와의 비교

| 항목 | 기존 (Vanilla JS) | React 버전 |
|------|-------------------|-----------|
| 언어 | JavaScript (ES6) | TypeScript |
| 상태 관리 | 클래스 내부 state | Zustand |
| UI | DOM 직접 조작 | React 컴포넌트 |
| 빌드 | 없음 | Vite |
| 파서 | ✅ 완전 포팅 | ✅ 완전 포팅 |
| HWPX 저장 | ✅ 완전 포팅 | ✅ 완전 포팅 (참조 구현 100%) |
| AI 로직 | ✅ 참조 구현 | ✅ 완전 연동 |

## 📝 TODO

- [x] AI Controller 완전 연동
- [x] HWPX 저장 기능
- [x] 템플릿 생성 기능
- [ ] PDF 내보내기 개선
- [ ] 커스텀 API 연동
- [ ] 클라우드 동기화
- [ ] 다크 테마 완성

## 📄 라이선스

MIT License

## 👥 기여

Pull Request와 Issue를 환영합니다!

---

**HAN-View React** - React로 재탄생한 전문 HWPX 뷰어 🎉
