"""HalluGuard Core — 경량 REST API 서버

편집기 TruthAnchor 인터페이스 호환.
실행: uvicorn api:app --host 0.0.0.0 --port 8200
"""

import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from halluguard import __version__
from halluguard.config import configure, get_settings
from halluguard.pipeline import verify
from halluguard.engine.domain_adapters import list_domains


# ── Pydantic 스키마 ──────────────────────────────────────

class ValidateRequest(BaseModel):
    source_text: str = Field(..., min_length=1, description="원본 문서 텍스트 (Ground Truth)")
    llm_output: str = Field(..., min_length=1, description="LLM이 생성한 텍스트 (검증 대상)")
    domain: str = Field("general", description="도메인: general, finance, defense, government, education")


class BatchItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_text: str = Field(..., min_length=1)
    llm_output: str = Field(..., min_length=1)
    domain: str = "general"


class BatchRequest(BaseModel):
    items: list[BatchItem] = Field(..., min_length=1, max_length=50)


class ClaimResponse(BaseModel):
    claim_text: str
    verdict: str
    confidence: float
    evidence_text: str
    suggested_correction: str | None
    claim_order: int


class ValidateResponse(BaseModel):
    overall_score: float
    total_claims: int
    supported_claims: int
    contradicted_claims: int
    neutral_claims: int
    claims: list[ClaimResponse]
    multi_scores: dict
    corrected_text: str
    elapsed_ms: int


class BatchItemResponse(BaseModel):
    id: str
    result: ValidateResponse | None = None
    error: str | None = None


class BatchResponse(BaseModel):
    total: int
    completed: int
    failed: int
    results: list[BatchItemResponse]


class HealthResponse(BaseModel):
    status: str
    version: str
    llm_model: str
    nli_enabled: bool
    llm_verify_enabled: bool
    domains: list[str]


# ── FastAPI 앱 ───────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작 시 설정 로드"""
    settings = get_settings()
    model = settings.DEFAULT_LLM_MODEL or "(none - guardrail + NLI only)"
    print(f"HalluGuard Core v{__version__} started")
    print(f"  LLM Model : {model}")
    print(f"  NLI       : {'enabled' if settings.NLI_ENABLED else 'disabled'}")
    print(f"  LLM Verify: {'enabled' if settings.LLM_VERIFY_ENABLED and settings.DEFAULT_LLM_MODEL else 'disabled'}")
    yield


app = FastAPI(
    title="HalluGuard Core API",
    version=__version__,
    description="LLM 할루시네이션 검출·교정 엔진 — 독립 마이크로서비스",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 엔드포인트 ───────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=__version__,
        llm_model=settings.DEFAULT_LLM_MODEL or "none",
        nli_enabled=settings.NLI_ENABLED,
        llm_verify_enabled=settings.LLM_VERIFY_ENABLED and bool(settings.DEFAULT_LLM_MODEL),
        domains=[d["id"] for d in list_domains()],
    )


@app.post("/api/v2/validate", response_model=ValidateResponse)
async def validate(req: ValidateRequest):
    """단건 할루시네이션 검증"""
    start = time.time()

    try:
        result = await verify(
            source_text=req.source_text,
            llm_output=req.llm_output,
            domain=req.domain,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

    elapsed_ms = int((time.time() - start) * 1000)
    result_dict = result.to_dict()
    result_dict["elapsed_ms"] = elapsed_ms
    return result_dict


@app.post("/api/v2/validate/batch", response_model=BatchResponse)
async def validate_batch(req: BatchRequest):
    """배치 할루시네이션 검증 (최대 50건)"""
    results: list[BatchItemResponse] = []
    completed = 0
    failed = 0

    for item in req.items:
        start = time.time()
        try:
            result = await verify(
                source_text=item.source_text,
                llm_output=item.llm_output,
                domain=item.domain,
            )
            elapsed_ms = int((time.time() - start) * 1000)
            result_dict = result.to_dict()
            result_dict["elapsed_ms"] = elapsed_ms
            results.append(BatchItemResponse(id=item.id, result=ValidateResponse(**result_dict)))
            completed += 1
        except Exception as e:
            results.append(BatchItemResponse(id=item.id, error=str(e)))
            failed += 1

    return BatchResponse(
        total=len(req.items),
        completed=completed,
        failed=failed,
        results=results,
    )
