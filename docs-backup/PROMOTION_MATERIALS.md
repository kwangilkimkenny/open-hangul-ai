# 커뮤니티 홍보 자료

오픈한글AI v5.0.1 릴리스를 위한 다양한 커뮤니티 홍보 콘텐츠입니다.

## 📱 소셜미디어 게시글

### Twitter/X (280자 제한)

#### 버전 1 - 기능 중심

```
🎉 오픈한글AI v5.0.1 npm 패키지 출시!

한글 문서(HWPX) + AI 기능을 React 프로젝트에 5분 안에 추가:

npm install open-hangul-ai

✨ TypeScript 완전 지원
🤖 AI 문서 분석/생성
📱 반응형 디자인
🇰🇷 한글 특화

#React #TypeScript #AI #한글문서 #OpenSource

https://github.com/yatav-team/open-hangul-ai
```

#### 버전 2 - 개발자 경험 중심

````
🚀 React 개발자들을 위한 한글 문서 라이브러리!

오픈한글AI는 HWPX, PDF, DOCX를 완벽 지원하며 AI 기능까지 내장:

```tsx
import { HWPXViewer } from 'open-hangul-ai';
<HWPXViewer fileUrl="/sample.hwpx" />
````

MIT 라이센스 | 1.8MB | React 18+

#OpenSource #Korean #DocumentViewer

```

#### 버전 3 - 문제 해결 중심
```

한글 문서 처리에 어려움을 겪고 계신가요?

오픈한글AI가 해결책입니다: • HWPX 파일 완벽 지원 • AI 문서 분석 & 요약 • React
컴포넌트로 5분 설치 • TypeScript 타입 안전성

npm install open-hangul-ai

더 이상 한글 문서 때문에 고민하지 마세요! 🇰🇷✨

#개발자 #한글

```

### LinkedIn (전문가 네트워크)

```

🎯 Enterprise Document Processing Made Simple

I'm excited to announce the release of Open Hangul AI v5.0.1 - a comprehensive
React library for Korean document processing with built-in AI capabilities.

🔧 What makes it special: • Complete HWPX (Korean Word Processor) support •
AI-powered document analysis and generation • TypeScript-first development
experience • Production-ready React components

💡 Perfect for:

- Enterprise applications handling Korean documents
- Document management systems
- AI-powered content platforms
- Cross-border business solutions

The library supports multiple document formats (HWPX, PDF, DOCX, XLSX) and
integrates seamlessly with popular AI providers like OpenAI and Google Vertex
AI.

🚀 Getting started: npm install open-hangul-ai

Built with React 18+, TypeScript, and modern web standards. MIT licensed and
ready for production use.

What document processing challenges are you facing in your projects?

#ReactJS #TypeScript #AI #DocumentProcessing #Enterprise #OpenSource #Korean

GitHub: https://github.com/yatav-team/open-hangul-ai NPM:
https://www.npmjs.com/package/open-hangul-ai

```

### Facebook (커뮤니티 그룹용)

```

🇰🇷 한국 개발자 분들께 좋은 소식! 🎉

오픈한글AI v5.0.1이 npm 패키지로 정식 출시되었습니다!

이제 React 프로젝트에서 한글 문서(HWPX)를 쉽게 처리할 수 있어요:

✨ 주요 기능: • HWPX, HWP 파일 완벽 지원 • PDF, DOCX, XLSX, PPTX 뷰어 • AI 문서
분석 및 요약 기능 • TypeScript 완전 지원 • 반응형 UI 컴포넌트

🚀 5분 만에 시작하기:

1. npm install open-hangul-ai
2. import { HWPXViewer } from 'open-hangul-ai'
3. <HWPXViewer fileUrl="/문서.hwpx" />

MIT 라이센스로 상업적 사용도 자유롭고, 완전한 한국어 문서와 예제까지 제공합니다!

한글 문서 처리 때문에 고생했던 분들께 정말 도움이 될 것 같아요 😊

💻 GitHub: https://github.com/yatav-team/open-hangul-ai 📦 NPM:
https://www.npmjs.com/package/open-hangul-ai

#한국개발자 #React #TypeScript #한글문서 #HWPX #오픈소스

````

## 📝 블로그 게시글 (Medium/Dev.to)

### 제목 옵션
1. "Introducing Open Hangul AI: The Complete Korean Document Processing Library for React"
2. "How to Add HWPX Support to Your React App in 5 Minutes"
3. "Building AI-Powered Korean Document Viewers with React and TypeScript"

### 블로그 글 본문

```markdown
# Introducing Open Hangul AI: The Complete Korean Document Processing Library for React

*Finally, a modern solution for Korean document processing in React applications*

![Open Hangul AI Hero Image](banner-image-url)

## The Problem: Korean Document Processing in Modern Web Apps

If you've ever worked on a project involving Korean documents, you know the pain. HWPX files (from Hancom Office) are widely used in Korea but notoriously difficult to handle in web applications. Most developers end up with:

- Server-side conversions that are slow and unreliable
- Limited functionality compared to native applications
- Poor user experience on mobile devices
- No AI integration capabilities

## The Solution: Open Hangul AI

Today, I'm excited to introduce **Open Hangul AI v5.0.1** - a comprehensive React library that solves these problems elegantly.

```bash
npm install open-hangul-ai
````

## What Makes It Special?

### 🇰🇷 First-Class Korean Document Support

- **HWPX**: Full viewer and editing capabilities
- **HWP**: Read support with proper formatting
- **Universal**: PDF, DOCX, XLSX, PPTX support

### 🤖 AI-Powered Features

- Document analysis and summarization
- Real-time AI assistant integration
- Support for OpenAI, Google Vertex AI, and more
- Streaming responses for better UX

### ⚛️ React-Native Experience

- TypeScript-first development
- React 18+ with modern hooks
- Context-based state management
- Customizable themes and UI

## Quick Start: 5-Minute Setup

### 1. Installation

```bash
npm install open-hangul-ai
```

### 2. Basic Usage

```tsx
import React from 'react';
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function DocumentApp() {
  return (
    <div>
      <h1>My Document Viewer</h1>
      <HWPXViewer
        fileUrl="/documents/sample.hwpx"
        width="100%"
        height="600px"
      />
    </div>
  );
}
```

### 3. Advanced Features

```tsx
import { HanViewApp } from 'open-hangul-ai';

function AdvancedApp() {
  return (
    <HanViewApp
      config={{
        theme: 'light',
        toolbar: { enabled: true },
        aiPanel: {
          enabled: true,
          provider: 'openai',
        },
      }}
      onFileLoad={file => console.log('Loaded:', file.name)}
    />
  );
}
```

## Real-World Use Cases

### Enterprise Document Management

```tsx
// Multi-format document viewer with AI analysis
import { useHanView, AIDocumentController } from 'open-hangul-ai';

function EnterpriseViewer() {
  const { currentFile } = useHanView();
  const [analysis, setAnalysis] = useState('');

  const analyzeDocument = async () => {
    const ai = new AIDocumentController({
      provider: 'openai',
      apiKey: process.env.REACT_APP_OPENAI_KEY,
    });

    const result = await ai.analyze(currentFile, {
      tasks: ['summarize', 'extract_key_points'],
    });

    setAnalysis(result.summary);
  };

  return (
    <div className="enterprise-viewer">
      <HWPXViewer />
      <button onClick={analyzeDocument}>AI Analysis</button>
      {analysis && <div className="analysis">{analysis}</div>}
    </div>
  );
}
```

### Educational Platform

```tsx
// Custom theme for educational content
const educationTheme = {
  colors: {
    primary: '#4A90E2',
    background: '#F8F9FA',
  },
  fonts: {
    primary: 'Noto Sans KR',
  },
};

function EducationPlatform() {
  return (
    <HanViewProvider config={{ theme: educationTheme }}>
      <HWPXViewer
        config={{
          enableTextSelection: true,
          showPageNumbers: true,
          allowAnnotations: true,
        }}
      />
    </HanViewProvider>
  );
}
```

## Performance & Technical Details

### Bundle Size Optimization

- **1.8MB compressed** (reasonable for the feature set)
- Tree-shakeable exports
- Lazy loading for large documents
- Virtual scrolling for performance

### Browser Support

- Chrome 90+, Firefox 88+, Safari 14+
- Mobile browsers supported
- Progressive enhancement approach

### TypeScript Support

Every component comes with complete type definitions:

```typescript
interface HWPXViewerProps {
  fileUrl?: string;
  file?: File;
  width?: string | number;
  height?: string | number;
  config?: Partial<HanViewConfig>;
  onLoad?: (document: HWPXDocument) => void;
  onError?: (error: Error) => void;
}
```

## Community & Ecosystem

### Open Source Commitment

- **MIT License** - Free for commercial use
- Active development and maintenance
- Comprehensive documentation
- Community-driven feature requests

### Getting Help

- [GitHub Issues](https://github.com/yatav-team/open-hangul-ai/issues) for bugs
- [Discussions](https://github.com/yatav-team/open-hangul-ai/discussions) for
  questions
- [Documentation](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/API.md)
  for API reference

## What's Next?

### Roadmap (Q2 2026)

- Real-time collaborative editing
- Additional AI provider integrations
- Mobile-first optimizations
- Plugin system for extensibility

### Contributing

We welcome contributions! Check out our
[Contributing Guide](https://github.com/yatav-team/open-hangul-ai/blob/main/CONTRIBUTING.md).

## Conclusion

Open Hangul AI represents a new era for Korean document processing in web
applications. Whether you're building enterprise software, educational
platforms, or consumer applications, this library provides the tools you need to
handle Korean documents professionally.

The combination of native HWPX support, AI integration, and modern React
patterns makes it a compelling choice for any project dealing with Korean
content.

**Try it today:**

```bash
npm install open-hangul-ai
```

_Have you worked with Korean documents in your projects? What challenges did you
face? Share your experience in the comments below!_

---

**Links:**

- 📦 [NPM Package](https://www.npmjs.com/package/open-hangul-ai)
- 💻 [GitHub Repository](https://github.com/yatav-team/open-hangul-ai)
- 📚
  [Documentation](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/API.md)
- 🚀
  [Quick Start Guide](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/USAGE_GUIDE.md)

_Built with ❤️ by the [YATAV Team](https://yatavent.com)_

```

## 🏘 개발자 커뮤니티 게시글

### Reddit (r/reactjs)

```

Title: [Release] Open Hangul AI v5.0.1 - Korean Document Processing Library for
React

Hey r/reactjs! 👋

I just released Open Hangul AI v5.0.1, a comprehensive React library for
processing Korean documents (HWPX, HWP) with built-in AI capabilities.

## What it does:

- Renders HWPX files (Korean MS Word equivalent) natively in React
- Supports PDF, DOCX, XLSX, PPTX viewing
- AI document analysis and generation
- Full TypeScript support
- Customizable themes and UI

## Quick example:

```tsx
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return <HWPXViewer fileUrl="/sample.hwpx" />;
}
```

## Why this matters:

Korean documents are notoriously hard to handle in web apps. Most solutions
require server-side conversion or desktop software. This library brings native
support to React.

Perfect for:

- Enterprise apps in Korea
- International businesses
- Educational platforms
- Document management systems

📦 npm install open-hangul-ai 🔗 https://github.com/yatav-team/open-hangul-ai

MIT licensed, 1.8MB bundle, React 18+ support.

Would love feedback from the community! Anyone else working with international
document formats?

## Tech stack:

- React 18
- TypeScript
- Vite
- Modern hooks (useContext, custom hooks)
- AI integration (OpenAI, Vertex AI)

Happy coding! 🚀

```

### Stack Overflow (Community Wiki Answer)

```

Title: How to display HWPX files in a React application?

# Updated Answer (2026): Use Open Hangul AI Library

The most comprehensive solution for displaying HWPX files in React is now the
**Open Hangul AI** library, released in 2026.

## Installation

```bash
npm install open-hangul-ai
```

## Basic Usage

```tsx
import React from 'react';
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function DocumentViewer() {
  return (
    <HWPXViewer fileUrl="/path/to/document.hwpx" width="100%" height="600px" />
  );
}
```

## Advanced Usage with File Upload

```tsx
import React, { useState } from 'react';
import { HWPXViewer } from 'open-hangul-ai';

function FileUploadViewer() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) setFile(selectedFile);
  };

  return (
    <div>
      <input type="file" accept=".hwpx,.hwp" onChange={handleFileChange} />
      {file && (
        <HWPXViewer
          file={file}
          onLoad={document => console.log('Document loaded')}
          onError={error => console.error('Load error:', error)}
        />
      )}
    </div>
  );
}
```

## Features

- ✅ Native HWPX/HWP file support
- ✅ TypeScript support
- ✅ React 18+ compatible
- ✅ Mobile responsive
- ✅ AI integration capabilities
- ✅ Customizable themes
- ✅ Error handling

## Browser Support

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

## Links

- [GitHub Repository](https://github.com/yatav-team/open-hangul-ai)
- [NPM Package](https://www.npmjs.com/package/open-hangul-ai)
- [Complete API Documentation](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/API.md)

This solution eliminates the need for server-side conversion and provides a
native React experience for Korean document processing.

```

### Discord/Slack Developer Communities

```

🎉 **New Release Alert!**

Just shipped Open Hangul AI v5.0.1 - a React library for Korean document
processing!

🇰🇷 **Perfect for Korean devs** or anyone dealing with HWPX files 🤖 **AI
integration** built-in (OpenAI, Vertex AI) ⚛️ **React 18+** with full TypeScript
support

```tsx
// One line to display Korean documents
<HWPXViewer fileUrl="/sample.hwpx" />
```

📦 `npm install open-hangul-ai` 💻 https://github.com/yatav-team/open-hangul-ai

Anyone working on international document processing? Would love to hear your use
cases! 🚀

#react #typescript #korean #documents #opensource

```

### Hacker News

```

Title: Open Hangul AI – Korean Document Processing Library for React

URL: https://github.com/yatav-team/open-hangul-ai

We just released Open Hangul AI, a React library that brings native Korean
document (HWPX/HWP) processing to web applications.

Background: Korean document formats (particularly HWPX from Hancom Office) are
widely used in Korea but extremely difficult to handle in web apps. Most
solutions require server-side conversion with poor results or desktop software
dependencies.

This library provides:

- Native HWPX/HWP rendering in React components
- AI-powered document analysis and generation
- TypeScript-first development experience
- Support for multiple document formats (PDF, DOCX, etc.)

Technical details:

- Built with modern React (18+) and TypeScript
- 1.8MB bundle size with tree-shaking support
- Integrates with OpenAI, Google Vertex AI
- MIT licensed

The international document processing space is quite fragmented, especially for
non-Latin scripts. We're hoping this contributes to better web support for
Korean content.

Feedback welcome, especially from anyone working with similar challenges in
other languages/regions.

```

## 📺 YouTube 스크립트 (Demo Video)

```

Title: "Open Hangul AI: React에서 한글 문서 처리하기 (5분 튜토리얼)"

[0:00 - 0:30] 인트로 안녕하세요! 오늘은 React 프로젝트에서 한글 문서, 특히 HWPX
파일을 처리할 수 있는 오픈한글AI 라이브러리를 소개합니다.

[0:30 - 1:00] 문제 제기 기존에는 한글 문서를 웹에서 보려면 서버에서 변환하거나
별도 프로그램이 필요했죠. 이제 그런 복잡함 없이 React 컴포넌트로 바로 처리할 수
있습니다.

[1:00 - 2:00] 설치 및 기본 사용법 npm install open-hangul-ai 명령어로 설치하고,
간단한 import 몇 줄이면 끝입니다. [코드 데모: 기본 HWPXViewer]

[2:00 - 3:00] 고급 기능 AI 분석, 테마 커스터마이징, 다양한 이벤트 핸들링도
가능합니다. [코드 데모: AI 기능, 테마 설정]

[3:00 - 4:00] 실제 프로젝트 적용 실제 프로젝트에서는 이렇게 사용할 수 있습니다.
[실제 앱 데모]

[4:00 - 5:00] 마무리 GitHub 스타 부탁드리고, 문서도 확인해 보세요!

설명란 링크:

- GitHub: https://github.com/yatav-team/open-hangul-ai
- NPM: https://www.npmjs.com/package/open-hangul-ai
- 문서:
  https://github.com/yatav-team/open-hangul-ai/blob/main/docs/USAGE_GUIDE.md

```

## 📧 이메일 뉴스레터

```

Subject: 🎉 오픈한글AI v5.0.1 npm 패키지 출시!

안녕하세요!

한국 개발자와 한글 문서를 다루는 개발자들을 위한 좋은 소식을 전해드립니다.

오픈한글AI v5.0.1이 npm 패키지로 정식 출시되었습니다! 🚀

## 🎯 5분만에 한글 문서 뷰어 추가하기

```bash
npm install open-hangul-ai
```

```tsx
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return <HWPXViewer fileUrl="/문서.hwpx" />;
}
```

## ✨ 주요 기능

✅ HWPX, HWP 완벽 지원  
✅ AI 문서 분석 & 요약  
✅ TypeScript 타입 안전성  
✅ React 18+ 최적화  
✅ 반응형 디자인  
✅ MIT 라이센스

## 🚀 더 알아보기

📚 [사용 가이드](링크)  
💻 [GitHub](링크)  
📦 [NPM](링크)

궁금한 점이 있으시면 언제든 답장 주세요!

감사합니다. YATAV Team 드림

---

이 이메일 수신을 원하지 않으시면 [수신거부](링크)를 클릭해 주세요.

```

## 📊 홍보 효과 측정 KPI

### 단기 지표 (1주일)
- GitHub Stars 증가: 목표 100+
- npm 다운로드: 목표 500+
- 이슈/Discussion 활동: 목표 20+
- 소셜미디어 참여: 목표 50+

### 중기 지표 (1개월)
- GitHub Stars: 목표 500+
- npm 주간 다운로드: 목표 200+
- 커뮤니티 기여자: 목표 10+
- 기술 블로그 언급: 목표 5+

### 장기 지표 (3개월)
- GitHub Stars: 목표 1000+
- npm 월간 다운로드: 목표 2000+
- Production 사용 사례: 목표 20+
- 파트너십/콜라보레이션: 목표 3+

---

이 자료들을 활용해서 다양한 채널에서 오픈한글AI를 알려주세요! 🚀
```
