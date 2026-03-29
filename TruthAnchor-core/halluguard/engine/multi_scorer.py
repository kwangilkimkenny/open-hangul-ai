"""5차원 검증 스코어링 엔진

차원:
1. factual_accuracy  — 사실 정확도: 클레임이 원본과 일치하는 비율
2. numerical_accuracy — 수치 정확도: 숫자/날짜/통계 포함 클레임의 정확 비율
3. evidence_reliability — 근거 신뢰도: 매칭된 근거의 평균 관련성
4. consistency — 일관성: 클레임 간 상호 모순이 없는 정도
5. uncertainty_calibration — 불확실성 보정: 판정 완결도 (neutral 세분화)
"""

import re
import structlog
from difflib import SequenceMatcher

logger = structlog.get_logger()

# 수치 패턴 (숫자, 날짜, 퍼센트, 금액 등)
NUMERICAL_PATTERN = re.compile(
    r'\d[\d,.]*\s*(%|억|만|천|조|달러|원|명|건|개|회|년|월|일|kg|km|m|MB|GB|TB)|'
    r'\d{4}[-/년]\s*\d{1,2}[-/월]|'
    r'약\s*\d|'
    r'\d+\.\d+',
    re.IGNORECASE
)

# 불용어
_STOPWORDS = frozenset({
    "은", "는", "이", "가", "을", "를", "의", "에", "에서", "로", "으로",
    "와", "과", "도", "만", "한", "된", "할", "하는", "그", "것", "수",
    "등", "및", "또는", "a", "the", "is", "in", "of", "to", "and", "for",
})


def compute_multi_scores(claims: list[dict], evidence_scores: list[float] | None = None) -> dict:
    """검증된 클레임 목록에서 5차원 점수를 산출.

    개선사항:
    - 의미 유사도 기반 일관성 검사 (n-gram + 키워드 결합)
    - neutral 세분화 (근거 부족 vs 판단 불가)
    - 스코어 산출 근거 상세 로깅

    Args:
        claims: [{"claim_text": str, "verdict": str, "confidence": float, ...}, ...]
        evidence_scores: 각 클레임의 근거 매칭 relevance score 리스트 (없으면 confidence 사용)

    Returns:
        {
            "factual_accuracy": float,      # 0.0 ~ 1.0
            "numerical_accuracy": float,    # 0.0 ~ 1.0
            "evidence_reliability": float,  # 0.0 ~ 1.0
            "consistency": float,           # 0.0 ~ 1.0
            "uncertainty_calibration": float # 0.0 ~ 1.0
            "overall": float,               # 가중 평균
            "details": dict                 # 산출 근거
        }
    """
    if not claims:
        return _empty_scores()

    total = len(claims)
    supported = sum(1 for c in claims if c.get("verdict") == "supported")
    contradicted = sum(1 for c in claims if c.get("verdict") == "contradicted")
    neutral = sum(1 for c in claims if c.get("verdict") == "neutral")

    # ── 1. 사실 정확도 (Factual Accuracy) ──
    # supported 비율 (contradicted는 감점, neutral은 부분 감점)
    factual = supported / total if total > 0 else 0.0

    # ── 2. 수치 정확도 (Numerical Accuracy) ──
    numerical_claims = [c for c in claims if _has_numerical(c.get("claim_text", ""))]
    if numerical_claims:
        num_supported = sum(1 for c in numerical_claims if c.get("verdict") == "supported")
        numerical = num_supported / len(numerical_claims)
    else:
        numerical = 1.0  # 수치 클레임이 없으면 만점

    # ── 3. 근거 신뢰도 (Evidence Reliability) ──
    if evidence_scores and len(evidence_scores) == total:
        evidence_rel = sum(evidence_scores) / total
    else:
        meaningful = [
            (c.get("confidence", 0.5), c.get("verdict", "neutral"))
            for c in claims
        ]
        weighted = []
        for conf, verdict in meaningful:
            if verdict in ("supported", "contradicted"):
                weighted.append(min(conf, 1.0))
            else:
                # neutral 세분화: confidence 기반으로 "근거 부족" vs "판단 불가" 구분
                # confidence가 낮을수록 근거 부족 (더 큰 페널티)
                neutral_weight = 0.2 + (min(conf, 1.0) * 0.3)  # 0.2~0.5 범위
                weighted.append(neutral_weight)
        evidence_rel = sum(weighted) / len(weighted) if weighted else 0.5

    # ── 4. 일관성 (Consistency) ──
    consistency = _compute_consistency(claims)

    # ── 5. 불확실성 보정 (Uncertainty Calibration) ──
    # neutral 세분화: 근거가 있는 neutral과 근거 없는 neutral을 구분
    neutral_claims = [c for c in claims if c.get("verdict") == "neutral"]
    if neutral_claims:
        # 근거 있는 neutral: confidence가 0.5 초과 → 어느 정도 검증 시도됨
        informed_neutrals = sum(1 for c in neutral_claims if c.get("confidence", 0.5) > 0.5)
        uninformed_neutrals = len(neutral_claims) - informed_neutrals

        determined = supported + contradicted
        # informed neutral은 절반 크레딧, uninformed는 0
        effective_determined = determined + (informed_neutrals * 0.5)
        calibration = effective_determined / total if total > 0 else 0.0
        calibration = min(calibration, 1.0)
    else:
        calibration = 1.0  # neutral이 없으면 완벽한 판정 완결도

    # ── 종합 점수 (가중 평균) ──
    weights = {
        "factual_accuracy": 0.35,
        "numerical_accuracy": 0.15,
        "evidence_reliability": 0.20,
        "consistency": 0.15,
        "uncertainty_calibration": 0.15,
    }
    overall = (
        factual * weights["factual_accuracy"]
        + numerical * weights["numerical_accuracy"]
        + evidence_rel * weights["evidence_reliability"]
        + consistency * weights["consistency"]
        + calibration * weights["uncertainty_calibration"]
    )

    result = {
        "factual_accuracy": round(factual, 4),
        "numerical_accuracy": round(numerical, 4),
        "evidence_reliability": round(min(evidence_rel, 1.0), 4),
        "consistency": round(consistency, 4),
        "uncertainty_calibration": round(calibration, 4),
        "overall": round(overall, 4),
        "details": {
            "total_claims": total,
            "supported": supported,
            "contradicted": contradicted,
            "neutral": neutral,
            "neutral_informed": sum(1 for c in claims if c.get("verdict") == "neutral" and c.get("confidence", 0.5) > 0.5),
            "neutral_uninformed": sum(1 for c in claims if c.get("verdict") == "neutral" and c.get("confidence", 0.5) <= 0.5),
            "numerical_claims": len(numerical_claims),
            "weights": weights,
        },
    }

    logger.info(
        "Multi-score computed",
        overall=result["overall"],
        factual=result["factual_accuracy"],
        numerical=result["numerical_accuracy"],
        evidence_rel=result["evidence_reliability"],
        consistency=result["consistency"],
        calibration=result["uncertainty_calibration"],
    )
    return result


def _has_numerical(text: str) -> bool:
    """텍스트에 수치/날짜/통계가 포함되어 있는지 확인"""
    return bool(NUMERICAL_PATTERN.search(text))


def _extract_meaningful_words(text: str) -> set[str]:
    """텍스트에서 불용어를 제거한 의미 있는 단어 집합 추출"""
    return set(text.lower().split()) - _STOPWORDS


def _semantic_similarity(text1: str, text2: str) -> float:
    """키워드 오버랩 + character n-gram 결합 유사도"""
    words1 = _extract_meaningful_words(text1)
    words2 = _extract_meaningful_words(text2)

    # 키워드 오버랩 (Jaccard)
    if words1 and words2:
        jaccard = len(words1 & words2) / len(words1 | words2)
    else:
        jaccard = 0.0

    # character 2-gram 유사도 (패러프레이징에 강건)
    t1, t2 = text1.lower(), text2.lower()
    if len(t1) >= 2 and len(t2) >= 2:
        ngrams1 = set(t1[i:i+2] for i in range(len(t1) - 1))
        ngrams2 = set(t2[i:i+2] for i in range(len(t2) - 1))
        ngram_sim = len(ngrams1 & ngrams2) / len(ngrams1 | ngrams2) if (ngrams1 | ngrams2) else 0.0
    else:
        ngram_sim = 0.0

    # 가중 결합
    return 0.6 * jaccard + 0.4 * ngram_sim


def _compute_consistency(claims: list[dict]) -> float:
    """클레임 간 일관성 검사.

    개선: 의미 유사도 기반 주제 매칭 (키워드 + n-gram 결합)
    같은 주제에 대해 모순되는 판정이 있으면 감점.
    """
    if len(claims) <= 1:
        return 1.0

    supported_claims = [(c["claim_text"], c) for c in claims if c.get("verdict") == "supported"]
    contradicted_claims = [(c["claim_text"], c) for c in claims if c.get("verdict") == "contradicted"]

    if not contradicted_claims:
        return 1.0

    # 의미 유사도 기반 충돌 감지
    conflicts = 0
    conflict_details = []

    for ct_text, ct_claim in contradicted_claims:
        for st_text, st_claim in supported_claims:
            similarity = _semantic_similarity(ct_text, st_text)
            # 유사도 0.3 이상이면 같은 주제로 판별 (기존 키워드 3개보다 유연)
            if similarity >= 0.3:
                conflicts += 1
                conflict_details.append({
                    "contradicted": ct_text[:50],
                    "supported": st_text[:50],
                    "similarity": round(similarity, 3),
                })
                break

    if conflict_details:
        logger.info("Consistency conflicts detected", conflicts=len(conflict_details), details=conflict_details[:3])

    total_pairs = len(contradicted_claims)
    conflict_ratio = conflicts / total_pairs if total_pairs > 0 else 0
    return round(1.0 - conflict_ratio * 0.5, 4)


def _empty_scores() -> dict:
    return {
        "factual_accuracy": 0.0,
        "numerical_accuracy": 0.0,
        "evidence_reliability": 0.0,
        "consistency": 1.0,
        "uncertainty_calibration": 0.0,
        "overall": 0.0,
        "details": {"total_claims": 0},
    }
