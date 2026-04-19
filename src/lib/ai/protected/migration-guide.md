# 보호된 모듈 마이그레이션 가이드

## 기존 코드 변경 방법

### Before (기존 AEGIS 사용)
```typescript
import { Aegis } from '../../../packages-aegis/aegis-sdk/src/index';

const aegis = new Aegis({
  blockThreshold: 50,
  sensitivity: 1.2,
  korean: { enabled: true }
});

const result = aegis.scan(userInput);
```

### After (보호된 모듈 사용)
```typescript
import { loadAEGIS } from './protected/loader';

const aegis = await loadAEGIS();
await aegis.configure({
  blockThreshold: 50,
  sensitivity: 1.2,
  korean: { enabled: true }
});

const result = await aegis.scan(userInput);
```

## 배포 시 파일 구조

### 오픈소스 배포
```
📦 hanview-opensource/
├── src/
│   ├── components/           # 모든 UI 컴포넌트
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── protected/
│   │   │   │   ├── interfaces.ts    # 공개 인터페이스
│   │   │   │   └── loader.ts       # 동적 로딩 로직
│   │   │   └── ...              # 기타 AI 기능들
│   │   └── ...
│   └── ...
├── lib/                     # 빌드 시 바이너리 모듈 배치
│   ├── aegis.wasm          # (없으면 원격 API 사용)
│   └── truthanchor.wasm    # (없으면 원격 API 사용)
└── README.md               # 설치 및 사용법
```

### 프로덕션 배포 (바이너리 포함)
```
📦 hanview-production/
├── lib/
│   ├── aegis.wasm          # 실제 바이너리
│   └── truthanchor.wasm    # 실제 바이너리
└── ...
```

## 라이센스 모델 제안

### 1. MIT + Commercial Modules
- **오픈소스 부분**: MIT 라이센스
- **AEGIS/TruthAnchor**: Commercial 라이센스 (바이너리만 배포)
- **API 서비스**: Freemium (기본 무료, 고급 유료)

### 2. Dual License
- **Community Edition**: 오픈소스 (기본 기능)
- **Enterprise Edition**: 상용 (고급 보안 기능 포함)

### 3. Open Core
- **Core**: 완전 오픈소스
- **Premium Modules**: 별도 구매/구독