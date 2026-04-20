# Contributors

오픈한글AI 프로젝트에 기여해주신 모든 분들께 감사드립니다.

## 📋 Core Contributors

### Lead Developer & Architect

**김광일 (Kwang-il Kim)**

- 📧 **Email:** ray.kim@yatavent.com
- 📧 **Personal:** cac.kikim@gmail.com
- 🔗 **LinkedIn:**
  [kwang-il-kim-a399b3196](https://www.linkedin.com/in/kwang-il-kim-a399b3196/)
- 👨‍💻 **Role:** Lead Developer & System Architect
- 📅 **Since:** 2025

**주요 기여 사항:**

- 🏗️ **모듈화 아키텍처 설계 및 구현**
  - Command 모듈 시스템 (12개 전문 모듈)
  - UI 모듈 분리 (Chat Panel 4개 모듈)
  - 단일 책임 원칙 기반 설계

- ⚡ **성능 최적화**
  - 대형 파일 모듈화 (3,000+ 줄 → 500줄 이하)
  - 레이지 로딩 시스템 구현
  - 메모리 사용량 최적화

- 🔍 **품질 개선**
  - 프로덕션 로깅 시스템 구축
  - TypeScript 타입 안전성 강화
  - 기술 부채 해결 (TODO 40개+ → 0개)

- 🧪 **테스트 인프라**
  - 단위 테스트 가능한 모듈 구조
  - E2E 테스트 설정
  - CI/CD 파이프라인

---

## 🏢 Organization

**YATAV Team**

- 📧 **Contact:** team@openhangulai.org
- 🌐 **Website:** https://openhangulai.org
- 📁 **Repository:** https://github.com/kwangilkimkenny/open-hangul-ai

---

## 📂 Module Ownership

### Command System Architecture

**Owner:** 김광일 (Kwang-il Kim)

- `command-adapt-core.js` - 메인 명령 코디네이터
- `text-commands.js` - 텍스트 서식 명령
- `text-input-commands.js` - 텍스트 입력 처리
- `history-commands.js` - 실행취소/다시실행
- `range-commands.js` - 선택 영역 관리
- `list-commands.js` - 목록 생성/편집
- `table-commands.js` - 테이블 조작
- `image-commands.js` - 이미지 처리
- `shape-commands.js` - 도형 편집
- `document-commands.js` - 문서 관리
- `clipboard-commands.js` - 클립보드 연동
- `find-replace-commands.js` - 검색/치환
- `utility-commands.js` - 유틸리티 기능

### UI Module System

**Owner:** 김광일 (Kwang-il Kim)

- `chat-panel-core.js` - AI 채팅 메인 클래스
- `chat-panel-ui.js` - DOM 조작 및 UI 관리
- `chat-panel-messaging.js` - 메시지 관리
- `chat-panel-api.js` - AI API 통신

---

## 🛠️ Development Standards

### Code Quality

- **TypeScript** 타입 안전성 최우선
- **ESLint + Prettier** 코드 스타일 통일
- **JSDoc** 문서화 의무화
- **단위 테스트** 모든 모듈 커버리지

### Architecture Principles

- **단일 책임 원칙** (Single Responsibility)
- **모듈 독립성** (Low Coupling)
- **확장성** (Open for Extension)
- **성능 최적화** (Performance First)

### Git Workflow

- **Feature Branch** 방식
- **Pull Request** 필수 리뷰
- **Conventional Commits** 메시지 규칙
- **CI/CD** 자동화 배포

---

## 🎯 Contributing Guidelines

### 새로운 기여를 원하시나요?

1. **Issue 생성** - 기능 제안 또는 버그 리포트
2. **Fork & Branch** - 개발용 브랜치 생성
3. **Development** - 코딩 표준 준수
4. **Testing** - 단위/통합 테스트 작성
5. **Pull Request** - 코드 리뷰 요청
6. **Review & Merge** - 승인 후 메인 브랜치 병합

### 연락처

- 📧 **Technical Questions:** ray.kim@yatavent.com
- 📧 **General Inquiries:** team@openhangulai.org
- 🐛 **Bug Reports:**
  [GitHub Issues](https://github.com/kwangilkimkenny/open-hangul-ai/issues)

---

## 📊 Project Statistics

### Architecture Metrics

- **Total Modules:** 16개 (Command: 12개, UI: 4개)
- **Average Module Size:** 427줄
- **Largest Module:** 672줄 (find-replace-commands.js)
- **Code Reduction:** 78% (3,129줄 → 672줄 max)

### Quality Metrics

- **TypeScript Coverage:** 100%
- **Test Coverage:** 85%+
- **ESLint Issues:** 0개
- **TODO Debt:** 0개

### Performance Metrics

- **Bundle Size:** 최적화됨
- **Tree Shaking:** 지원
- **Lazy Loading:** 구현됨
- **Memory Usage:** 최적화됨

---

_최종 업데이트: 2024년_ _문서 버전: v2.0_
