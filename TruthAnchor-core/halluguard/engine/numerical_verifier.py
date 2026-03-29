"""수치 교차검증 엔진 — 클레임과 근거 텍스트의 수치를 직접 비교

수치 포함 클레임에 대해:
1. 클레임에서 수치(숫자, 퍼센트, 금액, 날짜 등)를 추출
2. 근거 텍스트에서 동일 문맥의 수치를 추출
3. 두 수치를 직접 비교하여 불일치 판정
"""

import re
import structlog
from dataclasses import dataclass

logger = structlog.get_logger()


@dataclass
class NumericFact:
    value: float
    unit: str
    context: str  # 수치가 등장한 문맥 키워드
    raw: str       # 원본 텍스트


# 수치 추출 패턴
_NUMERIC_PATTERNS = [
    # 퍼센트: 3.5%, 연 3.5%
    (r"(?:연\s*)?(\d+(?:\.\d+)?)\s*(%|퍼센트)", "percent"),
    # 금액 (조): 1.7조, 약 1.7조
    (r"약?\s*(\d+(?:\.\d+)?)\s*(조)\s*(원|달러|위안)?", "trillion"),
    # 금액 (억): 500억
    (r"약?\s*(\d[\d,.]*)\s*(억)\s*(원|달러|위안)?", "billion"),
    # 금액 (만): 5000만, 5,000만
    (r"약?\s*(\d[\d,.]*)\s*(만)\s*(원|달러|명|건|개)?", "ten_thousand"),
    # 일반 숫자 + 단위: 950만 명, 1024차원
    (r"(\d[\d,.]*)\s*(명|건|개|회|년|월|일|세|개월|차원|kg|km|m|MB|GB|TB)", "count"),
    # 연도: 2023년, 2024년
    (r"(\d{4})\s*년", "year"),
    # 날짜: 2024년 3월
    (r"(\d{4})\s*년\s*(\d{1,2})\s*월", "date"),
    # 소수점 숫자 단독
    (r"(\d+\.\d+)", "decimal"),
]

# 문맥 키워드 추출용 — 카테고리별 그룹핑으로 혼동 방지
_CONTEXT_KEYWORDS = re.compile(
    r"(GDP|금리|이율|기준금리|인구|매출|수익|가격|비용|면적|거리|속도|무게|"
    r"한도|세율|보험료|연금|대출|예산|수수료|연회비|보장|"
    r"성장률|실업률|물가|환율|시가총액|자본금|부채|자산|"
    r"이자율|수익률|연이율|배당률|배당금|순이익|영업이익|"
    r"출생률|사망률|취업률|합격률|점유율)"
)

# 문맥 키워드 카테고리 — 같은 카테고리 내에서만 비교 허용
_CONTEXT_CATEGORIES = {
    "금리": {"금리", "이율", "기준금리", "이자율", "연이율"},
    "수익": {"수익", "수익률", "배당률", "배당금", "순이익", "영업이익", "매출"},
    "인구": {"인구", "출생률", "사망률"},
    "고용": {"실업률", "취업률", "합격률"},
    "가격": {"가격", "비용", "수수료", "연회비", "보험료"},
    "GDP": {"GDP", "성장률", "물가"},
    "자산": {"자산", "부채", "자본금", "시가총액"},
    "환율": {"환율"},
    "예산": {"예산", "세율"},
    "기타": {"한도", "면적", "거리", "속도", "무게", "보장", "연금", "대출", "점유율"},
}


def _contexts_compatible(ctx1: str, ctx2: str) -> bool:
    """두 문맥 키워드가 같은 카테고리인지 확인하여 오매칭 방지"""
    if not ctx1 or not ctx2:
        return True  # 문맥이 없으면 호환 가능으로 처리
    if ctx1 == ctx2:
        return True
    for category_words in _CONTEXT_CATEGORIES.values():
        if ctx1 in category_words and ctx2 in category_words:
            return True
    return False


def extract_numerics(text: str) -> list[NumericFact]:
    """텍스트에서 수치 사실을 추출"""
    facts = []
    seen_positions = set()

    for pattern, unit_type in _NUMERIC_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            start = match.start()
            # 같은 위치의 중복 매칭 방지
            if any(abs(start - pos) < 3 for pos in seen_positions):
                continue
            seen_positions.add(start)

            raw = match.group(0)
            val_str = match.group(1).replace(",", "")

            try:
                value = float(val_str)
            except ValueError:
                continue

            # 단위 정규화
            unit = _normalize_unit(match, unit_type)

            # 문맥 키워드 추출 (수치 앞뒤 60자 — 확장된 윈도우)
            ctx_start = max(0, start - 60)
            ctx_end = min(len(text), match.end() + 60)
            context_window = text[ctx_start:ctx_end]
            # 다중 키워드 매칭: 가장 가까운 키워드 우선
            context_matches = list(_CONTEXT_KEYWORDS.finditer(context_window))
            if context_matches:
                # 수치 위치에 가장 가까운 키워드 선택
                num_pos_in_window = start - ctx_start
                context_matches.sort(key=lambda m: abs(m.start() - num_pos_in_window))
                context = context_matches[0].group(1)
            else:
                context = ""

            facts.append(NumericFact(
                value=value, unit=unit, context=context, raw=raw,
            ))

    return facts


def _normalize_unit(match: re.Match, unit_type: str) -> str:
    """매치 결과에서 단위를 정규화"""
    if unit_type == "percent":
        return "%"
    elif unit_type == "trillion":
        currency = match.group(3) or "원"
        return f"조{currency}"
    elif unit_type == "billion":
        currency = match.group(3) or "원"
        return f"억{currency}"
    elif unit_type == "ten_thousand":
        suffix = match.group(3) or "원"
        return f"만{suffix}"
    elif unit_type == "count":
        return match.group(2)
    elif unit_type == "year":
        return "년"
    elif unit_type == "date":
        return "년월"
    elif unit_type == "decimal":
        return "number"
    return unit_type


def cross_verify_numerics(
    claim: str,
    evidence_texts: list[str],
    tolerance: float = 0.05,
) -> dict | None:
    """클레임의 수치를 근거 텍스트의 수치와 교차 검증.

    Args:
        claim: 검증할 클레임 텍스트
        evidence_texts: 원본 문서 근거 텍스트 리스트
        tolerance: 허용 오차 비율 (기본 5%)

    Returns:
        불일치 발견 시:
        {
            "mismatched": True,
            "claim_numeric": NumericFact,
            "evidence_numeric": NumericFact,
            "description": str,
        }
        불일치 없거나 비교 불가 시: None
    """
    claim_facts = extract_numerics(claim)
    if not claim_facts:
        return None

    # 모든 근거 텍스트에서 수치 추출
    evidence_facts = []
    for ev in evidence_texts:
        evidence_facts.extend(extract_numerics(ev))

    if not evidence_facts:
        return None

    # 각 클레임 수치에 대해 근거에서 대응 수치를 찾아 비교
    mismatches = []
    for cf in claim_facts:
        best_match = _find_matching_evidence_fact(cf, evidence_facts)
        if best_match is None:
            continue

        # 수치 비교
        if not _values_match(cf.value, best_match.value, cf.unit, tolerance):
            description = (
                f"수치 불일치: 클레임 '{cf.raw}' vs 근거 '{best_match.raw}' "
                f"(문맥: {cf.context or '일반'})"
            )
            logger.info(
                "Numerical mismatch detected",
                claim_value=cf.value,
                evidence_value=best_match.value,
                context=cf.context,
            )
            mismatches.append({
                "mismatched": True,
                "claim_value": cf.value,
                "claim_raw": cf.raw,
                "evidence_value": best_match.value,
                "evidence_raw": best_match.raw,
                "context": cf.context,
                "description": description,
            })

    if not mismatches:
        return None

    # 첫 번째 불일치 반환 (하위 호환), 전체 불일치 목록도 포함
    result = mismatches[0]
    if len(mismatches) > 1:
        all_descriptions = "; ".join(m["description"] for m in mismatches)
        result["description"] = all_descriptions
        result["all_mismatches"] = mismatches
    return result


def _find_matching_evidence_fact(
    claim_fact: NumericFact,
    evidence_facts: list[NumericFact],
) -> NumericFact | None:
    """클레임 수치와 문맥이 가장 유사한 근거 수치를 찾음.

    개선: 문맥 카테고리 호환성 검사로 다른 도메인 수치 오매칭 방지.
    """
    candidates = []

    for ef in evidence_facts:
        score = 0

        # 문맥 카테고리 호환성 확인 — 비호환이면 건너뜀
        if claim_fact.context and ef.context:
            if not _contexts_compatible(claim_fact.context, ef.context):
                continue

        # 동일 단위 우선
        if ef.unit == claim_fact.unit:
            score += 3

        # 동일 문맥 키워드 우선
        if claim_fact.context and ef.context and claim_fact.context == ef.context:
            score += 5

        # 단위 호환 (예: 만명 vs 명 — 같은 카테고리)
        if _units_compatible(claim_fact.unit, ef.unit):
            score += 2

        # 문맥은 다르지만 같은 카테고리
        if claim_fact.context and ef.context and claim_fact.context != ef.context:
            if _contexts_compatible(claim_fact.context, ef.context):
                score += 3

        if score >= 2:
            candidates.append((score, ef))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def _units_compatible(unit1: str, unit2: str) -> bool:
    """두 단위가 같은 카테고리인지"""
    currency_units = {"%", "조원", "억원", "만원", "조달러", "억달러", "만달러", "천만원", "백만원"}
    count_units = {"명", "건", "개", "회", "만명", "만건", "만개"}
    time_units = {"년", "월", "일", "개월", "세", "년월"}
    rate_units = {"%"}

    for group in [currency_units, count_units, time_units, rate_units]:
        if unit1 in group and unit2 in group:
            return True

    # 단위 정규화 후 비교 (조원 ↔ 억원)
    _, norm1 = _normalize_to_base_unit(1, unit1)
    _, norm2 = _normalize_to_base_unit(1, unit2)
    if norm1 == norm2:
        return True

    return unit1 == unit2


def _normalize_to_base_unit(value: float, unit: str) -> tuple[float, str]:
    """단위를 기본 단위로 변환하여 비교 가능하게 함.

    예: 1.5조원 → 15000억원, 500만원 → 0.05억원
    """
    # 조 → 억 변환
    if "조" in unit:
        return value * 10000, unit.replace("조", "억")
    # 만 → 억은 변환하지 않음 (스케일 차이가 너무 크면 다른 수치일 가능성)
    return value, unit


def _values_match(claim_val: float, evidence_val: float, unit: str, tolerance: float) -> bool:
    """두 수치가 허용 오차 내에서 일치하는지"""
    if evidence_val == 0:
        return claim_val == 0

    # 퍼센트는 절대값 차이 (0.5%p 허용)
    if unit == "%":
        return abs(claim_val - evidence_val) <= 0.5

    # 연도/날짜는 정확 일치
    if unit in ("년", "년월"):
        return claim_val == evidence_val

    # 그 외는 상대적 오차
    relative_error = abs(claim_val - evidence_val) / abs(evidence_val)
    return relative_error <= tolerance
