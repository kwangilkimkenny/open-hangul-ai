# HAN-View React 커스터마이징 가이드

> UI/UX를 원하는 대로 커스터마이징하는 완벽 가이드

---

## 📋 목차

1. [빠른 시작](#빠른-시작)
2. [테마 커스터마이징](#테마-커스터마이징)
3. [레이아웃 커스터마이징](#레이아웃-커스터마이징)
4. [컴포넌트 커스터마이징](#컴포넌트-커스터마이징)
5. [AI 패널 커스터마이징](#ai-패널-커스터마이징)
6. [이벤트 핸들링](#이벤트-핸들링)
7. [CSS 변수 참조](#css-변수-참조)

---

## 빠른 시작

### 기본 사용법

```tsx
import { HWPXViewer, HanViewProvider } from 'hanview-react';
import 'hanview-react/styles';

function App() {
  return (
    <HanViewProvider>
      <HWPXViewer file={file} />
    </HanViewProvider>
  );
}
```

### 커스터마이징 적용

```tsx
import { HWPXViewer, HanViewProvider } from 'hanview-react';
import 'hanview-react/styles';

const customConfig = {
  theme: 'dark',
  aiPanel: {
    width: 500,
    position: 'left',
  },
  toolbar: {
    buttons: {
      print: false, // 인쇄 버튼 숨기기
    },
  },
};

function App() {
  return (
    <HanViewProvider config={customConfig}>
      <HWPXViewer file={file} />
    </HanViewProvider>
  );
}
```

---

## 테마 커스터마이징

### 1. 내장 테마 사용

```tsx
// 라이트 테마
<HanViewProvider config={{ theme: 'light' }}>

// 다크 테마
<HanViewProvider config={{ theme: 'dark' }}>

// 시스템 설정 따르기
<HanViewProvider config={{ theme: 'auto' }}>
```

### 2. CSS 변수로 색상 변경

```css
/* your-styles.css */
:root {
  /* 메인 색상 */
  --hanview-primary-color: #0066ff;
  --hanview-primary-hover: #0052cc;
  --hanview-secondary-color: #6366f1;

  /* 배경 색상 */
  --hanview-container-bg: #1a1a2e;
  --hanview-page-bg: #ffffff;

  /* AI 패널 */
  --hanview-ai-panel-bg: #0f0f23;
  --hanview-ai-panel-width: 500px;
}
```

### 3. 커스텀 테마 생성

```tsx
const myTheme = {
  id: 'my-brand',
  name: 'My Brand Theme',
  variables: {
    primaryColor: '#ff6b6b',
    primaryHover: '#ee5a5a',
    secondaryColor: '#4ecdc4',
    accentColor: '#ffe66d',
    containerBg: '#2d3436',
    pageBg: '#ffffff',
    headerBg: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
    fontFamily: "'Pretendard', sans-serif",
  },
};

<HanViewProvider config={{ theme: myTheme }}>
```

### 4. 런타임 테마 변경

```tsx
import { useHanViewTheme } from 'hanview-react';

function ThemeToggle() {
  const { theme, setTheme } = useHanViewTheme();

  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? '🌞 라이트' : '🌙 다크'}
    </button>
  );
}
```

---

## 레이아웃 커스터마이징

### 헤더/푸터 숨기기

```tsx
<HanViewProvider config={{
  layout: {
    showHeader: false,
    showFooter: false,
  }
}}>
```

### 커스텀 헤더 사용

```tsx
<HanViewProvider config={{
  layout: {
    headerComponent: <MyCustomHeader />,
    headerHeight: 80,
  }
}}>
```

### 사이드바 추가

```tsx
<HanViewProvider config={{
  layout: {
    showSidebar: true,
    sidebarPosition: 'left',
    sidebarWidth: 250,
    sidebarComponent: <MySidebar />,
  }
}}>
```

### 페이지 스타일 변경

```css
:root {
  --hanview-page-width: 800px;
  --hanview-page-padding: 40px;
  --hanview-page-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  --hanview-page-border-radius: 12px;
}
```

---

## 컴포넌트 커스터마이징

### 툴바 버튼 설정

```tsx
<HanViewProvider config={{
  toolbar: {
    visible: true,
    position: 'top',  // 'top' | 'bottom' | 'floating'
    buttons: {
      open: true,
      save: true,
      print: false,      // 숨기기
      download: true,
      zoomIn: true,
      zoomOut: true,
      search: true,
      fullscreen: false,  // 숨기기
    },
  }
}}>
```

### 커스텀 버튼 추가

```tsx
<HanViewProvider config={{
  toolbar: {
    customButtons: [
      {
        id: 'share',
        label: '공유',
        icon: <ShareIcon />,
        tooltip: '문서 공유하기',
        onClick: () => handleShare(),
      },
      {
        id: 'export',
        label: '내보내기',
        icon: <ExportIcon />,
        onClick: () => handleExport(),
      },
    ],
  }
}}>
```

### 컨텍스트 메뉴 설정

```tsx
<HanViewProvider config={{
  contextMenu: {
    enabled: true,
    items: {
      edit: true,
      copy: true,
      paste: true,
      addRow: false,      // 숨기기
      addColumn: false,   // 숨기기
      deleteRow: false,   // 숨기기
      deleteColumn: false,// 숨기기
      aiGenerate: true,
    },
    customItems: [
      {
        id: 'translate',
        label: '번역하기',
        icon: '🌐',
        onClick: (target) => handleTranslate(target),
      },
      { separator: true },
      {
        id: 'report',
        label: '오류 신고',
        icon: '🚨',
        onClick: (target) => handleReport(target),
      },
    ],
  }
}}>
```

### 로딩 커스터마이징

```tsx
<HanViewProvider config={{
  loading: {
    text: '문서를 불러오는 중입니다...',
    spinnerColor: '#667eea',
    component: <MyCustomLoader />,  // 완전 커스텀 로딩 컴포넌트
  }
}}>
```

### 에러 화면 커스터마이징

```tsx
<HanViewProvider config={{
  error: {
    retryText: '다시 시도하기',
    reloadText: '페이지 새로고침',
    component: <MyCustomErrorPage />,  // 완전 커스텀 에러 페이지
    onError: (error) => {
      console.error('에러 발생:', error);
      sendErrorToServer(error);
    },
  }
}}>
```

---

## AI 패널 커스터마이징

### 기본 설정

```tsx
<HanViewProvider config={{
  aiPanel: {
    enabled: true,
    width: 450,
    position: 'right',  // 'left' | 'right'
    defaultOpen: false,
    headerTitle: 'AI 문서 도우미',
  }
}}>
```

### 기능 토글

```tsx
<HanViewProvider config={{
  aiPanel: {
    features: {
      structureView: true,    // 문서 구조 보기
      templateExtract: true,  // 템플릿 추출
      cellSelection: true,    // 셀 선택 모드
      externalApi: false,     // 외부 API (숨기기)
      batchGenerate: true,    // 일괄 생성
      validation: true,       // 문서 검증
    },
  }
}}>
```

### 기본 프롬프트 설정

```tsx
<HanViewProvider config={{
  aiPanel: {
    defaultPrompts: [
      '이 문서를 쉬운 말로 바꿔줘',
      '봄 소풍 주제로 내용을 변경해줘',
      '초등학생이 이해할 수 있게 바꿔줘',
      '더 상세하게 작성해줘',
    ],
  }
}}>
```

### 런타임 AI 패널 제어

```tsx
import { useHanViewAIPanel } from 'hanview-react';

function AIToggleButton() {
  const { isOpen, toggle, setAIPanel } = useHanViewAIPanel();

  return (
    <>
      <button onClick={toggle}>
        {isOpen ? 'AI 패널 닫기' : 'AI 패널 열기'}
      </button>
      <button onClick={() => setAIPanel({ width: 600 })}>패널 넓히기</button>
    </>
  );
}
```

---

## 이벤트 핸들링

### 문서 이벤트

```tsx
<HanViewProvider config={{
  onDocumentLoad: (document) => {
    console.log('문서 로드됨:', document);
    analytics.track('document_loaded');
  },

  onDocumentSave: (result) => {
    if (result.success) {
      showNotification('저장 완료!');
    }
  },

  onChange: (changes) => {
    console.log('변경사항:', changes);
  },

  onPageChange: (pageNumber) => {
    console.log('현재 페이지:', pageNumber);
  },
}}>
```

### 편집 이벤트

```tsx
<HanViewProvider config={{
  onEditStart: (element) => {
    console.log('편집 시작:', element);
  },

  onEditEnd: (element, content) => {
    console.log('편집 종료:', content);
    saveToServer(content);
  },
}}>
```

### AI 이벤트

```tsx
<HanViewProvider config={{
  onAIResponse: (response) => {
    console.log('AI 응답:', response);
    trackAIUsage(response);
  },
}}>
```

### 에러 이벤트

```tsx
<HanViewProvider config={{
  onError: (error) => {
    console.error('오류 발생:', error);
    sendErrorReport(error);
    showErrorToast(error.message);
  },
}}>
```

---

## CSS 변수 참조

### 색상 변수

| 변수명                      | 기본값    | 설명      |
| --------------------------- | --------- | --------- |
| `--hanview-primary-color`   | `#667eea` | 메인 색상 |
| `--hanview-secondary-color` | `#764ba2` | 보조 색상 |
| `--hanview-accent-color`    | `#4CAF50` | 강조 색상 |
| `--hanview-success-color`   | `#10b981` | 성공 색상 |
| `--hanview-warning-color`   | `#f59e0b` | 경고 색상 |
| `--hanview-error-color`     | `#ef4444` | 에러 색상 |

### 레이아웃 변수

| 변수명                    | 기본값   | 설명        |
| ------------------------- | -------- | ----------- |
| `--hanview-page-width`    | `794px`  | 페이지 너비 |
| `--hanview-page-height`   | `1123px` | 페이지 높이 |
| `--hanview-page-padding`  | `57px`   | 페이지 패딩 |
| `--hanview-header-height` | `60px`   | 헤더 높이   |
| `--hanview-footer-height` | `32px`   | 푸터 높이   |

### AI 패널 변수

| 변수명                              | 기본값                  | 설명               |
| ----------------------------------- | ----------------------- | ------------------ |
| `--hanview-ai-panel-width`          | `450px`                 | AI 패널 너비       |
| `--hanview-ai-panel-bg`             | `#1e1e2e`               | AI 패널 배경       |
| `--hanview-ai-message-user-bg`      | `#667eea`               | 사용자 메시지 배경 |
| `--hanview-ai-message-assistant-bg` | `rgba(255,255,255,0.1)` | AI 메시지 배경     |

### 타이포그래피 변수

| 변수명                         | 기본값                        | 설명           |
| ------------------------------ | ----------------------------- | -------------- |
| `--hanview-font-family`        | `'Malgun Gothic', sans-serif` | 기본 폰트      |
| `--hanview-font-size-base`     | `14px`                        | 기본 폰트 크기 |
| `--hanview-line-height-normal` | `1.5`                         | 기본 줄 높이   |

---

## 완전한 예제

```tsx
import {
  HWPXViewer,
  HanViewProvider,
  useHanView,
  useHanViewTheme,
} from 'hanview-react';
import 'hanview-react/styles';
import './my-custom-styles.css';

// 커스텀 테마
const myTheme = {
  id: 'corporate',
  name: 'Corporate Theme',
  variables: {
    primaryColor: '#0066cc',
    headerBg: 'linear-gradient(90deg, #0066cc, #004499)',
  },
};

// 커스텀 설정
const config = {
  theme: myTheme,

  layout: {
    showFooter: false,
  },

  toolbar: {
    buttons: {
      print: false,
      fullscreen: false,
    },
    customButtons: [
      {
        id: 'feedback',
        label: '피드백',
        onClick: () => window.open('/feedback'),
      },
    ],
  },

  aiPanel: {
    enabled: true,
    headerTitle: '스마트 문서 도우미',
    features: {
      externalApi: false,
    },
  },

  onDocumentLoad: doc => console.log('로드됨'),
  onError: err => alert(err.message),
};

function App() {
  const [file, setFile] = useState(null);

  return (
    <HanViewProvider config={config}>
      <div className="app">
        <HWPXViewer file={file} className="my-viewer" />
        <ThemeToggle />
      </div>
    </HanViewProvider>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useHanViewTheme();

  return (
    <button
      className="theme-toggle"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      테마 변경
    </button>
  );
}
```

---

## 도움이 필요하신가요?

- 📖 [전체 API 문서](./API.md)
- 💬 [GitHub Issues](https://github.com/your-org/hanview-react/issues)
- 📧 [이메일 문의](mailto:ray.kim@yatavent.com)
