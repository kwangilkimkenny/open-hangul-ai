# GitHub Release 생성 가이드

## 🚀 자동 릴리스 생성 (CLI)

### 1. GitHub CLI 설정

```bash
# GitHub CLI 로그인
gh auth login

# 토큰 사용시
export GH_TOKEN="your_github_token"
```

### 2. 릴리스 생성

```bash
# v5.0.1 릴리스 생성
gh release create v5.0.1 \
  --title "🎉 v5.0.1: 첫 번째 npm 패키지 릴리스" \
  --notes-file docs/RELEASE_NOTES.md \
  --latest

# 성공 메시지 확인
gh release view v5.0.1
```

### 3. 추가 파일 업로드 (선택사항)

```bash
# 빌드 파일 첨부
gh release upload v5.0.1 \
  hanview-react-dist/open-hangul-ai.es.js \
  hanview-react-dist/open-hangul-ai.umd.js \
  hanview-react-dist/open-hangul-ai.css
```

## 🖱 웹 인터페이스 릴리스 생성

### 1. GitHub 저장소 접속

https://github.com/yatav-team/open-hangul-ai/releases/new

### 2. 릴리스 정보 입력

- **Tag version**: `v5.0.1` (기존 태그 선택)
- **Release title**: `🎉 v5.0.1: 첫 번째 npm 패키지 릴리스`
- **Description**: 아래 내용 복사/붙여넣기

### 3. 릴리스 설명 (Copy & Paste)

````markdown
# 🎉 첫 번째 npm 패키지 출시

오픈한글AI가 드디어 npm 패키지로 출시되었습니다! 이제
`npm install open-hangul-ai` 명령어 하나로 한글 문서 뷰어와 AI 편집 기능을 React
프로젝트에 쉽게 추가할 수 있습니다.

## ⚡ 주요 하이라이트

### 📦 간편한 설치

```bash
npm install open-hangul-ai
```
````

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

## 📊 기술 사양

| 항목              | 상세                                |
| ----------------- | ----------------------------------- |
| **React 지원**    | 18.0.0 이상                         |
| **TypeScript**    | 완전한 타입 정의                    |
| **번들 크기**     | 1.8MB (압축)                        |
| **브라우저 지원** | Chrome 90+, Firefox 88+, Safari 14+ |
| **라이센스**      | MIT                                 |

## 📚 문서

- [README](https://github.com/yatav-team/open-hangul-ai/blob/main/README.md) -
  빠른 시작 가이드
- [API 문서](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/API.md) -
  완전한 API 레퍼런스
- [사용 가이드](https://github.com/yatav-team/open-hangul-ai/blob/main/docs/USAGE_GUIDE.md) -
  상세한 사용법
- [기여 가이드](https://github.com/yatav-team/open-hangul-ai/blob/main/CONTRIBUTING.md) -
  기여하는 방법

## 🚀 시작하기

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

## 💬 커뮤니티

- **이슈 신고**:
  [GitHub Issues](https://github.com/yatav-team/open-hangul-ai/issues)
- **기능 요청**:
  [GitHub Discussions](https://github.com/yatav-team/open-hangul-ai/discussions)
- **이메일**: team@openhangulai.org

---

**🎯 오픈한글AI로 한국어 문서 편집의 새로운 시대를 열어보세요!**

Made with ❤️ by [YATAV Team](https://yatavent.com)

````

### 4. 릴리스 설정
- [ ] **Set as the latest release** 체크
- [ ] **Create a discussion for this release** 체크 (선택사항)
- [ ] **Set as a pre-release** 체크 해제

### 5. 릴리스 발행
**"Publish release"** 버튼 클릭

## 📈 릴리스 후 확인사항

### 1. 릴리스 페이지 확인
https://github.com/yatav-team/open-hangul-ai/releases/tag/v5.0.1

### 2. 자동 알림 확인
- GitHub Watchers 알림
- RSS 피드 업데이트
- Release Notes 이메일

### 3. 배지 업데이트
README의 배지들이 자동으로 최신 릴리스를 반영하는지 확인

### 4. 소셜 미디어 공유
생성된 릴리스 페이지 링크를 커뮤니티에 공유

## 🔄 자동화 (향후 개선)

### GitHub Actions 릴리스 자동화

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body_path: docs/RELEASE_NOTES.md
          draft: false
          prerelease: false
````

---

이 가이드를 따라 GitHub Release를 생성하면 프로젝트의 공식 릴리스가 완성됩니다!
🚀
