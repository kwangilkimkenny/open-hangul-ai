# Environment Variables Guide

**Project:** HAN-View React App v3 **Version:** 1.0.0 **Last Updated:**
2026-01-16

---

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [File Structure](#file-structure)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Security Guidelines](#security-guidelines)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

이 가이드는 HAN-View React App의 환경 변수 관리 시스템을 설명합니다. Vite의 환경
변수 시스템을 활용하여 개발, 스테이징, 프로덕션 환경을 분리하고 안전하게 설정을
관리합니다.

### 주요 기능

- ✅ **환경별 설정 분리** - Development, Production 환경 독립 관리
- ✅ **타입 안전성** - TypeScript 타입 정의로 자동완성 지원
- ✅ **보안 강화** - 민감한 정보 gitignore 처리
- ✅ **검증 기능** - 환경 변수 유효성 자동 검사
- ✅ **Helper 함수** - 타입 변환 및 기본값 처리

---

## Quick Start

### 1. 환경 파일 생성

```bash
# 개발 환경 설정
cp .env.example .env.development

# 로컬 오버라이드 (gitignore됨)
cp .env.example .env.local

# 프로덕션 환경 설정
cp .env.example .env.production
```

### 2. API 키 설정 (선택사항)

`.env.local` 파일에 개발용 API 키 추가:

```bash
# .env.local
VITE_OPENAI_API_KEY=sk-your-api-key-here
```

⚠️ **중요**: `.env.local` 파일은 절대 git에 커밋하지 마세요!

### 3. 개발 서버 실행

```bash
npm run dev
```

환경 변수는 자동으로 로드되며, 콘솔에서 확인할 수 있습니다.

---

## File Structure

### 환경 파일 계층 구조

```
project-root/
├── .env.example          # 템플릿 파일 (git에 커밋됨)
├── .env.development      # 개발 환경 설정 (git에 커밋됨)
├── .env.production       # 프로덕션 환경 설정 (git에 커밋됨)
├── .env.local            # 로컬 오버라이드 (gitignore됨) ⚠️
├── .env.development.local# 개발 로컬 오버라이드 (gitignore됨) ⚠️
└── .env.production.local # 프로덕션 로컬 오버라이드 (gitignore됨) ⚠️
```

### 로드 우선순위 (높음 → 낮음)

1. `.env.[mode].local` - 환경별 로컬 오버라이드
2. `.env.[mode]` - 환경별 설정
3. `.env.local` - 공통 로컬 오버라이드
4. `.env` - 공통 기본값

**예시 (development 모드)**:

```
.env.development.local → .env.development → .env.local → .env
```

---

## Environment Variables Reference

### OpenAI API Configuration

| 변수명                     | 타입   | 기본값                                       | 설명                     |
| -------------------------- | ------ | -------------------------------------------- | ------------------------ |
| `VITE_OPENAI_API_KEY`      | string | -                                            | OpenAI API 키 (선택사항) |
| `VITE_OPENAI_API_ENDPOINT` | string | `https://api.openai.com/v1/chat/completions` | API 엔드포인트           |
| `VITE_OPENAI_MODEL`        | string | `gpt-4-turbo-preview`                        | 사용할 GPT 모델          |
| `VITE_OPENAI_TEMPERATURE`  | number | `0.7`                                        | Temperature (0.0 ~ 2.0)  |
| `VITE_OPENAI_MAX_TOKENS`   | number | `4000`                                       | 최대 토큰 수             |
| `VITE_OPENAI_TIMEOUT`      | number | `120000`                                     | API 타임아웃 (ms)        |

### Custom API Configuration

| 변수명                     | 타입    | 기본값  | 설명                  |
| -------------------------- | ------- | ------- | --------------------- |
| `VITE_CUSTOM_API_ENABLED`  | boolean | `false` | 커스텀 API 활성화     |
| `VITE_CUSTOM_API_ENDPOINT` | string  | -       | 커스텀 API 엔드포인트 |
| `VITE_CUSTOM_API_KEY`      | string  | -       | 커스텀 API 키         |

### Application Configuration

| 변수명             | 타입   | 기본값               | 설명           |
| ------------------ | ------ | -------------------- | -------------- |
| `VITE_APP_NAME`    | string | `HAN-View React App` | 앱 이름        |
| `VITE_APP_VERSION` | string | `3.0.0`              | 앱 버전        |
| `VITE_PORT`        | number | `5090`               | 개발 서버 포트 |
| `VITE_BASE_URL`    | string | `/`                  | 베이스 URL     |

### File Upload Configuration

| 변수명                         | 타입   | 기본값  | 설명                    |
| ------------------------------ | ------ | ------- | ----------------------- |
| `VITE_MAX_FILE_SIZE_MB`        | number | `50`    | 최대 파일 크기 (MB)     |
| `VITE_ALLOWED_FILE_EXTENSIONS` | string | `.hwpx` | 허용 확장자 (쉼표 구분) |

### Logging Configuration

| 변수명                                | 타입    | 기본값       | 설명                                         |
| ------------------------------------- | ------- | ------------ | -------------------------------------------- |
| `VITE_LOG_LEVEL`                      | enum    | `info`       | 로그 레벨 (`debug`, `info`, `warn`, `error`) |
| `VITE_ENABLE_CONSOLE_LOG`             | boolean | `true` (dev) | 콘솔 로그 활성화                             |
| `VITE_ENABLE_PERFORMANCE_MEASUREMENT` | boolean | `true`       | 성능 측정 활성화                             |

### Feature Flags

| 변수명                    | 타입    | 기본값  | 설명                 |
| ------------------------- | ------- | ------- | -------------------- |
| `VITE_ENABLE_AI_FEATURES` | boolean | `true`  | AI 기능 활성화       |
| `VITE_ENABLE_TABLE_EDIT`  | boolean | `true`  | 테이블 편집 활성화   |
| `VITE_ENABLE_IMAGE_EDIT`  | boolean | `true`  | 이미지 편집 활성화   |
| `VITE_ENABLE_SHAPE_EDIT`  | boolean | `true`  | 도형 편집 활성화     |
| `VITE_ENABLE_PDF_EXPORT`  | boolean | `true`  | PDF 내보내기 활성화  |
| `VITE_ENABLE_HWPX_EXPORT` | boolean | `true`  | HWPX 내보내기 활성화 |
| `VITE_ENABLE_AUTO_SAVE`   | boolean | `true`  | 자동 저장 활성화     |
| `VITE_AUTO_SAVE_INTERVAL` | number  | `30000` | 자동 저장 간격 (ms)  |

### UI Configuration

| 변수명                          | 타입    | 기본값   | 설명                                   |
| ------------------------------- | ------- | -------- | -------------------------------------- |
| `VITE_CHAT_PANEL_DEFAULT_STATE` | enum    | `closed` | 채팅 패널 기본 상태 (`open`, `closed`) |
| `VITE_ENABLE_DARK_MODE`         | boolean | `false`  | 다크 모드 지원                         |
| `VITE_DEFAULT_LANGUAGE`         | enum    | `ko`     | 기본 언어 (`ko`, `en`)                 |

### Security Configuration

| 변수명                           | 타입    | 기본값        | 설명                           |
| -------------------------------- | ------- | ------------- | ------------------------------ |
| `VITE_ENABLE_CSP`                | boolean | `true` (prod) | Content Security Policy 활성화 |
| `VITE_FORCE_HTTPS`               | boolean | `true` (prod) | HTTPS 강제                     |
| `VITE_ENABLE_API_KEY_ENCRYPTION` | boolean | `true`        | API 키 암호화                  |

### Cost Management

| 변수명                        | 타입    | 기본값    | 설명                    |
| ----------------------------- | ------- | --------- | ----------------------- |
| `VITE_ENABLE_COST_TRACKING`   | boolean | `true`    | 비용 추적 활성화        |
| `VITE_COST_WARNING_THRESHOLD` | number  | `1.0`     | 비용 경고 임계값 (USD)  |
| `VITE_COST_MAX_LIMIT`         | number  | `10.0`    | 최대 허용 비용 (USD)    |
| `VITE_COST_PER_INPUT_TOKEN`   | number  | `0.00001` | Input token 비용 (USD)  |
| `VITE_COST_PER_OUTPUT_TOKEN`  | number  | `0.00003` | Output token 비용 (USD) |

### Debug & Development

| 변수명                       | 타입    | 기본값       | 설명           |
| ---------------------------- | ------- | ------------ | -------------- |
| `VITE_DEBUG_MODE`            | boolean | `false`      | 디버그 모드    |
| `VITE_LOG_API_REQUESTS`      | boolean | `false`      | API 요청 로깅  |
| `VITE_LOG_API_RESPONSES`     | boolean | `false`      | API 응답 로깅  |
| `VITE_ENABLE_SOURCEMAP`      | boolean | `true` (dev) | 소스맵 활성화  |
| `VITE_ENABLE_REACT_DEVTOOLS` | boolean | `true` (dev) | React DevTools |

---

## Usage Examples

### 기본 사용법 (JavaScript/TypeScript)

```typescript
// 직접 접근
const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const logLevel = import.meta.env.VITE_LOG_LEVEL;

// Helper 함수 사용 (권장)
import { getEnvString, getEnvNumber, getEnvBoolean } from '@/utils/env';

const apiKey = getEnvString('VITE_OPENAI_API_KEY', '');
const maxTokens = getEnvNumber('VITE_OPENAI_MAX_TOKENS', 4000);
const debugMode = getEnvBoolean('VITE_DEBUG_MODE', false);
```

### 환경 설정 객체 생성

```typescript
import { createEnvConfig } from '@/utils/env';

// 모든 환경 변수를 타입 안전한 객체로 변환
const config = createEnvConfig();

// 사용
console.log(config.openai.model); // 'gpt-4-turbo-preview'
console.log(config.features.ai); // true
console.log(config.logging.level); // 'info'
```

### Feature Flag 확인

```typescript
import { isFeatureEnabled } from '@/utils/env';

// AI 기능이 활성화되어 있는지 확인
if (isFeatureEnabled('AI_FEATURES')) {
  // AI 기능 초기화
  initializeAI();
}

// PDF 내보내기가 활성화되어 있는지 확인
if (isFeatureEnabled('PDF_EXPORT')) {
  showPdfExportButton();
}
```

### 환경 검증

```typescript
import { validateEnv, printEnvInfo } from '@/utils/env';

// 개발 모드에서 환경 정보 출력
printEnvInfo();

// 환경 변수 검증
const validation = validateEnv();

if (!validation.isValid) {
  console.error('Environment validation failed:');
  validation.errors.forEach(error => console.error(error));
}

if (validation.warnings.length > 0) {
  console.warn('Environment warnings:');
  validation.warnings.forEach(warning => console.warn(warning));
}
```

### 조건부 기능 초기화

```typescript
import { isDevelopment, isProduction, getEnvBoolean } from '@/utils/env';

// 개발 환경에서만 실행
if (isDevelopment()) {
  console.log('Running in development mode');
  enableDevTools();
}

// 프로덕션 환경에서만 실행
if (isProduction()) {
  console.log('Running in production mode');
  initializeAnalytics();
}

// 디버그 모드 확인
if (getEnvBoolean('VITE_DEBUG_MODE')) {
  enableDetailedLogging();
}
```

---

## Best Practices

### 1. 민감한 정보 관리

```bash
# ✅ 올바른 방법: .env.local에 저장 (gitignore됨)
# .env.local
VITE_OPENAI_API_KEY=sk-your-secret-key

# ❌ 잘못된 방법: .env.development에 저장 (git에 커밋됨)
# .env.development
VITE_OPENAI_API_KEY=sk-your-secret-key  # 위험!
```

### 2. 환경별 설정 분리

```bash
# .env.development - 개발 환경
VITE_LOG_LEVEL=debug
VITE_ENABLE_CONSOLE_LOG=true
VITE_DEBUG_MODE=true

# .env.production - 프로덕션 환경
VITE_LOG_LEVEL=warn
VITE_ENABLE_CONSOLE_LOG=false
VITE_DEBUG_MODE=false
```

### 3. 기본값 제공

```typescript
// ✅ 항상 기본값 제공
const maxTokens = getEnvNumber('VITE_OPENAI_MAX_TOKENS', 4000);

// ❌ 기본값 없이 사용하면 undefined 가능성
const maxTokens = Number(import.meta.env.VITE_OPENAI_MAX_TOKENS);
```

### 4. TypeScript 타입 활용

```typescript
// ✅ 타입 안전한 접근
import type { ImportMetaEnv } from '../env';

function getConfig(key: keyof ImportMetaEnv) {
  return import.meta.env[key];
}

// ❌ 타입 없이 접근하면 오타 위험
const value = import.meta.env.VITE_OPENAI_APIKEY; // 오타: API_KEY가 아님
```

### 5. 환경 검증

```typescript
// 앱 초기화 시 환경 검증
import { validateEnv } from '@/utils/env';

function initializeApp() {
  const validation = validateEnv();

  if (!validation.isValid) {
    throw new Error(
      `Environment validation failed: ${validation.errors.join(', ')}`
    );
  }

  // 앱 초기화 계속...
}
```

---

## Security Guidelines

### 1. API 키 보안

**✅ 안전한 방법**:

```bash
# 1. 로컬 파일에만 저장 (.env.local)
VITE_OPENAI_API_KEY=sk-your-key

# 2. 서버 환경 변수 사용 (프로덕션)
# Docker: -e VITE_OPENAI_API_KEY=sk-your-key
# Vercel: Dashboard에서 설정
# AWS: Systems Manager Parameter Store
```

**❌ 위험한 방법**:

```bash
# git에 커밋되는 파일에 저장
# .env.development (커밋됨)
VITE_OPENAI_API_KEY=sk-your-key  # 절대 이렇게 하지 마세요!
```

### 2. 프로덕션 설정

프로덕션 환경에서는 다음 설정을 **반드시** 적용하세요:

```bash
# .env.production
VITE_LOG_LEVEL=warn
VITE_ENABLE_CONSOLE_LOG=false
VITE_DEBUG_MODE=false
VITE_ENABLE_CSP=true
VITE_FORCE_HTTPS=true
VITE_ENABLE_SOURCEMAP=false
```

### 3. .gitignore 확인

```gitignore
# .gitignore
.env
.env.local
.env.*.local

# .env.example은 커밋됨 (템플릿 파일)
!.env.example
```

### 4. API 키 로테이션

```bash
# API 키 변경 시:
1. OpenAI 대시보드에서 새 키 생성
2. .env.local 업데이트
3. 서버 환경 변수 업데이트
4. 이전 키 폐기
```

---

## Troubleshooting

### 문제 1: 환경 변수가 로드되지 않음

**증상**:

```typescript
console.log(import.meta.env.VITE_OPENAI_API_KEY); // undefined
```

**해결 방법**:

1. **VITE\_ 접두사 확인**:

   ```bash
   # ❌ 잘못됨
   OPENAI_API_KEY=sk-key

   # ✅ 올바름
   VITE_OPENAI_API_KEY=sk-key
   ```

2. **개발 서버 재시작**:

   ```bash
   # 환경 변수 변경 후 반드시 재시작
   npm run dev
   ```

3. **파일 위치 확인**:
   ```bash
   # 프로젝트 루트에 위치해야 함
   project-root/
   ├── .env.development
   ├── .env.local
   └── vite.config.ts
   ```

### 문제 2: TypeScript 타입 에러

**증상**:

```typescript
// Property 'VITE_OPENAI_API_KEY' does not exist on type 'ImportMetaEnv'
```

**해결 방법**:

1. `src/env.d.ts` 파일 확인
2. TypeScript 서버 재시작 (VS Code: Cmd+Shift+P → "Restart TS Server")

### 문제 3: 프로덕션 빌드에서 환경 변수 누락

**증상**:

```bash
npm run build
# 빌드 후 환경 변수가 undefined
```

**해결 방법**:

1. **빌드 명령어 확인**:

   ```bash
   # ✅ 올바름
   npm run build  # .env.production 자동 로드

   # ❌ 잘못됨
   vite build  # 직접 실행하면 환경 변수 누락 가능
   ```

2. **서버 환경 변수 설정**:

   ```bash
   # Docker
   docker run -e VITE_OPENAI_API_KEY=sk-key my-app

   # Vercel
   # Dashboard → Settings → Environment Variables
   ```

### 문제 4: 환경 변수 캐싱

**증상**:

- 환경 변수를 변경했지만 이전 값이 계속 사용됨

**해결 방법**:

```bash
# Vite 캐시 삭제
rm -rf node_modules/.vite

# 개발 서버 재시작
npm run dev
```

### 문제 5: 다른 환경 파일이 로드됨

**증상**:

- `npm run dev`인데 production 설정이 로드됨

**해결 방법**:

1. **MODE 확인**:

   ```json
   // package.json
   {
     "scripts": {
       "dev": "vite", // development 모드
       "build": "vite build" // production 모드
     }
   }
   ```

2. **명시적 모드 지정**:

   ```bash
   # 강제로 development 모드
   vite --mode development

   # 강제로 production 모드
   vite --mode production
   ```

---

## Advanced Topics

### 커스텀 환경 모드

```bash
# .env.staging 생성
VITE_APP_NAME=HAN-View (Staging)
VITE_LOG_LEVEL=info
VITE_OPENAI_API_ENDPOINT=https://staging-api.example.com

# 실행
vite --mode staging
```

### 런타임 환경 변수 오버라이드

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    define: {
      // 런타임에 환경 변수 오버라이드
      'import.meta.env.VITE_BUILD_TIME': JSON.stringify(
        new Date().toISOString()
      ),
    },
  };
});
```

### 서버 전용 환경 변수

```typescript
// vite.config.ts에서만 접근 가능
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // SERVER_로 시작하는 변수는 클라이언트에 노출되지 않음
  console.log(env.SERVER_SECRET_KEY); // OK in vite.config.ts

  return {
    // ...
  };
});
```

---

## References

- [Vite Environment Variables Documentation](https://vitejs.dev/guide/env-and-mode.html)
- [Security Audit Report](./SECURITY_AUDIT_REPORT.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [OpenAI API Documentation](https://platform.openai.com/docs)

---

**Last Updated:** 2026-01-16 **Version:** 1.0.0 **Maintainer:** Claude Code AI
