# 기여 가이드

오픈한글AI에 기여해 주셔서 감사합니다! 🎉

이 가이드는 프로젝트에 효과적으로 기여하는 방법을 설명합니다.

## 📋 목차

1. [행동 강령](#행동-강령)
2. [기여하기 전에](#기여하기-전에)
3. [기여 방법](#기여-방법)
4. [개발 환경 설정](#개발-환경-설정)
5. [코딩 스타일](#코딩-스타일)
6. [커밋 메시지](#커밋-메시지)
7. [Pull Request 가이드](#pull-request-가이드)
8. [이슈 리포팅](#이슈-리포팅)

## 행동 강령

이 프로젝트는 모든 기여자에게 열려있습니다. 서로를 존중하고 포용적인 환경을 만들어 주세요.

### 🤝 우리의 약속
- 모든 사람을 환영합니다
- 건설적인 피드백을 제공합니다
- 서로 다른 의견을 존중합니다
- 실수에서 배우는 문화를 만듭니다

## 기여하기 전에

### 🔍 먼저 확인해 주세요
1. [기존 이슈](https://github.com/yatav-team/open-hangul-ai/issues)를 검색해 보세요
2. [로드맵](./docs/ROADMAP_2026Q2_VIEWER_PIVOT.md)을 확인해 보세요
3. [API 문서](./docs/API.md)를 읽어보세요

### 💡 기여할 수 있는 영역
- 🐛 버그 수정
- ✨ 새로운 기능 개발
- 📚 문서 개선
- 🧪 테스트 작성
- 🎨 UI/UX 개선
- 🌐 번역 작업
- 📝 예제 코드 작성

## 기여 방법

### 1. Fork & Clone

```bash
# 저장소 Fork 후 Clone
git clone https://github.com/YOUR-USERNAME/open-hangul-ai.git
cd open-hangul-ai

# 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/yatav-team/open-hangul-ai.git
```

### 2. 브랜치 생성

```bash
# 새 브랜치 생성 (의미있는 이름 사용)
git checkout -b feature/awesome-feature
git checkout -b fix/bug-description
git checkout -b docs/improve-readme
```

### 3. 작업 및 커밋

```bash
# 변경사항 작업 후 커밋
git add .
git commit -m "feat: add awesome feature"
```

### 4. Push & Pull Request

```bash
# 변경사항 Push
git push origin feature/awesome-feature

# GitHub에서 Pull Request 생성
```

## 개발 환경 설정

### 📋 필수 요구사항
- Node.js 16.0.0 이상
- npm 또는 yarn
- Git

### 🛠 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드 테스트
npm run build

# 테스트 실행
npm test

# 라이브러리 빌드
npm run build:lib
```

### 🧪 테스트

```bash
# 단위 테스트
npm test

# E2E 테스트
npm run test:e2e

# 커버리지 확인
npm run test:coverage
```

## 코딩 스타일

### 📝 일반 원칙
- **명확성**: 코드는 명확하고 읽기 쉬워야 합니다
- **일관성**: 기존 코드 스타일을 따르세요
- **단순성**: 복잡함보다 단순함을 선택하세요

### 🎨 스타일 가이드

#### TypeScript/JavaScript
```tsx
// ✅ 좋은 예
interface UserProps {
  name: string;
  age: number;
}

const UserComponent: React.FC<UserProps> = ({ name, age }) => {
  return (
    <div className="user-card">
      <h2>{name}</h2>
      <p>Age: {age}</p>
    </div>
  );
};

// ❌ 나쁜 예
const UserComponent = (props: any) => {
  return <div><h2>{props.name}</h2><p>Age: {props.age}</p></div>;
};
```

#### CSS/스타일링
```css
/* ✅ 좋은 예 */
.user-card {
  padding: 16px;
  border-radius: 8px;
  background-color: var(--color-background);
}

.user-card__title {
  font-size: 1.2rem;
  font-weight: 600;
}

/* ❌ 나쁜 예 */
.usercard {
  padding: 16px; border-radius: 8px; background: #fff;
}
```

### 🔧 자동 포맷팅

```bash
# 코드 포맷팅
npm run format

# 린트 검사
npm run lint

# 린트 자동 수정
npm run lint:fix
```

## 커밋 메시지

### 📝 형식
[Conventional Commits](https://www.conventionalcommits.org/) 형식을 사용합니다:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 🏷 커밋 타입
- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `style`: 코드 스타일 변경 (기능 변경 없음)
- `refactor`: 리팩토링
- `test`: 테스트 추가/수정
- `chore`: 기타 변경사항

### ✨ 예시
```bash
# 기능 추가
git commit -m "feat: add HWPX password protection"

# 버그 수정
git commit -m "fix: resolve PDF rendering issue on Safari"

# 문서 업데이트
git commit -m "docs: update API documentation for HWPXViewer"

# 스코프 포함
git commit -m "feat(ai): add document summarization feature"
```

## Pull Request 가이드

### 📋 PR 체크리스트
- [ ] 브랜치명이 의미있게 작성되었나요?
- [ ] 커밋 메시지가 컨벤션을 따르나요?
- [ ] 테스트가 통과하나요?
- [ ] 문서가 업데이트되었나요?
- [ ] Breaking changes가 있다면 명시되었나요?

### 🎯 좋은 PR 만들기
1. **작은 단위로**: 하나의 PR은 하나의 기능/수정에 집중
2. **명확한 설명**: 무엇을, 왜, 어떻게 변경했는지 설명
3. **테스트 포함**: 가능한 한 테스트를 포함
4. **문서 업데이트**: API 변경 시 문서도 함께 업데이트

### 📝 PR 템플릿
PR을 생성할 때 자동으로 템플릿이 적용됩니다. 모든 섹션을 채워주세요.

## 이슈 리포팅

### 🐛 버그 리포트
1. [버그 리포트 템플릿](https://github.com/yatav-team/open-hangul-ai/issues/new?template=bug_report.md) 사용
2. 재현 가능한 단계 제공
3. 환경 정보 명시
4. 스크린샷 첨부 (UI 관련 버그)

### ✨ 기능 요청
1. [기능 요청 템플릿](https://github.com/yatav-team/open-hangul-ai/issues/new?template=feature_request.md) 사용
2. 구체적인 사용 사례 설명
3. 예상되는 동작 명시
4. 대안 고려사항 포함

### ❓ 질문
1. [질문 템플릿](https://github.com/yatav-team/open-hangul-ai/issues/new?template=question.md) 사용
2. 먼저 문서를 확인했는지 명시
3. 시도해본 해결 방법 나열
4. 환경 정보 제공

## 🏷 라벨 시스템

### 이슈 라벨
- `bug`: 버그 리포트
- `enhancement`: 새로운 기능 요청
- `question`: 질문이나 도움 요청
- `documentation`: 문서 관련
- `good first issue`: 초보자에게 좋은 이슈
- `help wanted`: 도움이 필요한 이슈

### 우선순위 라벨
- `priority:high`: 높은 우선순위
- `priority:medium`: 중간 우선순위
- `priority:low`: 낮은 우선순위

### 상태 라벨
- `needs-triage`: 분류 필요
- `in-progress`: 작업 중
- `blocked`: 차단됨
- `waiting-for-response`: 응답 대기

## 🎓 학습 자료

### 프로젝트 이해하기
- [README.md](./README.md): 프로젝트 개요
- [API 문서](./docs/API.md): 전체 API 레퍼런스
- [사용 가이드](./docs/USAGE_GUIDE.md): 상세 사용법

### 기술 스택
- **React**: UI 프레임워크
- **TypeScript**: 타입 시스템
- **Vite**: 빌드 도구
- **Vitest**: 테스트 프레임워크
- **Playwright**: E2E 테스트

## 📞 도움이 필요하세요?

### 💬 소통 채널
- **GitHub Issues**: 버그 리포트, 기능 요청
- **GitHub Discussions**: 일반적인 질문, 아이디어
- **이메일**: team@openhangulai.org

### 🤝 멘토링
새로운 기여자를 위한 멘토링을 제공합니다:
1. `good first issue` 라벨이 있는 이슈부터 시작
2. 질문이 있으면 언제든 문의
3. 코드 리뷰를 통한 학습

## 📜 라이센스

기여하시는 모든 코드는 [MIT 라이센스](./LICENSE)를 따릅니다.

---

다시 한번 오픈한글AI에 기여해 주셔서 감사합니다! 🙏

**Happy Coding!** 🚀