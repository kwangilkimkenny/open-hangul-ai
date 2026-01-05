# HAN-View React

> 전문적인 웹 기반 HWPX (한컴 워드 프로세서 XML) 뷰어 & AI 문서 편집기

[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-7-646cff.svg)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-Commercial-blue.svg)](LICENSE)

---

## 🚀 빠른 시작

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (포트: 5090)
npm run dev

# 프로덕션 빌드
npm run build
```

---

## ✨ 주요 기능

### 📄 문서 뷰어
| 기능 | 설명 |
|------|------|
| **HWPX 파싱** | 한컴 문서 완벽 파싱 |
| **드래그 앤 드롭** | 파일을 끌어다 놓으면 바로 열기 |
| **인쇄** | Ctrl+P로 문서 인쇄 |
| **PDF 내보내기** | 문서를 PDF로 저장 |

### ✏️ 인라인 편집
| 기능 | 설명 |
|------|------|
| **셀 편집** | 클릭으로 테이블 셀 직접 편집 |
| **테이블 편집** | 행/열 추가/삭제 (우클릭 메뉴) |
| **실행취소/다시실행** | Ctrl+Z / Ctrl+Y |
| **자동저장** | 30초 간격 IndexedDB 저장 |
| **충돌 복구** | 비정상 종료 시 자동 복구 제안 |

### 🔍 검색 기능
| 기능 | 설명 |
|------|------|
| **빠른 검색** | Ctrl+F로 검색창 열기 |
| **정규식 지원** | 고급 검색 패턴 |
| **하이라이팅** | 검색 결과 시각적 표시 |
| **탐색** | 이전/다음 결과로 이동 |

### 🤖 AI 문서 편집
| 기능 | 설명 |
|------|------|
| **GPT-4 연동** | OpenAI API로 지능형 편집 |
| **문서 구조 인식** | 헤더-내용 쌍 자동 감지 |
| **템플릿 생성** | 문서 구조만 추출 |
| **셀 선택 모드** | 표에서 유지/생성 셀 선택 |
| **외부 API 연동** | JSON 데이터로 문서 자동 채우기 |

### 🎨 UI/UX
| 기능 | 설명 |
|------|------|
| **다크/라이트 테마** | 시스템 설정 자동 감지 |
| **북마크** | 페이지 북마크 저장 |
| **컨텍스트 메뉴** | 우클릭으로 빠른 액션 |
| **에러 복구** | 사용자 친화적 에러 페이지 |

---

## ⌨️ 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl + O` | 파일 열기 |
| `Ctrl + S` | HWPX 저장 |
| `Ctrl + P` | 인쇄 |
| `Ctrl + F` | 검색 |
| `Ctrl + Z` | 실행취소 |
| `Ctrl + Y` | 다시실행 |
| `Ctrl + Shift + Z` | 다시실행 (대체) |
| `Escape` | 검색창 닫기 / 편집 취소 |
| `Enter` | 다음 검색 결과 |
| `Shift + Enter` | 이전 검색 결과 |

---

## 📦 기술 스택

### Frontend
- **React 19** - UI 라이브러리
- **TypeScript 5.9** - 타입 안전성
- **Vite 7** - 빠른 빌드 도구

### 상태 관리 & 유틸리티
- **Zustand 5** - 상태 관리
- **JSZip** - HWPX 파일 처리
- **Lucide React** - 아이콘
- **React Hot Toast** - 알림

### AI & API
- **OpenAI GPT-4** - AI 문서 생성
- **Custom API 지원** - 외부 API 연동

---

## 📁 프로젝트 구조

```
hanview-react-app/
├── src/
│   ├── components/              # React 컴포넌트
│   │   ├── HWPXViewerWrapper.tsx   # 뷰어 래퍼 (드래그앤드롭, 단축키, 검색)
│   │   ├── SimpleHeader.tsx        # 헤더 컴포넌트
│   │   └── ErrorBoundary.tsx       # 에러 처리
│   │
│   ├── lib/vanilla/             # Vanilla JS 코어 (포팅됨)
│   │   ├── core/                   # 핵심 모듈
│   │   │   ├── parser.js              # HWPX 파서
│   │   │   ├── renderer.js            # 문서 렌더러
│   │   │   └── constants.js           # 상수
│   │   │
│   │   ├── features/               # 기능 모듈
│   │   │   ├── inline-editor.js       # 인라인 편집
│   │   │   ├── table-editor.js        # 테이블 편집
│   │   │   ├── history-manager.js     # 히스토리 관리
│   │   │   ├── autosave-manager.js    # 자동저장
│   │   │   ├── advanced-search.js     # 고급 검색
│   │   │   ├── bookmark-manager.js    # 북마크
│   │   │   └── cell-selector.js       # 셀 선택 모드
│   │   │
│   │   ├── ai/                     # AI 모듈
│   │   │   ├── ai-controller.js       # AI 컨트롤러
│   │   │   ├── structure-extractor.js # 구조 추출
│   │   │   ├── gpt-content-generator.js # GPT 연동
│   │   │   └── content-merger.js      # 콘텐츠 병합
│   │   │
│   │   ├── export/                 # 내보내기 모듈
│   │   │   ├── hwpx-safe-exporter.js  # HWPX 저장
│   │   │   └── pdf-exporter.js        # PDF 내보내기
│   │   │
│   │   ├── ui/                     # UI 모듈
│   │   │   ├── chat-panel.js          # AI 채팅 패널
│   │   │   ├── context-menu.js        # 컨텍스트 메뉴
│   │   │   └── theme-manager.js       # 테마 관리
│   │   │
│   │   ├── api/                    # API 모듈
│   │   │   └── external-data-fetcher.js # 외부 API 연동
│   │   │
│   │   └── viewer.js               # 메인 뷰어 클래스
│   │
│   ├── styles/vanilla/          # CSS 스타일
│   │   ├── viewer.css
│   │   ├── ai-chat.css
│   │   ├── ai-editor.css
│   │   ├── cell-selector.css
│   │   └── external-api.css
│   │
│   ├── App.tsx                  # 메인 앱
│   ├── App.css                  # 글로벌 스타일
│   └── main.tsx                 # 엔트리 포인트
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🎯 사용 가이드

### 1. 기본 사용

```
1. 파일 열기: 드래그 앤 드롭 또는 Ctrl+O
2. 문서 편집: 셀 클릭으로 직접 편집
3. 저장: Ctrl+S (자동저장도 30초마다 동작)
```

### 2. AI 문서 편집

```
1. 우측 하단 💬 버튼으로 AI 패널 열기
2. 🔑 버튼으로 OpenAI API 키 설정
3. 요청 입력:
   - "가을 소풍 주제로 내용을 바꿔줘"
   - "초등학생이 이해할 수 있게 쉽게 바꿔줘"
   - "더 상세하게 작성해줘"
4. 결과 확인 후 Ctrl+S로 저장
```

### 3. 셀 선택 모드 (표 문서)

```
1. "셀 선택" 버튼 클릭
2. 유지할 셀 선택 (헤더, 제목 등)
3. 모드 설정:
   - ○ 자동: AI가 판단
   - — 유지: 원본 유지
   - / 수정: 편집 가능
   - + 생성: AI가 생성
4. AI 요청 입력 후 생성
```

### 4. 외부 API 연동

```
1. "외부 API" 버튼 클릭
2. API URL 입력
3. 필드 매핑 설정 (선택)
4. "적용" 버튼으로 문서에 데이터 채우기
```

### 5. 검색

```
1. Ctrl+F로 검색창 열기
2. 검색어 입력 후 Enter
3. 이전/다음: Shift+Enter / Enter
4. ESC로 닫기
```

---

## 🔧 개발 스크립트

```bash
npm run dev      # 개발 서버 (http://localhost:5090)
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 미리보기
npm run lint     # ESLint 검사
npm run test     # 테스트 실행
```

---

## 📋 버전 히스토리

### v2.0.0 (Current)
- ✅ React 19 + TypeScript 마이그레이션
- ✅ Vanilla JS 뷰어 완벽 통합
- ✅ 드래그 앤 드롭 파일 열기
- ✅ 키보드 단축키 (Ctrl+S/Z/Y/O/P/F)
- ✅ 고급 검색 (Ctrl+F)
- ✅ 자동저장 & 충돌 복구
- ✅ 테이블 행/열 편집
- ✅ 우클릭 컨텍스트 메뉴
- ✅ 에러 바운더리
- ✅ 이미지 레이지 로딩
- ✅ 북마크 기능
- ✅ 다크/라이트 테마

### v1.0.0
- 초기 Vanilla JS 버전

---

## 📄 라이선스

**Commercial License** - 상업용 라이선스

본 소프트웨어는 상업용 라이선스로 제공됩니다. 사용 전 라이선스 구매가 필요합니다.

### 라이선스 유형

| 유형 | 프로젝트 수 | 개발자 수 | 기술 지원 |
|------|------------|----------|----------|
| **Personal** | 1개 | 1명 | 이메일 |
| **Team** | 5개 | 10명 | 이메일 + 채팅 |
| **Enterprise** | 무제한 | 무제한 | 우선 지원 |

### 문의

- 라이선스 구매: license@ism-team.com
- 기술 지원: support@ism-team.com
- 웹사이트: https://ism-team.com

자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🙏 감사

- [한글과컴퓨터](https://www.hancom.com/) - HWPX 파일 형식
- [OpenAI](https://openai.com/) - GPT-4 API
- [React Team](https://react.dev/) - React 프레임워크

---

<div align="center">
  <strong>HAN-View React</strong> - React로 재탄생한 전문 HWPX 뷰어 & AI 문서 편집기 🎉
  <br><br>
  Made with ❤️ by ISM Team
</div>
