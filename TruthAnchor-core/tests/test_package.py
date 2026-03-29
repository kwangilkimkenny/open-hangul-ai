"""HalluGuard Core 독립 패키지 테스트

패키지가 외부 의존성(DB, Qdrant, Redis) 없이 독립적으로 동작하는지 검증.
"""

import pytest


# ═══════════════════════════════════════════════════════════════════
# 1. Config
# ═══════════════════════════════════════════════════════════════════

class TestConfig:
    def test_default_config(self):
        from halluguard.config import HalluGuardConfig
        cfg = HalluGuardConfig()
        assert cfg.NLI_ENABLED is True
        assert cfg.LLM_VERIFY_ENABLED is True
        assert cfg.DEFAULT_DOMAIN == "general"

    def test_configure(self):
        from halluguard.config import configure
        cfg = configure(OPENAI_API_KEY="sk-test", LLM_VERIFY_ENABLED=False)
        assert cfg.OPENAI_API_KEY == "sk-test"
        assert cfg.LLM_VERIFY_ENABLED is False
        # OpenAI 키 있으면 자동으로 모델 결정
        assert "openai" in cfg.DEFAULT_LLM_MODEL

    def test_configure_explicit_empty_overrides_env(self):
        """명시적으로 빈 값을 전달하면 환경변수보다 우선"""
        import os
        os.environ["OPENAI_API_KEY"] = "sk-from-env"
        from halluguard.config import configure
        cfg = configure(
            OPENAI_API_KEY="", ANTHROPIC_API_KEY="", DEEPSEEK_API_KEY="",
            DEFAULT_LLM_MODEL="",
        )
        # 명시적 빈 값이 환경변수를 덮어씀
        assert cfg.OPENAI_API_KEY == ""
        assert cfg.DEFAULT_LLM_MODEL == ""
        os.environ.pop("OPENAI_API_KEY", None)

    def test_get_settings_singleton(self):
        from halluguard.config import configure, get_settings
        configure(DEFAULT_LLM_MODEL="test-model")
        s = get_settings()
        assert s.DEFAULT_LLM_MODEL == "test-model"


# ═══════════════════════════════════════════════════════════════════
# 2. Claim Extractor
# ═══════════════════════════════════════════════════════════════════

class TestClaimExtractor:
    def test_basic_extraction(self):
        from halluguard.engine.claim_extractor import extract_claims
        claims = extract_claims("한국은행의 기준금리는 3.5%입니다.")
        assert len(claims) == 1

    def test_compound_split(self):
        from halluguard.engine.claim_extractor import extract_claims
        claims = extract_claims("GDP 성장률은 2.1%이고, 실업률은 3.5%이다.")
        assert len(claims) >= 2

    def test_filter_non_factual(self):
        from halluguard.engine.claim_extractor import extract_claims
        claims = extract_claims("안녕하세요. 감사합니다. GDP는 2.1%입니다.")
        assert len(claims) == 1
        assert "GDP" in claims[0]


# ═══════════════════════════════════════════════════════════════════
# 3. Evidence Matcher (Qdrant 없이 in-memory)
# ═══════════════════════════════════════════════════════════════════

class TestEvidenceMatcher:
    def test_string_match(self):
        from halluguard.engine.evidence_matcher import match_evidence
        chunks = [
            {"text": "한국은행의 기준금리는 3.5%이다."},
            {"text": "서울의 인구는 950만 명이다."},
        ]
        results = match_evidence("기준금리는 3.5%이다", chunks)
        assert len(results) >= 1
        assert "기준금리" in results[0]["text"]

    def test_empty_chunks(self):
        from halluguard.engine.evidence_matcher import match_evidence
        results = match_evidence("test", [])
        assert results == []


# ═══════════════════════════════════════════════════════════════════
# 4. NLI Verifier
# ═══════════════════════════════════════════════════════════════════

class TestNLIVerifier:
    def test_softmax(self):
        from halluguard.engine.nli_verifier import _softmax
        probs = _softmax([2.0, 1.0, 0.5])
        assert abs(sum(probs) - 1.0) < 1e-6

    def test_no_evidence(self):
        from halluguard.engine.nli_verifier import verify_claim
        result = verify_claim("test claim", [])
        assert result["verdict"] == "neutral"


# ═══════════════════════════════════════════════════════════════════
# 5. Numerical Verifier
# ═══════════════════════════════════════════════════════════════════

class TestNumericalVerifier:
    def test_mismatch(self):
        from halluguard.engine.numerical_verifier import cross_verify_numerics
        result = cross_verify_numerics("금리는 5.5%이다", ["기준금리는 3.5%이다"])
        assert result is not None
        assert result["mismatched"] is True

    def test_match(self):
        from halluguard.engine.numerical_verifier import cross_verify_numerics
        result = cross_verify_numerics("금리는 3.5%이다", ["기준금리는 3.5%이다"])
        assert result is None

    def test_context_category(self):
        from halluguard.engine.numerical_verifier import _contexts_compatible
        assert _contexts_compatible("금리", "이율") is True
        assert _contexts_compatible("금리", "인구") is False


# ═══════════════════════════════════════════════════════════════════
# 6. Domain Guardrails
# ═══════════════════════════════════════════════════════════════════

class TestGuardrails:
    def test_critical_detection(self):
        from halluguard.engine.domain_adapters import get_domain_adapter
        adapter = get_domain_adapter("general")
        hit = adapter.check_guardrails("이 주식을 매수 추천합니다")
        assert hit is not None
        assert hit["severity"] == "CRITICAL"
        assert hit["needs_nli_cross_check"] is False

    def test_high_cross_check(self):
        from halluguard.engine.domain_adapters import get_domain_adapter
        adapter = get_domain_adapter("finance")
        hit = adapter.check_guardrails("카드 연회비 50000원")
        assert hit is not None
        assert hit["needs_nli_cross_check"] is True

    def test_clean_text(self):
        from halluguard.engine.domain_adapters import get_domain_adapter
        adapter = get_domain_adapter("general")
        hit = adapter.check_guardrails("한국은행은 통화정책을 담당합니다")
        assert hit is None

    def test_list_domains(self):
        from halluguard.engine.domain_adapters import list_domains
        domains = list_domains()
        ids = [d["id"] for d in domains]
        assert "general" in ids
        assert "finance" in ids


# ═══════════════════════════════════════════════════════════════════
# 7. Multi Scorer
# ═══════════════════════════════════════════════════════════════════

class TestMultiScorer:
    def test_scoring(self):
        from halluguard.engine.multi_scorer import compute_multi_scores
        result = compute_multi_scores([
            {"claim_text": "A", "verdict": "supported", "confidence": 0.9},
            {"claim_text": "B", "verdict": "contradicted", "confidence": 0.8},
        ])
        assert 0 <= result["overall"] <= 1
        assert result["factual_accuracy"] == 0.5

    def test_neutral_split(self):
        from halluguard.engine.multi_scorer import compute_multi_scores
        result = compute_multi_scores([
            {"claim_text": "A", "verdict": "neutral", "confidence": 0.7},
            {"claim_text": "B", "verdict": "neutral", "confidence": 0.3},
        ])
        assert result["details"]["neutral_informed"] == 1
        assert result["details"]["neutral_uninformed"] == 1

    def test_empty(self):
        from halluguard.engine.multi_scorer import compute_multi_scores
        result = compute_multi_scores([])
        assert result["overall"] == 0.0


# ═══════════════════════════════════════════════════════════════════
# 8. Chunker
# ═══════════════════════════════════════════════════════════════════

class TestChunker:
    def test_basic_chunk(self):
        from halluguard.utils.chunker import chunk_text
        text = "A " * 300  # 300 words
        chunks = chunk_text(text)
        assert len(chunks) >= 1
        for c in chunks:
            assert "text" in c
            assert "index" in c

    def test_empty(self):
        from halluguard.utils.chunker import chunk_text
        assert chunk_text("") == []


# ═══════════════════════════════════════════════════════════════════
# 9. LLM Verifier (JSON 파싱만 — API 호출 없음)
# ═══════════════════════════════════════════════════════════════════

class TestLLMVerifierParsing:
    def test_clean_json(self):
        from halluguard.engine.llm_verifier import _extract_json_from_text
        r = _extract_json_from_text('{"verdict":"supported","confidence":0.9,"reasoning":"ok"}')
        assert r["verdict"] == "supported"

    def test_codeblock(self):
        from halluguard.engine.llm_verifier import _extract_json_from_text
        r = _extract_json_from_text('```json\n{"verdict":"contradicted","confidence":0.8,"reasoning":"no"}\n```')
        assert r["verdict"] == "contradicted"

    def test_invalid(self):
        from halluguard.engine.llm_verifier import _extract_json_from_text
        r = _extract_json_from_text("이것은 JSON이 아닙니다")
        assert r is None


# ═══════════════════════════════════════════════════════════════════
# 10. Pipeline (E2E, LLM 비활성화 모드)
# ═══════════════════════════════════════════════════════════════════

class TestPipeline:
    def setup_method(self):
        from halluguard.config import configure
        configure(LLM_VERIFY_ENABLED=False)

    def test_basic_verification(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="한국은행의 기준금리는 3.5%입니다.",
            llm_output="한국은행의 기준금리는 5.5%입니다.",
        )
        assert result.total_claims >= 1
        assert result.contradicted_claims >= 1
        assert result.overall_score < 1.0

    def test_accurate_text(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="한국은행의 기준금리는 3.5%입니다.",
            llm_output="한국은행의 기준금리는 3.5%입니다.",
        )
        assert result.total_claims >= 1

    def test_empty_output(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="원본 문서 내용",
            llm_output="안녕하세요.",
        )
        assert result.total_claims == 0
        assert result.overall_score == 1.0

    def test_guardrail_detection(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="한국은행 기준금리 정보",
            llm_output="이 주식을 매수 추천합니다.",
        )
        assert result.contradicted_claims >= 1

    def test_result_has_multi_scores(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="GDP 성장률은 2.1%이다.",
            llm_output="GDP 성장률은 2.1%이다.",
        )
        assert "factual_accuracy" in result.multi_scores
        assert "overall" in result.multi_scores

    def test_to_dict(self):
        from halluguard.pipeline import verify_sync
        result = verify_sync(
            source_text="GDP 성장률은 2.1%이다.",
            llm_output="GDP 성장률은 5.0%이다.",
        )
        d = result.to_dict()
        assert isinstance(d, dict)
        assert "claims" in d
        assert "multi_scores" in d
        assert "corrected_text" in d


# ═══════════════════════════════════════════════════════════════════
# 11. API 엔드포인트 테스트
# ═══════════════════════════════════════════════════════════════════

class TestAPI:
    def setup_method(self):
        from halluguard.config import configure
        configure(LLM_VERIFY_ENABLED=False)

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from api import app
        return TestClient(app)

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "domains" in data

    def test_validate(self, client):
        resp = client.post("/api/v2/validate", json={
            "source_text": "한국은행의 기준금리는 3.5%입니다.",
            "llm_output": "한국은행의 기준금리는 5.5%입니다.",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_claims"] >= 1
        assert data["contradicted_claims"] >= 1
        assert "claims" in data
        assert "multi_scores" in data
        assert "elapsed_ms" in data

    def test_validate_batch(self, client):
        resp = client.post("/api/v2/validate/batch", json={
            "items": [
                {"source_text": "GDP 성장률은 2.1%이다.", "llm_output": "GDP 성장률은 5.0%이다."},
                {"source_text": "인구는 5200만명이다.", "llm_output": "인구는 5200만명이다."},
            ]
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["completed"] == 2

    def test_validate_empty_input(self, client):
        resp = client.post("/api/v2/validate", json={
            "source_text": "",
            "llm_output": "test",
        })
        assert resp.status_code == 422  # validation error

    def test_validate_with_domain(self, client):
        resp = client.post("/api/v2/validate", json={
            "source_text": "카드 연회비는 30000원입니다.",
            "llm_output": "카드 연회비는 50000원입니다.",
            "domain": "finance",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_claims"] >= 1
