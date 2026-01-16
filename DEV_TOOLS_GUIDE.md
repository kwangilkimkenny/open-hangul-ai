# Development Tools Guide

**Project:** HAN-View React App v3 **Version:** 1.0.0 **Last Updated:**
2026-01-16

---

## Table of Contents

1. [Introduction](#introduction)
2. [Tools Overview](#tools-overview)
3. [Quick Start](#quick-start)
4. [Prettier - Code Formatting](#prettier---code-formatting)
5. [ESLint - Code Linting](#eslint---code-linting)
6. [Husky - Git Hooks](#husky---git-hooks)
7. [Lint-Staged - Pre-Commit Checks](#lint-staged---pre-commit-checks)
8. [Commitlint - Commit Message Validation](#commitlint---commit-message-validation)
9. [IDE Integration](#ide-integration)
10. [Troubleshooting](#troubleshooting)

---

## Introduction

이 가이드는 HAN-View React App의 개발 도구 및 코드 품질 자동화 시스템을
설명합니다. 다음 도구들이 통합되어 있습니다:

- **Prettier** - 코드 자동 포매팅
- **ESLint** - 코드 린팅 및 정적 분석
- **Husky** - Git 훅 자동화
- **Lint-Staged** - 스테이징된 파일만 검사
- **Commitlint** - 커밋 메시지 규칙 강제

---

## Tools Overview

### 설치된 도구

| 도구        | 버전    | 역할               |
| ----------- | ------- | ------------------ |
| Prettier    | ^3.8.0  | 코드 포매팅        |
| ESLint      | ^9.39.1 | 정적 코드 분석     |
| Husky       | ^9.1.7  | Git 훅 관리        |
| Lint-Staged | ^16.2.7 | 스테이징 파일 검사 |
| Commitlint  | ^20.3.1 | 커밋 메시지 검증   |

### 자동화 흐름

```
┌─────────────────────────────────────────────────────────┐
│ 1. git add <files>                                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. git commit -m "message"                              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Husky pre-commit hook 실행                            │
│    └─> Lint-Staged 실행                                 │
│        ├─> Prettier 포매팅 (자동 수정)                  │
│        └─> ESLint 린팅 (자동 수정)                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Husky commit-msg hook 실행                            │
│    └─> Commitlint 커밋 메시지 검증                       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. 커밋 성공 ✅                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 초기 설정

프로젝트를 클론한 후 한 번만 실행:

```bash
# 의존성 설치 (husky 자동 설치됨)
npm install

# Git 훅 확인
ls -la .husky/
```

### 일상적인 사용

```bash
# 파일 수정
vim src/App.tsx

# 코드 포매팅 (선택사항 - pre-commit 훅이 자동으로 함)
npm run format

# 린트 검사 (선택사항)
npm run lint

# 파일 스테이징
git add src/App.tsx

# 커밋 (자동으로 포매팅 + 린트 + 커밋 메시지 검증)
git commit -m "feat: add new feature to App component"
```

---

## Prettier - Code Formatting

### 설정 파일

**파일 위치**: `.prettierrc`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

### 주요 설정

| 옵션            | 값        | 설명                    |
| --------------- | --------- | ----------------------- |
| `semi`          | `true`    | 세미콜론 사용           |
| `singleQuote`   | `true`    | 홑따옴표 사용           |
| `printWidth`    | `100`     | 최대 줄 길이            |
| `tabWidth`      | `2`       | 탭 크기 (스페이스 2개)  |
| `trailingComma` | `"es5"`   | ES5 호환 trailing comma |
| `arrowParens`   | `"avoid"` | 화살표 함수 괄호 생략   |

### 명령어

```bash
# 모든 파일 포매팅
npm run format

# 포매팅 검사만 (수정 안 함)
npm run format:check

# 특정 파일/폴더만 포매팅
npx prettier --write src/components/

# 특정 파일만 검사
npx prettier --check src/App.tsx
```

### Ignore 규칙

**파일 위치**: `.prettierignore`

```
node_modules/
dist/
build/
coverage/
*.min.js
*.min.css
package-lock.json
```

---

## ESLint - Code Linting

### 설정 파일

**파일 위치**: `eslint.config.js`

### 주요 규칙

- React 19 + TypeScript 최적화
- React Hooks 규칙 강제
- 타입 안전성 검사
- 사용하지 않는 변수 경고

### 명령어

```bash
# 린트 검사
npm run lint

# 린트 검사 + 자동 수정
npm run lint:fix

# 특정 파일만 검사
npx eslint src/App.tsx

# 특정 파일 자동 수정
npx eslint --fix src/App.tsx
```

---

## Husky - Git Hooks

### 설정된 훅

#### 1. pre-commit

**파일 위치**: `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run lint-staged
npx lint-staged
```

**역할**: 커밋 전에 스테이징된 파일의 포매팅과 린트 검사

#### 2. commit-msg

**파일 위치**: `.husky/commit-msg`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Validate commit message with commitlint
npx --no -- commitlint --edit "$1"
```

**역할**: 커밋 메시지가 Conventional Commits 규칙을 따르는지 검증

### 훅 비활성화 (임시)

```bash
# 모든 Git 훅 비활성화
git commit --no-verify -m "message"

# 또는
HUSKY=0 git commit -m "message"
```

⚠️ **주의**: 품질 검사를 건너뛰므로 특별한 경우에만 사용하세요.

---

## Lint-Staged - Pre-Commit Checks

### 설정 파일

**파일 위치**: `.lintstagedrc.js`

```javascript
export default {
  // TypeScript and JavaScript files
  '*.{ts,tsx,js,jsx}': ['prettier --write', 'eslint --fix --max-warnings=0'],

  // JSON files
  '*.json': ['prettier --write'],

  // Markdown files
  '*.md': ['prettier --write'],

  // CSS files
  '*.css': ['prettier --write'],
};
```

### 동작 원리

1. **스테이징된 파일만 검사**: 전체 프로젝트가 아닌 `git add`된 파일만 처리
2. **자동 수정**: Prettier와 ESLint가 자동으로 문제 수정
3. **재스테이징**: 수정된 파일은 자동으로 다시 스테이징됨
4. **실패 시 커밋 중단**: 수정할 수 없는 오류가 있으면 커밋 차단

### 예시

```bash
# 파일 수정
echo "const x=1" > src/test.ts

# 스테이징
git add src/test.ts

# 커밋 시도
git commit -m "feat: add test file"

# Lint-Staged가 자동으로:
# 1. Prettier로 포매팅: "const x = 1;"
# 2. ESLint로 검사 및 수정
# 3. 수정된 파일 재스테이징
# 4. 커밋 진행
```

---

## Commitlint - Commit Message Validation

### 설정 파일

**파일 위치**: `commitlint.config.js`

### Conventional Commits 규칙

커밋 메시지 형식:

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### 허용되는 Type

| Type       | 설명                      | 예시                                 |
| ---------- | ------------------------- | ------------------------------------ |
| `feat`     | 새로운 기능 추가          | `feat: add search functionality`     |
| `fix`      | 버그 수정                 | `fix: resolve memory leak in viewer` |
| `docs`     | 문서만 수정               | `docs: update README`                |
| `style`    | 코드 스타일 수정 (포매팅) | `style: fix indentation`             |
| `refactor` | 코드 리팩토링             | `refactor: simplify parser logic`    |
| `perf`     | 성능 개선                 | `perf: optimize rendering`           |
| `test`     | 테스트 추가/수정          | `test: add unit tests for parser`    |
| `build`    | 빌드 시스템 수정          | `build: update vite config`          |
| `ci`       | CI/CD 설정 수정           | `ci: add GitHub Actions workflow`    |
| `chore`    | 기타 변경사항             | `chore: update dependencies`         |
| `revert`   | 이전 커밋 되돌리기        | `revert: revert commit abc123`       |

#### Scope (선택사항)

모듈/컴포넌트 이름:

```
feat(viewer): add zoom functionality
fix(parser): handle malformed HWPX files
docs(readme): update installation steps
```

#### Subject 규칙

- **최소 길이**: 10자
- **최대 길이**: 100자
- **대문자 시작 금지**: `Fix bug` (X) → `fix bug` (O)
- **마침표 금지**: `add feature.` (X) → `add feature` (O)
- **명령문 사용**: `added feature` (X) → `add feature` (O)

### 올바른 커밋 예시

✅ **좋은 예시**:

```bash
git commit -m "feat: add PDF export functionality"
git commit -m "fix: resolve table rendering issue in Chrome"
git commit -m "docs: add API documentation for viewer"
git commit -m "refactor: simplify command pattern implementation"
git commit -m "test: add unit tests for parser module"
```

✅ **Body와 Footer 포함**:

```bash
git commit -m "feat: add undo/redo functionality

Implement command pattern for undo/redo operations.
Uses WeakMap for memory optimization.

Closes #123"
```

❌ **잘못된 예시**:

```bash
# Type 없음
git commit -m "update code"

# Subject 너무 짧음
git commit -m "feat: fix"

# 대문자 시작
git commit -m "feat: Add feature"

# 마침표 사용
git commit -m "fix: resolve bug."

# 과거형 사용
git commit -m "feat: added feature"
```

### 커밋 메시지 템플릿

프로젝트 루트에 `.gitmessage` 파일 생성:

```
# <type>(<scope>): <subject> (최대 100자)
# |<----  최대 10자  ---->||<-----  나머지 90자  ----->|

# Body: 무엇을, 왜 변경했는지 설명 (선택사항)
# 72자에서 줄바꿈

# Footer: Issue 참조, Breaking Changes (선택사항)
# 예: Closes #123, BREAKING CHANGE: API 변경

# --- Type 목록 ---
# feat:     새로운 기능
# fix:      버그 수정
# docs:     문서만 변경
# style:    코드 스타일 (포매팅)
# refactor: 리팩토링
# perf:     성능 개선
# test:     테스트 추가/수정
# build:    빌드 시스템
# ci:       CI/CD 설정
# chore:    기타
# revert:   이전 커밋 되돌리기
```

템플릿 적용:

```bash
git config commit.template .gitmessage
```

---

## IDE Integration

### VS Code

#### 1. 필수 확장 프로그램 설치

`.vscode/extensions.json` 파일 이미 구성됨:

```json
{
  "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
```

#### 2. 저장 시 자동 포매팅

`.vscode/settings.json` 추가:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

#### 3. 단축키

| 단축키            | 동작                        |
| ----------------- | --------------------------- |
| `Shift + Alt + F` | 현재 파일 포매팅 (Prettier) |
| `Cmd/Ctrl + .`    | Quick Fix (ESLint 수정)     |
| `Cmd/Ctrl + S`    | 저장 (자동 포매팅)          |

### WebStorm / IntelliJ IDEA

#### 1. Prettier 설정

1. **Preferences** → **Languages & Frameworks** → **JavaScript** → **Prettier**
2. **Prettier package**: `<project>/node_modules/prettier`
3. **Run for files**: `{**/*,*}.{ts,tsx,js,jsx,json,css,md}`
4. ✅ **On save** 체크

#### 2. ESLint 설정

1. **Preferences** → **Languages & Frameworks** → **JavaScript** → **Code
   Quality Tools** → **ESLint**
2. ✅ **Automatic ESLint configuration**
3. ✅ **Run eslint --fix on save**

---

## Troubleshooting

### 문제 1: Husky 훅이 실행되지 않음

**증상**:

```bash
git commit -m "test"
# 포매팅이나 린트 검사 없이 바로 커밋됨
```

**해결 방법**:

```bash
# 1. Husky 재설치
rm -rf .husky
npm run prepare

# 2. 훅 실행 권한 확인
chmod +x .husky/*

# 3. Git 훅 디렉토리 확인
git config core.hooksPath
# 출력: .husky

# 4. 수동으로 설정
git config core.hooksPath .husky
```

### 문제 2: Commitlint 에러

**증상**:

```bash
git commit -m "Update code"
# ❌ subject may not be empty [subject-empty]
```

**해결 방법**:

```bash
# 올바른 형식으로 다시 커밋
git commit -m "chore: update code formatting"
```

### 문제 3: ESLint 에러로 커밋 실패

**증상**:

```bash
git commit -m "feat: add feature"
# ❌ ESLint found 3 errors
```

**해결 방법**:

```bash
# 1. 에러 확인
npm run lint

# 2. 자동 수정 시도
npm run lint:fix

# 3. 수동으로 수정 후 다시 커밋
git add .
git commit -m "feat: add feature"
```

### 문제 4: Prettier와 ESLint 충돌

**증상**:

- Prettier가 포매팅한 코드를 ESLint가 에러로 표시

**해결 방법**:

```bash
# 1. 설정 확인
# eslint.config.js에서 Prettier 규칙이 비활성화되어 있는지 확인

# 2. Prettier 먼저 실행 후 ESLint
npm run format
npm run lint:fix
```

### 문제 5: 훅 일시 비활성화 필요

**상황**:

- 긴급 핫픽스
- WIP 커밋

**해결 방법**:

```bash
# 한 번만 건너뛰기
git commit --no-verify -m "wip: work in progress"

# 또는
HUSKY=0 git commit -m "hotfix: critical bug fix"
```

⚠️ **주의**: 남용하지 말고, 나중에 정리 커밋을 만드세요.

### 문제 6: Node 버전 문제

**증상**:

```bash
npm install
# npm WARN EBADENGINE Unsupported engine
```

**해결 방법**:

```bash
# 1. Node 버전 확인
node -v

# 2. 권장 버전 설치 (20.x 또는 22.x)
# nvm 사용 시:
nvm install 20
nvm use 20

# 3. 재설치
npm install
```

---

## Best Practices

### 1. 자주 커밋하기

```bash
# ✅ 좋은 예: 작은 단위로 자주 커밋
git commit -m "feat: add search input component"
git commit -m "feat: add search functionality"
git commit -m "test: add search tests"

# ❌ 나쁜 예: 한 번에 모든 변경사항 커밋
git commit -m "feat: add complete search feature with tests and docs"
```

### 2. 의미 있는 커밋 메시지

```bash
# ✅ 좋은 예
git commit -m "fix: resolve memory leak in table renderer

The table renderer was not cleaning up event listeners,
causing memory to accumulate over time. This fix adds
proper cleanup in the destroy() method.

Closes #456"

# ❌ 나쁜 예
git commit -m "fix stuff"
```

### 3. Scope 일관성 유지

프로젝트 전체에서 일관된 scope 사용:

```bash
# 컴포넌트
feat(viewer): ...
feat(editor): ...
feat(parser): ...

# 기능
feat(ai): ...
feat(export): ...
feat(search): ...

# 인프라
ci(github): ...
build(vite): ...
```

### 4. Breaking Changes 명시

```bash
git commit -m "feat!: change API response format

BREAKING CHANGE: The API now returns data in a new format.
Update your code to use the new format:

Before: { content: [...] }
After: { data: { content: [...] } }

Migration guide: docs/MIGRATION.md"
```

### 5. 린트 에러는 즉시 수정

```bash
# 에러 발견 시 즉시 수정 커밋
git commit -m "fix: resolve linting errors in parser module"
```

---

## References

- [Prettier Documentation](https://prettier.io/docs/en/)
- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [Lint-Staged Documentation](https://github.com/lint-staged/lint-staged)
- [Commitlint Documentation](https://commitlint.js.org/)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)

---

**Last Updated:** 2026-01-16 **Version:** 1.0.0 **Maintainer:** Claude Code AI
