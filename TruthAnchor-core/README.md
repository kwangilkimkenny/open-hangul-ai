# HalluGuard Core

**v0.2.0** — LLM 할루시네이션 검출·교정 독립 엔진

외부 DB/벡터 DB 없이 **stateless REST API**로 동작하는 경량 마이크로서비스.
원본 텍스트와 LLM 출력을 받아 4계층 검증 → 5차원 스코어링 → 수정문 생성을 수행합니다.

---

## 빠른 시작

### 방법 1: 직접 실행

```bash
cd halluguard-core

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env에서 OPENAI_API_KEY 설정

# 서버 실행
uvicorn api:app --host 0.0.0.0 --port 8200
```

### 방법 2: Docker

```bash
cd halluguard-core

# .env 파일에 OPENAI_API_KEY 설정 후
docker compose up -d

# 또는 환경변수 직접 전달
OPENAI_API_KEY=sk-... docker compose up -d
```

### 서버 확인

```bash
curl http://localhost:8200/health
```

```json
{
  "status": "ok",
  "version": "0.2.0",
  "llm_model": "openai/gpt-4-turbo-preview",
  "nli_enabled": true,
  "llm_verify_enabled": true,
  "domains": ["finance", "defense", "government", "education", "general"]
}
```

---

## API 명세

### POST `/api/v2/validate` — 단건 검증

```bash
curl -X POST http://localhost:8200/api/v2/validate \
  -H "Content-Type: application/json" \
  -d '{
    "source_text": "한국은행의 기준금리는 2026년 3월 기준 3.5%입니다.",
    "llm_output": "한국은행의 기준금리는 5.5%입니다.",
    "domain": "finance"
  }'
```

**응답:**

```json
{
  "overall_score": 0.0,
  "total_claims": 1,
  "supported_claims": 0,
  "contradicted_claims": 1,
  "neutral_claims": 0,
  "claims": [
    {
      "claim_text": "한국은행의 기준금리는 5.5%입니다.",
      "verdict": "contradicted",
      "confidence": 0.92,
      "evidence_text": "[수치 교차검증] 수치 불일치: 클레임 '5.5%' vs 근거 '3.5%' (문맥: 금리)",
      "suggested_correction": "한국은행의 기준금리는 3.5%입니다.",
      "claim_order": 0
    }
  ],
  "multi_scores": {
    "factual_accuracy": 0.0,
    "numerical_accuracy": 0.0,
    "evidence_reliability": 0.9,
    "consistency": 1.0,
    "uncertainty_calibration": 1.0,
    "overall": 0.48
  },
  "corrected_text": "한국은행의 기준금리는 3.5%입니다.",
  "elapsed_ms": 2340
}
```

### POST `/api/v2/validate/batch` — 배치 검증 (최대 50건)

```bash
curl -X POST http://localhost:8200/api/v2/validate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "source_text": "GDP 성장률은 2.1%이다.",
        "llm_output": "GDP 성장률은 5.0%이다."
      },
      {
        "source_text": "인구는 5200만명이다.",
        "llm_output": "인구는 5200만명이다."
      }
    ]
  }'
```

### GET `/health` — 서버 상태

---

## 편집기 연동 가이드

### 1. Vite 프록시 설정

편집기의 `vite.config.ts`에 프록시 규칙을 추가합니다:

```ts
export default defineConfig({
  server: {
    port: 5090,
    proxy: {
      // 기존 OpenAI 프록시
      '/api/ai/chat': {
        target: 'https://api.openai.com',
        changeOrigin: true,
      },
      // HalluGuard 검증 API 추가
      '/api/v2/validate': {
        target: 'http://localhost:8200',
        changeOrigin: true,
      },
    },
  },
});
```

### 2. 프론트엔드에서 호출

```typescript
// src/lib/ai/truth-anchor.ts

interface ValidateRequest {
  source_text: string;
  llm_output: string;
  domain?: string;
}

interface ClaimResult {
  claim_text: string;
  verdict: 'supported' | 'contradicted' | 'neutral';
  confidence: number;
  evidence_text: string;
  suggested_correction: string | null;
  claim_order: number;
}

interface ValidateResponse {
  overall_score: number;
  total_claims: number;
  supported_claims: number;
  contradicted_claims: number;
  neutral_claims: number;
  claims: ClaimResult[];
  multi_scores: Record<string, number>;
  corrected_text: string;
  elapsed_ms: number;
}

export async function validateHallucination(
  sourceText: string,
  llmOutput: string,
  domain: string = 'general'
): Promise<ValidateResponse> {
  const response = await fetch('/api/v2/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_text: sourceText,
      llm_output: llmOutput,
      domain,
    }),
  });

  if (!response.ok) {
    throw new Error(`Validation failed: ${response.statusText}`);
  }

  return response.json();
}
```

### 3. 편집기 UI에서 사용

```typescript
// 검증 버튼 클릭 핸들러
async function handleValidate() {
  const sourceText = getDocumentText();  // 편집기의 원본 문서 텍스트
  const llmOutput = getAIGeneratedText(); // AI가 생성한 텍스트

  const result = await validateHallucination(sourceText, llmOutput, 'finance');

  // 클레임별 하이라이팅
  result.claims.forEach(claim => {
    if (claim.verdict === 'contradicted') {
      highlightText(claim.claim_text, 'red', claim.suggested_correction);
    } else if (claim.verdict === 'supported') {
      highlightText(claim.claim_text, 'green');
    } else {
      highlightText(claim.claim_text, 'yellow');
    }
  });

  // 5차원 스코어 표시
  showScorecard(result.multi_scores);
}
```

---

## 검증 파이프라인

```
원본 텍스트 (source_text)  +  LLM 출력 (llm_output)
         │                           │
         ▼                           ▼
    in-memory 청킹             클레임 추출 (복합문 분리)
         │                           │
         └───────────┬───────────────┘
                     ▼
         ┌── Layer 0: 가드레일 38규칙 (<1ms)
         ├── Layer 0.5: 수치 교차검증 (<1ms)
         ├── Layer 1: NLI 의미적 검증 (~50ms)
         └── Layer 2: LLM 재검증 (~2s, 선택)
                     │
                     ▼
         5차원 스코어링 + 수정문 생성
```

---

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `OPENAI_API_KEY` | 권장 | - | OpenAI API 키 (LLM 검증 + 수정문) |
| `HALLUGUARD_LLM_MODEL` | - | 자동 | LLM 모델 (예: `openai/gpt-4-turbo-preview`) |
| `ANTHROPIC_API_KEY` | - | - | Anthropic API 키 (대안) |
| `DEEPSEEK_API_KEY` | - | - | DeepSeek API 키 (대안) |

**API 키 없이도 동작합니다** — 가드레일 + 수치 교차검증 + NLI 검증은 로컬에서 실행됩니다. LLM 재검증과 수정문 생성만 비활성화됩니다.

---

## 패키지 구조

```
halluguard-core/
├── halluguard/
│   ├── __init__.py              # 공개 API: verify(), verify_sync()
│   ├── config.py                # 설정 (환경변수 자동 로드)
│   ├── pipeline.py              # 검증 파이프라인 오케스트레이터
│   ├── engine/
│   │   ├── claim_extractor.py   # 클레임 추출 (복합문 분리)
│   │   ├── evidence_matcher.py  # 근거 매칭 (in-memory)
│   │   ├── nli_verifier.py      # NLI 판정 (DeBERTa, softmax)
│   │   ├── llm_verifier.py      # LLM 재검증 (few-shot)
│   │   ├── numerical_verifier.py # 수치 교차검증
│   │   ├── domain_adapters.py   # 가드레일 38규칙
│   │   ├── multi_scorer.py      # 5차원 스코어링
│   │   ├── correction_generator.py # 수정문 생성
│   │   ├── entity_extractor.py  # 엔티티 추출
│   │   └── ontology.py          # 온톨로지 스키마
│   └── utils/
│       └── chunker.py           # 텍스트 청킹
├── api.py                       # FastAPI 서버
├── tests/
│   └── test_package.py          # 37개 테스트 (100% 통과)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

---

## 테스트

```bash
cd halluguard-core
PYTHONPATH=. pytest tests/ -v
```

---

## Python 라이브러리로 직접 사용

REST API 없이 Python 코드에서 직접 호출할 수도 있습니다:

```python
from halluguard import verify_sync
from halluguard.config import configure

# 설정 (선택)
configure(OPENAI_API_KEY="sk-...")

# 검증
result = verify_sync(
    source_text="한국은행의 기준금리는 3.5%입니다.",
    llm_output="한국은행의 기준금리는 5.5%입니다.",
    domain="finance",
)

print(f"Score: {result.overall_score}")
print(f"Contradicted: {result.contradicted_claims}")
for claim in result.claims:
    print(f"  [{claim.verdict}] {claim.claim_text}")
    if claim.suggested_correction:
        print(f"    → {claim.suggested_correction}")
```
