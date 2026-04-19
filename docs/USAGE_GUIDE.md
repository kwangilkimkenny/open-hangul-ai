# 오픈한글AI 사용 가이드

이 가이드는 `open-hangul-ai` npm 패키지를 React 프로젝트에서 사용하는 방법을 자세히 설명합니다.

## 📋 목차

1. [설치 및 설정](#설치-및-설정)
2. [기본 사용법](#기본-사용법)
3. [고급 설정](#고급-설정)
4. [AI 기능 활용](#ai-기능-활용)
5. [커스터마이징](#커스터마이징)
6. [문제 해결](#문제-해결)

## 설치 및 설정

### 1. 패키지 설치

```bash
npm install open-hangul-ai
```

### 2. 기본 의존성

React 18+ 환경이 필요합니다:

```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  }
}
```

### 3. CSS 스타일 가져오기

컴포넌트 사용 전에 반드시 스타일을 가져와야 합니다:

```tsx
// App.tsx 또는 index.tsx에서
import 'open-hangul-ai/styles';
```

## 기본 사용법

### HWPXViewer 컴포넌트

HWPX 파일을 표시하는 가장 간단한 방법:

```tsx
import React from 'react';
import { HWPXViewer } from 'open-hangul-ai';

function DocumentViewer() {
  return (
    <HWPXViewer
      fileUrl="/documents/sample.hwpx"
      width="100%"
      height="600px"
    />
  );
}
```

### 파일 업로드와 함께 사용

```tsx
import React, { useState } from 'react';
import { HWPXViewer } from 'open-hangul-ai';

function FileUploadViewer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".hwpx,.hwp,.pdf,.docx"
        onChange={handleFileChange}
      />
      
      {selectedFile && (
        <HWPXViewer
          file={selectedFile}
          width="100%"
          height="700px"
        />
      )}
    </div>
  );
}
```

### HanViewApp - 완전한 에디터

전체 기능을 포함한 문서 편집기:

```tsx
import React from 'react';
import { HanViewApp } from 'open-hangul-ai';

function FullEditor() {
  return (
    <HanViewApp
      config={{
        theme: 'light',
        toolbar: {
          enabled: true,
          position: 'top',
          buttons: ['save', 'export', 'ai', 'share']
        },
        aiPanel: {
          enabled: true,
          position: 'right'
        }
      }}
      headerButtons={[
        {
          label: '저장',
          icon: '💾',
          onClick: () => console.log('저장하기')
        }
      ]}
      onFileLoad={(file) => {
        console.log('파일 로드됨:', file.name);
      }}
      onError={(error) => {
        console.error('에러 발생:', error);
      }}
    />
  );
}
```

## 고급 설정

### Context Provider 사용

전역 상태 관리를 위한 Provider 설정:

```tsx
import React from 'react';
import {
  HanViewProvider,
  useHanView,
  useHanViewConfig,
  HWPXViewer
} from 'open-hangul-ai';

// 하위 컴포넌트
function DocumentControls() {
  const { currentFile, setFile, isLoading } = useHanView();
  const { theme, setTheme } = useHanViewConfig();

  return (
    <div>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        테마 변경: {theme}
      </button>
      {isLoading && <p>로딩 중...</p>}
      {currentFile && <p>현재 파일: {currentFile.name}</p>}
    </div>
  );
}

// 메인 앱
function App() {
  return (
    <HanViewProvider
      config={{
        theme: 'light',
        layout: {
          sidebar: true,
          minimap: true,
          statusBar: true
        },
        features: {
          collaboration: true,
          comments: true,
          aiAssistant: true
        }
      }}
    >
      <div>
        <DocumentControls />
        <HWPXViewer />
      </div>
    </HanViewProvider>
  );
}
```

### 이벤트 핸들러

다양한 이벤트를 처리하는 방법:

```tsx
import React from 'react';
import { HWPXViewer } from 'open-hangul-ai';

function EventHandlerExample() {
  const handleDocumentLoad = (document: any) => {
    console.log('문서 로드 완료:', document);
  };

  const handleDocumentError = (error: Error) => {
    console.error('문서 로드 에러:', error);
  };

  const handlePageChange = (pageNumber: number) => {
    console.log('페이지 변경:', pageNumber);
  };

  const handleTextSelect = (selectedText: string) => {
    console.log('텍스트 선택:', selectedText);
  };

  return (
    <HWPXViewer
      fileUrl="/docs/sample.hwpx"
      onLoad={handleDocumentLoad}
      onError={handleDocumentError}
      onPageChange={handlePageChange}
      onTextSelect={handleTextSelect}
      config={{
        enableTextSelection: true,
        enableZoom: true,
        showPageNumbers: true
      }}
    />
  );
}
```

## AI 기능 활용

### AI 문서 분석

```tsx
import React, { useState } from 'react';
import { AIDocumentController } from 'open-hangul-ai';

function AIAnalysis() {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const aiController = new AIDocumentController({
    provider: 'openai', // 'openai' | 'anthropic' | 'google'
    apiKey: process.env.REACT_APP_OPENAI_API_KEY,
    model: 'gpt-4'
  });

  const analyzeDocument = async (file: File) => {
    setLoading(true);
    try {
      const result = await aiController.analyze(file, {
        tasks: ['summarize', 'extract_key_points', 'sentiment']
      });
      setAnalysis(result.summary);
    } catch (error) {
      console.error('AI 분석 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".hwpx,.pdf,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) analyzeDocument(file);
        }}
      />
      
      {loading && <p>AI가 문서를 분석 중입니다...</p>}
      {analysis && (
        <div>
          <h3>AI 분석 결과</h3>
          <p>{analysis}</p>
        </div>
      )}
    </div>
  );
}
```

### 문서 구조 추출

```tsx
import React from 'react';
import { DocumentStructureExtractor } from 'open-hangul-ai';

function StructureExtraction() {
  const extractStructure = async (file: File) => {
    const extractor = new DocumentStructureExtractor();
    const structure = await extractor.extract(file);

    console.log('문서 구조:', {
      headings: structure.headings,
      paragraphs: structure.paragraphs.length,
      tables: structure.tables.length,
      images: structure.images.length
    });
  };

  return (
    <input
      type="file"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) extractStructure(file);
      }}
    />
  );
}
```

## 커스터마이징

### 테마 커스터마이징

```tsx
import React from 'react';
import { HanViewApp, ThemeProvider } from 'open-hangul-ai';

const customTheme = {
  colors: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8',
    light: '#f8f9fa',
    dark: '#343a40',
    background: '#ffffff',
    surface: '#f8f9fa',
    text: '#212529',
    textSecondary: '#6c757d'
  },
  fonts: {
    primary: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif',
    secondary: '"Noto Serif KR", serif',
    mono: '"Fira Code", "Monaco", monospace'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px'
  }
};

function CustomThemedApp() {
  return (
    <ThemeProvider theme={customTheme}>
      <HanViewApp />
    </ThemeProvider>
  );
}
```

### 툴바 커스터마이징

```tsx
import React from 'react';
import { HanViewApp } from 'open-hangul-ai';

const customToolbarConfig = {
  enabled: true,
  position: 'top' as const,
  buttons: [
    'file-open',
    'save',
    'separator',
    'undo',
    'redo',
    'separator',
    'bold',
    'italic',
    'underline',
    'separator',
    'ai-assistant',
    'comments',
    'share'
  ],
  customButtons: [
    {
      id: 'custom-action',
      label: '커스텀',
      icon: '⚡',
      onClick: () => alert('커스텀 액션!'),
      position: 'right'
    }
  ]
};

function CustomToolbar() {
  return (
    <HanViewApp
      config={{
        toolbar: customToolbarConfig
      }}
    />
  );
}
```

## 문제 해결

### 일반적인 문제

#### 1. 스타일이 적용되지 않음

```tsx
// ✅ 올바른 방법
import 'open-hangul-ai/styles';

// ❌ 잘못된 방법
import 'open-hangul-ai/dist/style.css'; // 파일이 없음
```

#### 2. TypeScript 타입 에러

```tsx
// ✅ 타입 정의 확인
import { HWPXViewer, HanViewConfig } from 'open-hangul-ai';

const config: HanViewConfig = {
  theme: 'light',
  // ...
};
```

#### 3. 파일 로드 실패

```tsx
// ✅ 에러 핸들링 추가
<HWPXViewer
  fileUrl="/docs/sample.hwpx"
  onError={(error) => {
    console.error('파일 로드 실패:', error);
    // 사용자에게 알림 표시
  }}
/>
```

### 성능 최적화

#### 1. 큰 파일 처리

```tsx
import React, { useMemo } from 'react';
import { HWPXViewer } from 'open-hangul-ai';

function OptimizedViewer({ file }: { file: File }) {
  const config = useMemo(() => ({
    lazy: true, // 지연 로딩
    virtualScrolling: true, // 가상 스크롤링
    pageLimit: 10 // 페이지 제한
  }), []);

  return (
    <HWPXViewer
      file={file}
      config={config}
    />
  );
}
```

#### 2. 메모이제이션

```tsx
import React, { memo } from 'react';
import { HWPXViewer } from 'open-hangul-ai';

const MemoizedViewer = memo(HWPXViewer);

function App() {
  return <MemoizedViewer fileUrl="/docs/sample.hwpx" />;
}
```

### 디버깅

#### 로그 활성화

```tsx
import { getLogger } from 'open-hangul-ai';

// 개발 환경에서 로그 활성화
if (process.env.NODE_ENV === 'development') {
  const logger = getLogger('HWPXViewer');
  logger.setLevel('debug');
}
```

#### 개발자 도구

```tsx
import { HanViewApp } from 'open-hangul-ai';

function DebugApp() {
  return (
    <HanViewApp
      config={{
        debug: true, // 개발자 모드 활성화
        showFPS: true, // FPS 표시
        showMemoryUsage: true // 메모리 사용량 표시
      }}
    />
  );
}
```

## 추가 자료

- [API 문서](./API.md)
- [예제 프로젝트](./examples/)
- [GitHub Issues](https://github.com/yatav-team/open-hangul-ai/issues)
- [공식 홈페이지](https://openhangulai.org)

---

이 가이드가 도움이 되었다면 [GitHub](https://github.com/yatav-team/open-hangul-ai)에서 ⭐를 눌러주세요!