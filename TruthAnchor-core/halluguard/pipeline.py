"""Stateless 할루시네이션 검증 파이프라인 오케스트레이터

외부 DB/벡터 DB 없이, source_text + llm_output만으로 전체 4계층 검증을 수행합니다.

흐름:
1. source_text → in-memory 청킹
2. llm_output → 클레임 추출 (복합문 분리)
3. 각 클레임별 4계층 검증:
   - Layer 0: 도메인 가드레일 (38규칙)
   - Layer 0.5: 수치 교차검증
   - Layer 1: NLI 의미적 검증 (DeBERTa)
   - Layer 2: LLM 재검증 (neutral만, 선택)
4. 교정문 생성 (contradicted만)
5. 5차원 스코어링 → 최종 결과
"""

import asyncio
import structlog
from dataclasses import dataclass, field

from halluguard.config import get_settings
from halluguard.utils.chunker import chunk_text
from halluguard.engine.claim_extractor import extract_claims
from halluguard.engine.evidence_matcher import match_evidence
from halluguard.engine.nli_verifier import verify_claim
from halluguard.engine.numerical_verifier import cross_verify_numerics
from halluguard.engine.domain_adapters import get_domain_adapter
from halluguard.engine.multi_scorer import compute_multi_scores

logger = structlog.get_logger()


@dataclass
class ClaimResult:
    claim_text: str
    verdict: str  # "supported" | "contradicted" | "neutral"
    confidence: float
    evidence_text: str = ""
    suggested_correction: str | None = None
    claim_order: int = 0


@dataclass
class VerificationResult:
    overall_score: float
    total_claims: int
    supported_claims: int
    contradicted_claims: int
    neutral_claims: int
    claims: list[ClaimResult] = field(default_factory=list)
    multi_scores: dict = field(default_factory=dict)
    corrected_text: str = ""

    def to_dict(self) -> dict:
        return {
            "overall_score": self.overall_score,
            "total_claims": self.total_claims,
            "supported_claims": self.supported_claims,
            "contradicted_claims": self.contradicted_claims,
            "neutral_claims": self.neutral_claims,
            "claims": [
                {
                    "claim_text": c.claim_text,
                    "verdict": c.verdict,
                    "confidence": c.confidence,
                    "evidence_text": c.evidence_text,
                    "suggested_correction": c.suggested_correction,
                    "claim_order": c.claim_order,
                }
                for c in self.claims
            ],
            "multi_scores": self.multi_scores,
            "corrected_text": self.corrected_text,
        }


async def verify(
    source_text: str,
    llm_output: str,
    domain: str = "general",
) -> VerificationResult:
    """전체 검증 파이프라인 실행 (비동기).

    Args:
        source_text: 원본 문서 텍스트 (Ground Truth)
        llm_output: LLM이 생성한 텍스트 (검증 대상)
        domain: 도메인 ID ("general", "finance", "defense", "government", "education")

    Returns:
        VerificationResult 객체
    """
    settings = get_settings()

    # 1. 원본 문서 in-memory 청킹
    all_chunks = chunk_text(source_text)
    if not all_chunks:
        return VerificationResult(
            overall_score=1.0, total_claims=0,
            supported_claims=0, contradicted_claims=0, neutral_claims=0,
        )

    # 2. 클레임 추출
    claims = extract_claims(llm_output)
    if not claims:
        return VerificationResult(
            overall_score=1.0, total_claims=0,
            supported_claims=0, contradicted_claims=0, neutral_claims=0,
        )

    # 3. 도메인 어댑터 로드
    domain_adapter = get_domain_adapter(domain)

    # 4. 각 클레임 검증
    supported = 0
    contradicted = 0
    neutral = 0
    claim_results: list[ClaimResult] = []

    for i, claim_text in enumerate(claims):
        # 근거 매칭 (in-memory)
        matched = match_evidence(claim_text, all_chunks, top_k=3)
        evidence_texts = [m["text"] for m in matched]

        # --- Layer 0: 도메인 가드레일 ---
        guardrail_hit = domain_adapter.check_guardrails(claim_text)
        guardrail_overridden = False

        if guardrail_hit and guardrail_hit["severity"] in ("CRITICAL", "HIGH"):
            needs_cross_check = guardrail_hit.get("needs_nli_cross_check", False)

            if needs_cross_check and evidence_texts:
                cross_result = verify_claim(claim_text, evidence_texts)
                if cross_result["verdict"] == "supported" and cross_result["confidence"] > 0.7:
                    guardrail_overridden = False
                else:
                    guardrail_overridden = True
            else:
                guardrail_overridden = True

        if guardrail_overridden:
            verdict = "contradicted"
            confidence = guardrail_hit.get("confidence", 0.95)
            best_evidence = (
                f"[가드레일 {guardrail_hit['rule_id']}] "
                f"{guardrail_hit['rule_name']}: {guardrail_hit['description']}"
            )
        else:
            # --- Layer 0.5: 수치 교차검증 ---
            num_mismatch = cross_verify_numerics(claim_text, evidence_texts)
            if num_mismatch and num_mismatch.get("mismatched"):
                verdict = "contradicted"
                confidence = 0.92
                best_evidence = f"[수치 교차검증] {num_mismatch['description']}"
            else:
                # --- Layer 1: NLI 검증 ---
                result_nli = verify_claim(claim_text, evidence_texts)
                verdict = result_nli["verdict"]
                confidence = result_nli["confidence"]
                best_evidence = result_nli["best_evidence"]

                # --- Layer 2: LLM 재검증 (neutral + LLM 활성화 시) ---
                if (
                    verdict == "neutral"
                    and evidence_texts
                    and settings.LLM_VERIFY_ENABLED
                    and settings.DEFAULT_LLM_MODEL
                ):
                    try:
                        from halluguard.engine.llm_verifier import llm_verify_claim
                        domain_context = domain_adapter.get_verification_context()
                        result_llm = await llm_verify_claim(
                            claim_text, evidence_texts, domain_context=domain_context,
                        )
                        if result_llm["verdict"] != "neutral":
                            verdict = result_llm["verdict"]
                            confidence = result_llm["confidence"]
                            best_evidence = result_llm["best_evidence"]
                    except Exception as e:
                        logger.warning("LLM re-verification failed", error=str(e))

        # --- 교정문 생성 (contradicted + LLM 활성화 시) ---
        correction = None
        if (
            verdict == "contradicted"
            and best_evidence
            and settings.LLM_VERIFY_ENABLED
            and settings.DEFAULT_LLM_MODEL
        ):
            try:
                from halluguard.engine.correction_generator import generate_correction
                correction = await generate_correction(claim_text, best_evidence)
            except Exception as e:
                logger.warning("Correction generation failed", error=str(e))

        # 카운트
        if verdict == "supported":
            supported += 1
        elif verdict == "contradicted":
            contradicted += 1
        else:
            neutral += 1

        claim_results.append(ClaimResult(
            claim_text=claim_text,
            verdict=verdict,
            confidence=confidence,
            evidence_text=best_evidence,
            suggested_correction=correction,
            claim_order=i,
        ))

    # 5. 종합 점수 계산
    total = len(claims)
    overall_score = supported / total if total > 0 else 0.0

    # 6. 5차원 스코어링
    scorer_claims = [
        {"claim_text": c.claim_text, "verdict": c.verdict, "confidence": c.confidence}
        for c in claim_results
    ]
    multi_scores = compute_multi_scores(scorer_claims)

    # 7. 교정된 전체 텍스트 조합
    corrected_parts = []
    for c in claim_results:
        if c.verdict == "contradicted" and c.suggested_correction:
            corrected_parts.append(c.suggested_correction)
        else:
            corrected_parts.append(c.claim_text)
    corrected_text = " ".join(corrected_parts)

    result = VerificationResult(
        overall_score=round(overall_score, 4),
        total_claims=total,
        supported_claims=supported,
        contradicted_claims=contradicted,
        neutral_claims=neutral,
        claims=claim_results,
        multi_scores=multi_scores,
        corrected_text=corrected_text,
    )

    logger.info(
        "Verification completed",
        total=total, supported=supported,
        contradicted=contradicted, neutral=neutral,
        overall=result.overall_score,
    )

    return result


def verify_sync(
    source_text: str,
    llm_output: str,
    domain: str = "general",
) -> VerificationResult:
    """동기 래퍼 — asyncio 이벤트 루프 없이 사용 가능."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, verify(source_text, llm_output, domain))
            return future.result()
    else:
        return asyncio.run(verify(source_text, llm_output, domain))
