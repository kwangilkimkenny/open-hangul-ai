# 오픈한글AI (Open Hangul AI)

[![npm version](https://img.shields.io/npm/v/open-hangul-ai.svg)](https://www.npmjs.com/package/open-hangul-ai)
[![npm downloads](https://img.shields.io/npm/dm/open-hangul-ai.svg)](https://www.npmjs.com/package/open-hangul-ai)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/open-hangul-ai)](https://bundlephobia.com/package/open-hangul-ai)
[![GitHub stars](https://img.shields.io/github/stars/kwangilkimkenny/open-hangul-ai.svg?style=social&label=Star)](https://github.com/kwangilkimkenny/open-hangul-ai)
[![GitHub issues](https://img.shields.io/github/issues/kwangilkimkenny/open-hangul-ai.svg)](https://github.com/kwangilkimkenny/open-hangul-ai/issues)
[![GitHub last commit](https://img.shields.io/github/last-commit/kwangilkimkenny/open-hangul-ai.svg)](https://github.com/kwangilkimkenny/open-hangul-ai/commits/main)

[![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **Professional HWPX Viewer & AI Document Editor for React** - 한글 문서 및
> 다양한 문서 형식을 지원하는 React 컴포넌트 라이브러리

## ✨ 특징

- 🇰🇷 **한글 문서 완벽 지원**: HWPX, HWP 파일 뷰어
- 📄 **다양한 포맷 지원**: PDF, DOCX, XLSX, PPTX
- 🤖 **AI 통합**: 문서 분석, 요약, 번역 기능
- ⚛️ **React 네이티브**: TypeScript 완전 지원
- 🎨 **커스터마이징**: 테마, 툴바, UI 완전 제어
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

## 📦 설치

```bash
# npm
npm install open-hangul-ai

# yarn
yarn add open-hangul-ai

# pnpm
pnpm add open-hangul-ai
```

## 🚀 빠른 시작

### 기본 HWPX 뷰어

```tsx
import React from 'react';
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return (
    <div>
      <h1>문서 뷰어</h1>
      <HWPXViewer
        fileUrl="/path/to/document.hwpx"
        width="100%"
        height="600px"
      />
    </div>
  );
}

export default App;
```

### 통합 앱 컴포넌트

```tsx
import React from 'react';
import { HanViewApp } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function DocumentApp() {
  return (
    <HanViewApp
      config={{
        theme: 'light',
        toolbar: {
          enabled: true,
          position: 'top',
        },
        aiPanel: {
          enabled: true,
          provider: 'openai', // openai, anthropic, google
        },
      }}
      onFileLoad={file => console.log('파일 로드:', file)}
      onError={error => console.error('에러:', error)}
    />
  );
}
```

### 커스텀 설정과 훅 사용

```tsx
import React from 'react';
import { HanViewProvider, useHanView, HWPXViewer } from 'open-hangul-ai';

function DocumentViewer() {
  const { currentFile, setFile, config } = useHanView();

  return (
    <div>
      <input
        type="file"
        accept=".hwpx,.pdf,.docx"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) setFile(file);
        }}
      />

      {currentFile && <HWPXViewer file={currentFile} config={config} />}
    </div>
  );
}

function App() {
  return (
    <HanViewProvider
      config={{
        theme: 'dark',
        layout: {
          sidebar: true,
          minimap: true,
        },
      }}
    >
      <DocumentViewer />
    </HanViewProvider>
  );
}
```

## 📖 주요 컴포넌트

### `HanViewApp`

완전한 문서 편집기 애플리케이션

```tsx
import { HanViewApp } from 'open-hangul-ai';

<HanViewApp
  config={{
    theme: 'light' | 'dark',
    toolbar: ToolbarConfig,
    aiPanel: AIPanelConfig
  }}
  headerButtons?: HeaderButton[]
  onFileLoad?: (file: File) => void
  onError?: (error: Error) => void
/>
```

### `HWPXViewer`

HWPX 파일 전용 뷰어

```tsx
import { HWPXViewer } from 'open-hangul-ai';

<HWPXViewer
  fileUrl?: string
  file?: File
  width?: string
  height?: string
  config?: HanViewConfig
/>
```

### `HanViewProvider`

Context를 통한 상태 관리

```tsx
import { HanViewProvider, useHanView } from 'open-hangul-ai';

<HanViewProvider config={config}>{/* 하위 컴포넌트들 */}</HanViewProvider>;
```

## 🎨 테마 커스터마이징

```tsx
const customTheme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    background: '#ffffff',
    text: '#212529',
  },
  fonts: {
    primary: 'Noto Sans KR, sans-serif',
    mono: 'Fira Code, monospace',
  },
  spacing: {
    small: '8px',
    medium: '16px',
    large: '24px',
  },
};

<HanViewApp
  config={{
    theme: customTheme,
    // 또는 내장 테마
    // theme: 'light' | 'dark' | 'auto'
  }}
/>;
```

## 🤖 AI 기능 활용

```tsx
import {
  AIDocumentController,
  DocumentStructureExtractor,
} from 'open-hangul-ai';

// AI 문서 분석
const aiController = new AIDocumentController({
  provider: 'openai',
  apiKey: 'your-api-key',
});

// 문서 요약
const summary = await aiController.summarize(document);

// 구조 추출
const extractor = new DocumentStructureExtractor();
const structure = extractor.extract(document);
```

## 📚 지원 파일 형식

| 형식 | 읽기 | 편집 | 내보내기 |
| ---- | ---- | ---- | -------- |
| HWPX | ✅   | ✅   | ✅       |
| HWP  | ✅   | ❌   | ❌       |
| PDF  | ✅   | ❌   | ✅       |
| DOCX | ✅   | ✅   | ✅       |
| XLSX | ✅   | ✅   | ✅       |
| PPTX | ✅   | ✅   | ✅       |

## 🔧 개발 환경

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
```

## 📝 라이센스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🤝 기여하기

1. 이 저장소를 Fork합니다
2. 새 브랜치를 만듭니다 (`git checkout -b feature/새기능`)
3. 변경사항을 커밋합니다 (`git commit -am '새 기능 추가'`)
4. 브랜치를 Push합니다 (`git push origin feature/새기능`)
5. Pull Request를 만듭니다

## 📞 지원

- **문제 보고**:
  [GitHub Issues](https://github.com/kwangilkimkenny/open-hangul-ai/issues)
- **문서**: [공식 문서](https://openhangulai.org)
- **이메일**: team@openhangulai.org

## 🏢 YATAV

오픈한글AI는 [YATAV](https://yatavent.com)에서 개발하고 있습니다.

- **Community Edition**: MIT 라이센스 (무료)
- **Enterprise Edition**: 상용 라이센스 (유료)

---

Made with ❤️ by YATAV Team
