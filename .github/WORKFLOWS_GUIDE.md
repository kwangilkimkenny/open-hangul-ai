# 🚀 GitHub Actions 워크플로우 가이드

Open Hangul AI 프로젝트는 포괄적인 CI/CD 파이프라인을 통해 코드 품질, 보안,
성능, 그리고 자동 배포를 관리합니다.

## 📋 워크플로우 개요

### 🧪 ci.yml - 지속적 통합

**트리거**: `main`, `develop` 브랜치 push 및 `main`으로의 PR

```yaml
├── 🔍 Lint & Type Check     # 코드 품질 검사
├── 🏗️ Build & Test          # 빌드 및 테스트
├── 🛡️ Security Audit        # 보안 감사
├── 📊 Bundle Analysis       # 번들 크기 분석 (main 브랜치만)
```

**주요 기능**:

- TypeScript 컴파일러 검사
- ESLint 코드 스타일 검증
- 단위 테스트 실행
- 프로덕션 빌드 검증
- npm audit 보안 검사
- 번들 크기 모니터링

### 🚀 release.yml - 자동 릴리스

**트리거**: `v*` 태그 push

```yaml
├── 📋 Validate Release      # 릴리스 검증 (changelog 확인)
├── 🏗️ Build & Test          # 릴리스용 빌드
├── 📦 npm Publish           # npm 패키지 발행
├── 🎉 GitHub Release        # GitHub 릴리스 생성
├── 📢 Notify Release        # 릴리스 알림 (stable만)
├── 📊 Post-Release Analysis # 릴리스 후 분석
└── 🧹 Cleanup              # 아티팩트 정리
```

**주요 기능**:

- 버전 태그 검증
- prerelease/stable 자동 구분
- CHANGELOG.md 엔트리 확인
- npm 패키지 자동 발행
- GitHub 릴리스 노트 생성
- 소셜 미디어 알림 템플릿 생성

### 🛡️ security.yml - 보안 및 컴플라이언스

**트리거**: `main`, `develop` push, PR, 주간 스케줄 (일요일 2시)

```yaml
├── 🔍 CodeQL Analysis       # GitHub CodeQL 보안 분석
├── 📊 Dependency Audit      # 의존성 보안 감사
├── 🛡️ Secrets Scan         # 하드코딩된 비밀 정보 스캔
├── 🔐 Security Headers      # 보안 헤더 검사 (main만)
├── 📝 License Check         # 라이선스 컴플라이언스
└── 📊 Security Summary      # 보안 검사 종합
```

**주요 기능**:

- JavaScript/TypeScript 코드 정적 분석
- Critical/High 취약점 자동 차단
- Gitleaks를 통한 비밀 정보 탐지
- 라이선스 호환성 검사
- 문제적 라이선스 (GPL 계열) 감지

### ⚡ performance.yml - 성능 모니터링

**트리거**: `main` push, PR, 일일 스케줄 (새벽 3시)

```yaml
├── 📊 Bundle Analysis       # 상세 번들 크기 분석
├── 🚀 Lighthouse           # 웹 성능 측정 (PR/main)
├── 📱 Memory Profiling      # 메모리 사용량 분석 (main만)
├── 📊 Dependency Tree       # 의존성 구조 분석
└── 📈 Performance Summary   # 성능 종합 리포트
```

**주요 기능**:

- 번들 크기 트렌드 추적
- Lighthouse 성능 지표 측정
- 메모리 누수 감지
- 순환 의존성 검사
- 미사용 의존성 탐지

### 📚 docs.yml - 문서화 및 배포

**트리거**: 문서 관련 파일 변경, 워크플로우 수동 실행

```yaml
├── 📖 Documentation Validation  # 문서 유효성 검사
├── 📚 TypeDoc Generation       # API 문서 생성
├── 📖 Storybook Build          # Storybook 빌드 (선택적)
├── 🌐 Deploy Documentation     # GitHub Pages 배포
├── 📊 Documentation Quality    # 문서 품질 검사
└── 📋 Update Notification      # 업데이트 알림
```

**주요 기능**:

- 마크다운 링크 유효성 검증
- 필수 문서 파일 확인
- TypeDoc API 문서 자동 생성
- GitHub Pages 자동 배포
- 문서 완성도 지표 측정

## 🔧 환경 변수 및 시크릿

### 필수 GitHub Secrets

```bash
NPM_TOKEN                    # npm 패키지 발행용 토큰
```

### 자동 설정되는 권한

```yaml
contents: read/write # 코드 및 릴리스 관리
security-events: write # 보안 이벤트 기록
pages: write # GitHub Pages 배포
id-token: write # OIDC 토큰 (Pages용)
```

## 📊 품질 게이트

### 🚫 빌드 실패 조건

- **Critical 보안 취약점** 발견
- **TypeScript 컴파일 오류**
- **필수 테스트 실패**
- **라이선스 문제** (GPL 계열)

### ⚠️ 경고 조건

- **High 취약점 5개 이상**
- **번들 크기 급증**
- **Lighthouse 점수 하락**
- **문서 누락**

## 🎯 성능 목표

### 📦 번들 크기

- **메인 JS**: < 500KB
- **CSS**: < 50KB
- **라이브러리 전체**: < 200KB

### 🚀 Lighthouse 점수

- **성능**: ≥ 80점
- **접근성**: ≥ 90점
- **모범 사례**: ≥ 90점
- **SEO**: ≥ 80점

## 🔄 브랜치 전략

### 🌿 브랜치별 워크플로우

```
main     ──► 🧪 CI + 🛡️ Security + ⚡ Performance + 📚 Docs
develop  ──► 🧪 CI + 🛡️ Security
feature/* ──► (PR 시) 🧪 CI + ⚡ Performance (Lighthouse만)
v*       ──► 🚀 Release
```

### 📋 릴리스 프로세스

1. **개발 완료** → `develop` 브랜치에서 작업
2. **main 병합** → PR을 통한 리뷰 및 병합
3. **태그 생성** → `v1.0.0` 형식으로 태그 생성
4. **자동 릴리스** → GitHub Actions가 자동 처리

## 🛠️ 로컬 개발

### 워크플로우 테스트

```bash
# 로컬에서 워크플로우와 동일한 검사 실행
npm run lint              # ESLint 검사
npm run test:run          # 단위 테스트
npm run build             # 프로덕션 빌드
npm audit                 # 보안 감사
```

### 릴리스 준비

```bash
# 1. CHANGELOG.md 업데이트
# 2. package.json 버전 업데이트
# 3. 변경사항 커밋
# 4. 태그 생성 및 푸시
git tag v1.0.0
git push origin v1.0.0
```

## 📈 모니터링

### 📊 대시보드

- **Actions 탭**: 모든 워크플로우 실행 현황
- **Security 탭**: CodeQL 및 Dependabot 알림
- **Insights > Dependency graph**: 의존성 시각화
- **Settings > Pages**: 문서 배포 상태

### 🔔 알림 설정

```yaml
# .github/workflows/통합에서 Slack/Teams 알림 설정 가능
# 실패 시 이메일 알림은 GitHub 기본 제공
```

## 🚀 고급 설정

### 커스텀 환경 변수

```yaml
env:
  NODE_VERSION: '18' # Node.js 버전 통일
  BUNDLE_SIZE_LIMIT: '500KB' # 번들 크기 제한
  CACHE_KEY: 'v1' # 캐시 키 버전
```

### 조건부 실행

```yaml
# 특정 조건에서만 워크플로우 실행
if: contains(github.event.head_commit.message, '[skip ci]')
```

## 📚 참고 자료

- 🔧 **GitHub Actions 문서**: https://docs.github.com/actions
- 🛡️ **CodeQL 분석**: https://codeql.github.com/
- ⚡ **Lighthouse CI**: https://github.com/GoogleChrome/lighthouse-ci
- 📚 **TypeDoc**: https://typedoc.org/
- 📦 **npm 발행**: https://docs.npmjs.com/cli/publish

---

_이 가이드는 프로젝트 진화에 따라 지속적으로 업데이트됩니다. 질문이나 개선
제안은
[GitHub Discussions](https://github.com/kwangilkimkenny/open-hangul-ai/discussions)에
올려주세요._
