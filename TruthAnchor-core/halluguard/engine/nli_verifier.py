"""NLI(Natural Language Inference) 기반 클레임 검증"""

import math
import structlog
from typing import Literal

logger = structlog.get_logger()

Verdict = Literal["supported", "contradicted", "neutral"]

# NLI 모델은 lazy load
_nli_pipeline = None


def _get_nli_pipeline():
    global _nli_pipeline
    if _nli_pipeline is None:
        try:
            from sentence_transformers import CrossEncoder
            _nli_pipeline = CrossEncoder("cross-encoder/nli-deberta-v3-base")
            logger.info("NLI model loaded", model="cross-encoder/nli-deberta-v3-base")
        except Exception as e:
            logger.warning("NLI model load failed, using fallback", error=str(e))
            _nli_pipeline = "fallback"
    return _nli_pipeline


def _softmax(scores: list[float]) -> list[float]:
    """raw logits을 확률 분포로 정규화"""
    max_s = max(scores)
    exps = [math.exp(s - max_s) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def verify_claim(
    claim: str,
    evidence_texts: list[str],
    contradiction_threshold: float = 0.65,
    entailment_threshold: float = 0.55,
) -> dict:
    """클레임을 근거 텍스트들과 대조하여 판정.

    개선사항:
    - softmax 정규화로 raw logits를 확률로 변환
    - 임계값 균형 조정 (contradiction 0.7→0.65, entailment 0.6→0.55)
    - 다중 근거의 앙상블 점수 산출

    Returns:
        {
            "verdict": "supported" | "contradicted" | "neutral",
            "confidence": float,
            "best_evidence": str,
        }
    """
    if not evidence_texts:
        return {"verdict": "neutral", "confidence": 0.5, "best_evidence": ""}

    pipeline = _get_nli_pipeline()

    if pipeline == "fallback":
        return _fallback_verify(claim, evidence_texts)

    best_verdict: Verdict = "neutral"
    best_confidence = 0.0
    best_evidence = ""

    # 앙상블용: 모든 근거의 점수 수집
    all_entailment_scores = []
    all_contradiction_scores = []

    for evidence in evidence_texts:
        if not evidence.strip():
            continue
        try:
            # CrossEncoder: [contradiction, entailment, neutral]
            scores = pipeline.predict([(claim, evidence)])
            if hasattr(scores, "tolist"):
                scores = scores.tolist()
            if isinstance(scores[0], list):
                score_list = scores[0]
            else:
                score_list = scores

            # softmax 정규화: raw logits → 확률
            probs = _softmax(score_list)
            contradiction_prob = probs[0]
            entailment_prob = probs[1]

            all_entailment_scores.append(entailment_prob)
            all_contradiction_scores.append(contradiction_prob)

            if entailment_prob > entailment_threshold and entailment_prob > best_confidence:
                best_verdict = "supported"
                best_confidence = entailment_prob
                best_evidence = evidence
            elif contradiction_prob > contradiction_threshold and contradiction_prob > best_confidence:
                best_verdict = "contradicted"
                best_confidence = contradiction_prob
                best_evidence = evidence

        except Exception as e:
            logger.warning("NLI prediction error", error=str(e), claim=claim[:50])
            continue

    # 앙상블 보정: 개별 근거에서 판정 못했지만, 다수 근거가 같은 방향이면 판정
    if best_verdict == "neutral" and all_entailment_scores:
        avg_entailment = sum(all_entailment_scores) / len(all_entailment_scores)
        avg_contradiction = sum(all_contradiction_scores) / len(all_contradiction_scores)

        # 평균 점수가 약한 임계값을 넘으면 앙상블 판정
        if avg_entailment > (entailment_threshold - 0.1) and avg_entailment > avg_contradiction:
            best_verdict = "supported"
            best_confidence = avg_entailment
            best_evidence = evidence_texts[0]
        elif avg_contradiction > (contradiction_threshold - 0.1) and avg_contradiction > avg_entailment:
            best_verdict = "contradicted"
            best_confidence = avg_contradiction
            best_evidence = evidence_texts[0]

    if best_confidence == 0.0:
        best_evidence = evidence_texts[0] if evidence_texts else ""
        best_confidence = 0.5

    return {
        "verdict": best_verdict,
        "confidence": round(best_confidence, 4),
        "best_evidence": best_evidence,
    }


def _fallback_verify(claim: str, evidence_texts: list[str]) -> dict:
    """NLI 모델 없이 키워드 + 시퀀스 기반 강화 폴백 검증"""
    from difflib import SequenceMatcher

    best_combined = 0.0
    best_evidence = evidence_texts[0] if evidence_texts else ""

    claim_lower = claim.lower()
    claim_words = set(claim_lower.split())
    # 불용어 제거
    stopwords = {"의", "에", "를", "이", "가", "은", "는", "에서", "으로", "로",
                 "a", "the", "is", "are", "in", "of", "to", "and", "for"}
    claim_meaningful = claim_words - stopwords

    for ev in evidence_texts:
        ev_lower = ev.lower()
        # 시퀀스 유사도
        seq_score = SequenceMatcher(None, claim_lower, ev_lower).ratio()

        # 키워드 오버랩 (의미 있는 단어만)
        ev_words = set(ev_lower.split())
        ev_meaningful = ev_words - stopwords
        if claim_meaningful:
            keyword_score = len(claim_meaningful & ev_meaningful) / len(claim_meaningful)
        else:
            keyword_score = 0.0

        # 가중 결합
        combined = 0.5 * keyword_score + 0.5 * seq_score

        if combined > best_combined:
            best_combined = combined
            best_evidence = ev

    if best_combined > 0.6:
        return {"verdict": "supported", "confidence": round(best_combined, 4), "best_evidence": best_evidence}
    elif best_combined < 0.2:
        return {"verdict": "contradicted", "confidence": round(1.0 - best_combined, 4), "best_evidence": best_evidence}
    else:
        return {"verdict": "neutral", "confidence": 0.5, "best_evidence": best_evidence}
