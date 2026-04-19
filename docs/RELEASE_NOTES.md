# 릴리스 노트 v5.0.1

## 🎉 첫 번째 npm 패키지 출시

오픈한글AI가 드디어 npm 패키지로 출시되었습니다! 이제 `npm install open-hangul-ai` 명령어 하나로 한글 문서 뷰어와 AI 편집 기능을 React 프로젝트에 쉽게 추가할 수 있습니다.

## ⚡ 주요 하이라이트

### 📦 간편한 설치
```bash
npm install open-hangul-ai
```

### 🚀 5분 안에 시작
```tsx
import { HWPXViewer } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return <HWPXViewer fileUrl="/sample.hwpx" />;
}
```

### 🇰🇷 한글 문서 완벽 지원
- **HWPX**: 완전한 뷰어 및 편집 지원
- **HWP**: 읽기 지원
- **PDF, DOCX, XLSX, PPTX**: 다양한 형식 지원

### 🤖 AI 기능 내장
- 문서 분석 및 요약
- 실시간 AI 어시스턴트
- Vertex AI, OpenAI 등 다양한 프로바이더 지원

## ✨ 새로운 기능

### React 컴포넌트
- `HanViewApp`: 완전한 문서 편집기
- `HWPXViewer`: HWPX 전용 뷰어
- `HanViewProvider`: 상태 관리 Context
- `ErrorBoundary`: 에러 경계 컴포넌트

### React 훅스
- `useHanView`: 메인 상태 관리
- `useHanViewConfig`: 설정 관리
- `useHanViewTheme`: 테마 변경
- `useHotkeys`: 키보드 단축키
- `useDraftStream`: AI 스트리밍

### AI 통합 모듈
- `AIDocumentController`: 문서 AI 분석
- `DraftGenerator`: AI 문서 생성
- `DocumentStructureExtractor`: 구조 추출
- `VertexClient`: Google Vertex AI 클라이언트

### 보안 & 유틸리티
- 디지털 워터마크 (embed/extract)
- OCR 서비스 (Tesseract.js 통합)
- 문서 Diff 기능
- RAG 문서 추출
- 로깅 시스템

## 🎨 커스터마이징

### 테마 시스템
```tsx
const customTheme = {
  colors: {
    primary: '#007bff',
    background: '#ffffff'
  },
  fonts: {
    primary: 'Noto Sans KR'
  }
};

<HanViewApp config={{ theme: customTheme }} />
```

### 툴바 설정
```tsx
<HanViewApp 
  config={{
    toolbar: {
      enabled: true,
      buttons: ['save', 'ai', 'share'],
      position: 'top'
    }
  }} 
/>
```

## 📊 기술 사양

| 항목 | 상세 |
|------|------|
| **React 지원** | 18.0.0 이상 |
| **TypeScript** | 완전한 타입 정의 |
| **번들 크기** | 1.8MB (압축) |
| **브라우저 지원** | Chrome 90+, Firefox 88+, Safari 14+ |
| **라이센스** | MIT |

## 📈 성능

- ⚡ **빠른 로딩**: 지연 로딩 및 가상 스크롤링
- 🧠 **메모리 효율**: WeakMap 기반 상태 관리
- 🔄 **실시간 업데이트**: 30+ FPS 유지
- 📱 **반응형**: 모바일, 태블릿, 데스크톱 지원

## 🛠 개발자 친화적

### 완전한 TypeScript 지원
```tsx
interface HWPXViewerProps {
  fileUrl?: string;
  file?: File;
  width?: string | number;
  height?: string | number;
  onLoad?: (document: HWPXDocument) => void;
}
```

### 상세한 문서
- [사용 가이드](./docs/USAGE_GUIDE.md) - 단계별 상세 가이드
- [API 문서](./docs/API.md) - 완전한 API 레퍼런스
- TypeScript 타입 정의 포함

### 에러 처리
```tsx
<HWPXViewer
  fileUrl="/docs/sample.hwpx"
  onError={(error) => {
    console.error('파일 로드 실패:', error);
  }}
/>
```

## 🔮 로드맵

### v5.1.0 (예정)
- 실시간 협업 편집
- 더 많은 AI 프로바이더 (Anthropic Claude)
- 플러그인 시스템

### v5.2.0 (예정)
- 모바일 최적화
- 접근성 개선
- 성능 향상

### v6.0.0 (예정)
- 새로운 렌더링 엔진
- 웹 워커 지원
- PWA 기능

## 🐛 알려진 이슈

- Node.js 환경에서 `DOMMatrix` 에러 발생 (브라우저 전용 API)
- 대용량 파일(50MB+) 로딩 시 성능 저하 가능
- Internet Explorer 지원 안함

## 📞 지원 및 커뮤니티

### 문제 신고
- [GitHub Issues](https://github.com/yatav-team/open-hangul-ai/issues)
- 이메일: team@openhangulai.org

### 기여하기
1. Fork 저장소
2. 새 브랜치 생성
3. 변경사항 커밋
4. Pull Request 제출

### 커뮤니티
- [공식 홈페이지](https://openhangulai.org)
- [GitHub 저장소](https://github.com/yatav-team/open-hangul-ai)

## 🙏 감사의 말

오픈한글AI를 사용해주시는 모든 개발자분들께 감사드립니다. 여러분의 피드백과 기여가 이 프로젝트를 더욱 발전시킵니다.

## 📝 설치 및 시작하기

```bash
# 1. 패키지 설치
npm install open-hangul-ai

# 2. React 프로젝트에서 사용
import { HanViewApp } from 'open-hangul-ai';
import 'open-hangul-ai/styles';

function App() {
  return (
    <HanViewApp
      config={{
        theme: 'light',
        aiPanel: { enabled: true }
      }}
    />
  );
}
```

자세한 사용법은 [사용 가이드](./docs/USAGE_GUIDE.md)를 참조해주세요.

---

**🎯 오픈한글AI로 한국어 문서 편집의 새로운 시대를 열어보세요!**

Made with ❤️ by [YATAV Team](https://yatavent.com)