"""클레임과 원본 문서 청크 간 근거 매칭 (in-memory 문자열 유사도 기반)

halluguard-core 독립 패키지용: Qdrant 의존성 없이 동작.
"""

import structlog
from difflib import SequenceMatcher

logger = structlog.get_logger()

# 최소 관련성 임계값 — 이 점수 미만의 근거는 버림
MIN_RELEVANCE_THRESHOLD = 0.25

# 한국어 + 영어 불용어
_STOPWORDS = frozenset({
    "의", "에", "를", "이", "가", "은", "는", "에서", "으로", "로", "와", "과",
    "도", "만", "을", "한", "된", "할", "하는", "그", "이런", "저런", "것",
    "수", "등", "및", "또는", "그리고", "하지만", "때문", "대한", "위한",
    "a", "an", "the", "is", "are", "was", "were", "in", "of", "to", "and",
    "for", "on", "at", "by", "with", "from", "that", "this", "it", "be",
})


def _compute_dynamic_top_k(total_chunks: int, base_top_k: int = 3) -> int:
    """문서 규모에 따라 top_k를 동적 조정 (3~7)"""
    if total_chunks <= 20:
        return base_top_k
    elif total_chunks <= 50:
        return min(base_top_k + 1, 5)
    elif total_chunks <= 100:
        return min(base_top_k + 2, 6)
    else:
        return min(base_top_k + 3, 7)


def match_evidence(
    claim: str,
    chunks: list[dict],
    top_k: int = 3,
) -> list[dict]:
    """클레임에 가장 관련성 높은 문서 청크를 반환.

    in-memory 문자열 유사도 매칭 (키워드 + n-gram + 시퀀스).
    동적 top_k와 최소 관련성 임계값을 적용하여 품질 보장.
    """
    effective_top_k = _compute_dynamic_top_k(len(chunks), top_k)
    return _string_similarity_match(claim, chunks, effective_top_k)


def _string_similarity_match(
    claim: str,
    chunks: list[dict],
    top_k: int = 3,
) -> list[dict]:
    """문자열 유사도 기반 fallback 매칭 (키워드 + 시퀀스 + n-gram)."""
    scored = []
    claim_lower = claim.lower()

    for chunk in chunks:
        chunk_text = chunk["text"]
        chunk_lower = chunk_text.lower()

        keyword_score = _keyword_overlap(claim_lower, chunk_lower)
        seq_score = SequenceMatcher(None, claim_lower, chunk_lower).ratio()
        ngram_score = _ngram_overlap(claim_lower, chunk_lower, n=2)

        # 가중 합산: 키워드 50% + n-gram 30% + 시퀀스 20%
        score = 0.5 * keyword_score + 0.3 * ngram_score + 0.2 * seq_score
        scored.append({**chunk, "relevance_score": round(score, 4)})

    scored.sort(key=lambda x: x["relevance_score"], reverse=True)

    # 최소 관련성 필터링
    filtered = [s for s in scored[:top_k] if s["relevance_score"] >= MIN_RELEVANCE_THRESHOLD]
    if not filtered and scored:
        return scored[:1]  # 최소 1개는 반환
    return filtered


def _keyword_overlap(claim: str, chunk: str) -> float:
    """단어 수준 오버랩 비율 (불용어 확장)"""
    claim_words = set(claim.split())
    chunk_words = set(chunk.split())
    if not claim_words:
        return 0.0

    meaningful_overlap = (claim_words & chunk_words) - _STOPWORDS
    meaningful_claim = claim_words - _STOPWORDS
    if not meaningful_claim:
        return 0.0
    return len(meaningful_overlap) / len(meaningful_claim)


def _ngram_overlap(text1: str, text2: str, n: int = 2) -> float:
    """character-level n-gram 오버랩 (패러프레이징에 강건)"""
    if len(text1) < n or len(text2) < n:
        return 0.0

    ngrams1 = set(text1[i:i+n] for i in range(len(text1) - n + 1))
    ngrams2 = set(text2[i:i+n] for i in range(len(text2) - n + 1))

    if not ngrams1:
        return 0.0
    overlap = ngrams1 & ngrams2
    return len(overlap) / len(ngrams1)
