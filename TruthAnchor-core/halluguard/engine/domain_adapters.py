"""도메인 특화 검증 어댑터 — 38개 가드레일 규칙 (CG-001~028 + 코드 내장 CG-011~017, CG-026~028)

계층 구조:
- YAML 규칙 (CG-001~010, CG-018~025): 정규표현식 패턴 매칭
- 코드 내장 규칙 (CG-011~017, CG-026~028): 구조적/논리적 분석

각 도메인은 고유한:
1. 가드레일 규칙 (위험 패턴 탐지)
2. 전문 용어 사전 (수치/법규 검증 강화)
3. LLM 검증 프롬프트 커스터마이징
4. 도메인 특화 온톨로지 엔티티 타입

을 제공하여 할루시네이션 탐지 정확도를 높입니다.
"""

import re
import structlog

logger = structlog.get_logger()

# ─── 도메인 레지스트리 ──────────────────────────────────

DOMAIN_REGISTRY: dict[str, "DomainAdapter"] = {}


# ─── 공통 가드레일 규칙 (CG-001~010) ────────────────────

COMMON_GUARDRAIL_PATTERNS = [
    {
        "id": "CG-001", "name": "투자 권유 금지", "severity": "CRITICAL",
        "pattern": r"(투자|매수|매도).{0,10}(추천|권유|하세요|하시기|바랍니다)",
        "description": "투자 권유 표현은 자본시장법 §47 위반",
    },
    {
        "id": "CG-002", "name": "수익 보장 금지", "severity": "CRITICAL",
        "pattern": r"(수익|이익|이자|원금).{0,10}(보장|확실|확정|안전|무위험)",
        "description": "수익/원금 보장 표현은 금소법 위반",
    },
    {
        "id": "CG-003", "name": "수치 출처 필수", "severity": "MEDIUM",
        "pattern": r"(약|대략|추정|정도)\s*\d[\d,.]*\s*(조|억|만|%)",
        "description": "근거 없는 수치 추정은 출처 확인 필수",
    },
    {
        "id": "CG-004", "name": "금리 정확성", "severity": "HIGH",
        "pattern": r"(금리|이율|이자율|수익률|연이율).{0,10}\d+(\.\d+)?%",
        "description": "금리/수익률 수치가 포함된 주장은 원본 대조 필수 (금감원)",
    },
    {
        "id": "CG-005", "name": "면책 조항 필수", "severity": "MEDIUM",
        "pattern": r"(반드시|무조건|확실히|틀림없이).{0,15}(이익|수익|상승|하락)",
        "description": "단정적 투자 표현은 면책 조항 필수 (금소법 §19)",
    },
    {
        "id": "CG-006", "name": "PII 보호", "severity": "CRITICAL",
        "pattern": r"(\d{6}[-]\d{7}|\d{3}[-]\d{2}[-]\d{5}|\d{3}[-]\d{4}[-]\d{4})",
        "description": "주민등록번호, 여권번호, 전화번호 등 개인정보 노출 (개인정보보호법)",
    },
    {
        "id": "CG-007", "name": "근거 없는 일반화", "severity": "MEDIUM",
        "pattern": r"(모든|전부|항상|절대|어떤.{0,5}도).{0,10}(이다|합니다|입니다)",
        "description": "근거 없는 절대적 일반화 표현",
    },
    {
        "id": "CG-008", "name": "상품 비교 공정성", "severity": "HIGH",
        "pattern": r"(최고|최저|가장|유일|독보적).{0,10}(상품|서비스|금리|수익)",
        "description": "공정하지 않은 상품 비교 표현 (금소법 §21)",
    },
    {
        "id": "CG-009", "name": "미래 예측 금지", "severity": "MEDIUM",
        "pattern": r"(앞으로|향후|내년|내달).{0,15}(오를|내릴|상승|하락|전망)",
        "description": "근거 없는 미래 가격/시장 예측",
    },
    {
        "id": "CG-010", "name": "비교 조건 명시", "severity": "MEDIUM",
        "pattern": r"(대비|비해|보다).{0,10}(높|낮|좋|나쁘|유리|불리)",
        "description": "비교 시 기준 조건이 명시되어야 함",
    },
]

# ─── 도메인 특화 규칙 (CG-018~025) ──────────────────────

FINANCE_DOMAIN_PATTERNS = [
    {
        "id": "CG-018", "name": "보험 보장 범위 왜곡", "severity": "HIGH",
        "pattern": r"(보험|보장).{0,10}(전액|100%|무제한|모든.{0,5}보장)",
        "description": "보험 보장 범위 과장 가능성 (보험업법)",
    },
    {
        "id": "CG-019", "name": "카드 한도/이율 왜곡", "severity": "HIGH",
        "pattern": r"(카드|신용|한도|이율|연회비).{0,10}\d+",
        "description": "카드 한도/이율/연회비 수치는 원본 대조 필수 (여신전문금융업법)",
    },
    {
        "id": "CG-020", "name": "연금 수급 조건 왜곡", "severity": "HIGH",
        "pattern": r"(연금|수급|가입기간|수령).{0,10}\d+.{0,3}(년|세|개월|만원|원)",
        "description": "연금 수급 조건/금액 수치 정확성 필수 (국민연금법)",
    },
    {
        "id": "CG-021", "name": "외환 규제 왜곡", "severity": "HIGH",
        "pattern": r"(외환|환전|송금|해외투자).{0,10}(한도|제한|규제).{0,10}\d+",
        "description": "외환 거래 한도/규제 수치 정확성 필수 (외국환거래법)",
    },
    {
        "id": "CG-022", "name": "세금 정보 왜곡", "severity": "HIGH",
        "pattern": r"(세금|세율|비과세|공제|면세|과세).{0,10}\d+.{0,3}(%|만원|원)",
        "description": "세금/세율/공제 금액 수치 정확성 필수 (소득세법)",
    },
    {
        "id": "CG-023", "name": "소비자 피해구제 왜곡", "severity": "HIGH",
        "pattern": r"(피해구제|분쟁조정|환불|취소|철회).{0,10}(가능|불가|기간|기한).{0,10}\d*",
        "description": "소비자 피해구제 조건/기간 정확성 필수 (금소법)",
    },
    {
        "id": "CG-024", "name": "핀테크 서비스 왜곡", "severity": "MEDIUM",
        "pattern": r"(간편결제|오픈뱅킹|마이데이터|P2P|크라우드펀딩).{0,10}(한도|수수료|이율).{0,10}\d+",
        "description": "핀테크 서비스 조건/수수료 정확성 필수 (신용정보법)",
    },
    {
        "id": "CG-025", "name": "대출 조건 왜곡", "severity": "HIGH",
        "pattern": r"(대출|융자|담보|신용).{0,10}(금리|이율|한도|기간).{0,10}\d+",
        "description": "대출 금리/한도/기간 수치 정확성 필수 (은행법)",
    },
]


# ─── 코드 내장 규칙 (CG-011~017, CG-026~028) ────────────

def _check_temporal_distortion(claim: str) -> dict | None:
    """CG-011: 시간적 왜곡 탐지 — 과거/현재/미래 시제 혼동"""
    past_markers = re.findall(r"(이전|과거|였던|했던|했습니다|되었)", claim)
    present_markers = re.findall(r"(현재|지금|이다|입니다|합니다)", claim)
    future_markers = re.findall(r"(예정|계획|될 것|할 것|전망)", claim)

    tense_count = sum(1 for m in [past_markers, present_markers, future_markers] if m)
    if tense_count >= 2:
        return {
            "rule_id": "CG-011", "rule_name": "시간적 왜곡 탐지",
            "severity": "HIGH",
            "description": "하나의 클레임 내에서 과거/현재/미래 시제가 혼용됨 — 시간적 왜곡 가능성",
        }
    return None


def _check_entity_verification(claim: str) -> dict | None:
    """CG-012: 엔티티 검증 — 기관/조직명과 역할의 불일치 탐지"""
    patterns = [
        (r"(한국은행|금감원|금융위|기재부).{0,10}(발표|발행|인가|승인)", None),
        (r"(금감원|금융감독원).{0,10}(금리|기준금리)", "금감원은 기준금리를 결정하지 않음 (한국은행 역할)"),
        (r"(한국은행).{0,10}(인가|허가|등록)", "한국은행은 금융기관 인가 기관이 아님 (금융위 역할)"),
        (r"(기재부|기획재정부).{0,10}(금리|기준금리)", "기재부는 기준금리를 결정하지 않음 (한국은행 역할)"),
    ]
    for pattern, desc in patterns:
        if desc and re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-012", "rule_name": "엔티티 역할 혼동",
                "severity": "HIGH",
                "description": desc,
            }
    return None


def _check_responsibility_reversal(claim: str) -> dict | None:
    """CG-013: 책임 소재 반전 — 주체와 책임의 반전 탐지"""
    patterns = [
        (r"(투자자|가입자|소비자).{0,5}(책임.{0,5}(없|면제|불필요))", "투자/가입 결정의 책임은 본인에게 있음"),
        (r"(은행|보험사|증권사).{0,5}(보증|보장).{0,5}(합니다|한다)", "금융기관이 투자 결과를 보증한다는 표현"),
        (r"(정부|국가).{0,5}(보장|보증).{0,5}(합니다|한다)", "정부가 투자 손실을 보장한다는 표현"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-013", "rule_name": "책임 소재 반전",
                "severity": "CRITICAL",
                "description": desc,
            }
    return None


def _check_amount_distortion(claim: str) -> dict | None:
    """CG-014: 금액 왜곡 탐지 — 단위 혼동 (만/억/조) 또는 비정상 범위"""
    amount_matches = re.findall(r"(\d[\d,.]*)\s*(조|억|만|천만|백만)\s*(원|달러|위안)?", claim)
    if not amount_matches:
        return None

    for val_str, unit, _ in amount_matches:
        try:
            val = float(val_str.replace(",", ""))
            if unit == "조" and val > 10000:
                return {
                    "rule_id": "CG-014", "rule_name": "금액 왜곡 (비정상 범위)",
                    "severity": "HIGH",
                    "description": f"{val_str}{unit}원 — 비정상적으로 큰 금액, 단위 오류 가능성",
                }
            if unit == "억" and val > 100000:
                return {
                    "rule_id": "CG-014", "rule_name": "금액 왜곡 (비정상 범위)",
                    "severity": "HIGH",
                    "description": f"{val_str}{unit}원 — 조 단위와 혼동 가능성",
                }
        except ValueError:
            continue
    return None


def _check_condition_narrowing(claim: str) -> dict | None:
    """CG-015: 조건 범위 축소 — 핵심 조건을 생략하여 범위를 축소"""
    patterns = [
        (r"(누구나|모두|제한 없이|조건 없이).{0,10}(가입|신청|이용|투자)", "가입/이용 조건이 없다는 표현은 조건 생략 가능성"),
        (r"(언제든|아무때나|즉시).{0,10}(해약|해지|인출|출금)", "해약/인출 조건이 없다는 표현은 수수료/제한 생략 가능성"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-015", "rule_name": "조건 범위 축소",
                "severity": "HIGH",
                "description": desc,
            }
    return None


def _check_variable_assertion(claim: str) -> dict | None:
    """CG-016: 변동값 단정 — 변동 가능한 값을 확정적으로 표현"""
    patterns = [
        (r"(환율|주가|금리|물가).{0,5}(이다|입니다|였습니다|한다)(?!.*변동|.*기준일)", "변동값을 확정적으로 단정"),
        (r"(현재|지금)\s*(환율|주가|시가총액|시가).{0,5}\d+", "실시간 변동값을 특정 수치로 단정"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-016", "rule_name": "변동값 단정",
                "severity": "MEDIUM",
                "description": desc,
            }
    return None


def _check_key_info_omission(claim: str) -> dict | None:
    """CG-017: 핵심 정보 누락 — 중요한 전제조건/제한사항 생략"""
    patterns = [
        (r"(수수료|비용|세금).{0,5}(없|면제|무료|제로)", "수수료/비용 면제의 조건이 생략되었을 가능성"),
        (r"(무료|공짜|0원).{0,10}(이용|사용|가입|서비스)", "무료 이용의 전제조건이 생략되었을 가능성"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-017", "rule_name": "핵심 정보 누락",
                "severity": "MEDIUM",
                "description": desc,
            }
    return None


def _check_positive_negative_reversal(claim: str) -> dict | None:
    """CG-026: 긍정-부정 반전 — 원래 부정인 내용을 긍정으로 (또는 반대로) 표현"""
    patterns = [
        (r"(제한|금지|불가|불허).{0,5}(없|않|아님)", "이중 부정 또는 제한 조건 부정 — 긍정-부정 반전 가능성"),
        (r"(손실|손해|위험|리스크).{0,5}(없|않|제로|영)", "손실/위험이 없다는 단정적 표현"),
        (r"(부작용|위험성|독성).{0,5}(없|보고되지 않|확인되지 않)", "부작용/위험성이 없다는 단정적 표현"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-026", "rule_name": "긍정-부정 반전",
                "severity": "HIGH",
                "description": desc,
            }
    return None


def _check_conditional_unconditional_reversal(claim: str) -> dict | None:
    """CG-027: 조건-무조건 반전 — 조건부 사항을 무조건적으로 표현"""
    patterns = [
        (r"(무조건|반드시|항상|예외 없이).{0,10}(지급|보장|제공|적용)", "조건부 사항을 무조건적으로 표현"),
        (r"(어떤 경우에도|상관없이|불문하고).{0,10}(가능|된다|합니다)", "예외 상황을 무시한 무조건적 표현"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-027", "rule_name": "조건-무조건 반전",
                "severity": "HIGH",
                "description": desc,
            }
    return None


def _check_condition_simplification(claim: str) -> dict | None:
    """CG-028: 조건 단순화/예외 누락 — 복잡한 조건을 지나치게 단순화"""
    patterns = [
        (r"(단,|다만,|단서|예외|제외|제한).{0,5}(없|없이|없습니다)", "예외/단서 조항이 없다는 표현 — 조건 단순화 가능성"),
        (r"(간단히|쉽게|단순히).{0,10}(하면 된다|됩니다|가능합니다)", "복잡한 절차를 지나치게 단순화한 표현"),
    ]
    for pattern, desc in patterns:
        if re.search(pattern, claim, re.IGNORECASE):
            return {
                "rule_id": "CG-028", "rule_name": "조건 단순화/예외 누락",
                "severity": "MEDIUM",
                "description": desc,
            }
    return None


# 코드 내장 규칙 함수 리스트
CODE_BASED_GUARDRAILS = [
    _check_temporal_distortion,       # CG-011
    _check_entity_verification,       # CG-012
    _check_responsibility_reversal,   # CG-013
    _check_amount_distortion,         # CG-014
    _check_condition_narrowing,       # CG-015
    _check_variable_assertion,        # CG-016
    _check_key_info_omission,         # CG-017
    _check_positive_negative_reversal,       # CG-026
    _check_conditional_unconditional_reversal,  # CG-027
    _check_condition_simplification,  # CG-028
]


class DomainAdapter:
    """도메인 특화 검증 어댑터 베이스 클래스"""

    id: str = "general"
    name: str = "General"
    name_ko: str = "일반"
    description: str = "General purpose hallucination detection"
    description_ko: str = "범용 할루시네이션 탐지"
    icon: str = "Globe"

    # 도메인 특화 가드레일 규칙 (패턴 매칭)
    guardrail_patterns: list[dict] = []

    # 도메인 전문 용어 (수치/법규 검증 강화)
    terminology: dict[str, str] = {}

    # LLM 검증 시 추가 프롬프트
    verification_prompt_suffix: str = ""

    # 도메인 특화 온톨로지 엔티티 타입
    entity_types: list[str] = []

    def check_guardrails(self, claim: str) -> dict | None:
        """도메인 + 공통 + 코드 내장 가드레일 규칙 체크. 위반 시 dict 반환, 아니면 None.

        우선순위: CRITICAL → HIGH → MEDIUM (가장 심각한 위반을 반환)

        개선:
        - CRITICAL은 즉시 override (복구 불가)
        - HIGH는 needs_nli_cross_check 플래그로 NLI 교차검증 요청
        - 모든 위반 정보를 all_violations에 포함
        - 심각도별 차등 confidence 적용
        """
        all_hits = []

        # 1. 공통 규칙 (CG-001~010)
        for rule in COMMON_GUARDRAIL_PATTERNS:
            if re.search(rule["pattern"], claim, re.IGNORECASE):
                all_hits.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule.get("severity", "MEDIUM"),
                    "description": rule["description"],
                })

        # 2. 도메인 특화 규칙 (CG-018~025 또는 도메인별)
        for rule in self.guardrail_patterns:
            if re.search(rule["pattern"], claim, re.IGNORECASE):
                all_hits.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule.get("severity", "MEDIUM"),
                    "description": rule["description"],
                })

        # 3. 코드 내장 규칙 (CG-011~017, CG-026~028)
        for check_fn in CODE_BASED_GUARDRAILS:
            hit = check_fn(claim)
            if hit:
                all_hits.append(hit)

        if not all_hits:
            return None

        # 가장 심각한 위반을 반환
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2}
        all_hits.sort(key=lambda h: severity_order.get(h["severity"], 99))
        top_hit = all_hits[0]

        # 심각도별 confidence 차등 적용
        severity_confidence = {"CRITICAL": 0.97, "HIGH": 0.90, "MEDIUM": 0.75}
        top_hit["confidence"] = severity_confidence.get(top_hit["severity"], 0.75)

        # HIGH 위반은 NLI 교차검증을 요청하여 false positive 방지
        # CRITICAL은 즉시 override (PII, 투자 권유 등 복구 불가)
        if top_hit["severity"] == "HIGH":
            top_hit["needs_nli_cross_check"] = True
        else:
            top_hit["needs_nli_cross_check"] = False

        # 모든 위반 정보를 포함 (리포팅 및 디버깅용)
        if len(all_hits) > 1:
            top_hit["all_violations"] = all_hits

        return top_hit

    def get_all_guardrail_hits(self, claim: str) -> list[dict]:
        """모든 가드레일 위반을 반환 (리포트용)"""
        all_hits = []

        for rule in COMMON_GUARDRAIL_PATTERNS:
            if re.search(rule["pattern"], claim, re.IGNORECASE):
                all_hits.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule.get("severity", "MEDIUM"),
                    "description": rule["description"],
                })

        for rule in self.guardrail_patterns:
            if re.search(rule["pattern"], claim, re.IGNORECASE):
                all_hits.append({
                    "rule_id": rule["id"],
                    "rule_name": rule["name"],
                    "severity": rule.get("severity", "MEDIUM"),
                    "description": rule["description"],
                })

        for check_fn in CODE_BASED_GUARDRAILS:
            hit = check_fn(claim)
            if hit:
                all_hits.append(hit)

        return all_hits

    def get_verification_context(self) -> str:
        """LLM 검증 시 도메인 컨텍스트를 반환"""
        if self.verification_prompt_suffix:
            return f"\n\n## 도메인 전문 규칙 ({self.name})\n{self.verification_prompt_suffix}"
        return ""


# ─── 금융 도메인 ────────────────────────────────────────

class FinanceDomainAdapter(DomainAdapter):
    id = "finance"
    name = "Finance"
    name_ko = "금융"
    description = "Financial regulations, investment, banking, insurance"
    description_ko = "금융 규제, 투자, 은행, 보험 분야 전문 검증"
    icon = "Landmark"

    guardrail_patterns = FINANCE_DOMAIN_PATTERNS

    terminology = {
        "예금자보호": "5,000만원",
        "기준금리": "한국은행 발표",
        "BIS비율": "8% 이상 의무",
    }

    verification_prompt_suffix = """금융 도메인 추가 규칙:
1. 금리, 수익률 등 수치는 소수점까지 정확해야 합니다.
2. 법률 조항 인용 시 법률명과 조항번호가 정확해야 합니다.
3. 투자 권유로 해석될 수 있는 표현은 contradicted로 판정하세요.
4. 보험/연금 상품 조건은 원본과 100% 일치해야 합니다."""

    entity_types = ["FinancialProduct", "Regulation", "FinancialInstitution"]


# ─── 국방 도메인 ────────────────────────────────────────

class DefenseDomainAdapter(DomainAdapter):
    id = "defense"
    name = "Defense"
    name_ko = "국방"
    description = "Military, defense systems, security classifications"
    description_ko = "군사, 방위 시스템, 보안 등급 분류 전문 검증"
    icon = "ShieldAlert"

    guardrail_patterns = [
        {"id": "DEF-001", "name": "기밀 등급 정보", "pattern": r"(1급|2급|3급|대외비|극비|비밀).{0,5}(기밀|보안|문서)", "severity": "CRITICAL", "description": "기밀 등급 정보 포함 여부 확인 필수"},
        {"id": "DEF-002", "name": "무기 체계 수치", "pattern": r"(사거리|탄두|구경|속도).{0,10}\d", "severity": "HIGH", "description": "무기 체계 제원 수치는 원본 대조 필수"},
        {"id": "DEF-003", "name": "부대 배치 정보", "pattern": r"(사단|여단|대대|연대).{0,10}(배치|주둔|위치)", "severity": "CRITICAL", "description": "부대 배치 정보는 보안 사항"},
        {"id": "DEF-004", "name": "작전 일정", "pattern": r"(작전|훈련|기동).{0,10}(일자|일시|시기)", "severity": "HIGH", "description": "작전 일정 정보 노출 위험"},
    ]

    verification_prompt_suffix = """국방 도메인 추가 규칙:
1. 무기 체계 제원(사거리, 속도, 탄두 중량 등)은 정확한 수치 검증이 필수입니다.
2. 부대 배치, 작전 정보는 보안 민감 정보로 신중히 판정하세요.
3. 기밀 등급 관련 내용은 출처 확인 후 판정하세요.
4. 군사 용어의 정확성을 검증하세요."""

    entity_types = ["WeaponSystem", "MilitaryUnit", "Operation", "SecurityClassification"]


# ─── 행정 도메인 ────────────────────────────────────────

class GovernmentDomainAdapter(DomainAdapter):
    id = "government"
    name = "Government"
    name_ko = "행정"
    description = "Public administration, policy, civil service"
    description_ko = "공공 행정, 정책, 민원 서비스 전문 검증"
    icon = "Building"

    guardrail_patterns = [
        {"id": "GOV-001", "name": "법령 조항 인용", "pattern": r"(제\d+조|§\d+|법률 제\d+호)", "severity": "HIGH", "description": "법령 조항 인용은 정확성 필수"},
        {"id": "GOV-002", "name": "예산 수치", "pattern": r"(예산|세출|세입|국비).{0,10}\d+.{0,3}(억|조|만)", "severity": "HIGH", "description": "공공 예산 수치는 원본 대조 필수"},
        {"id": "GOV-003", "name": "정책 시행일", "pattern": r"(시행|발효|적용).{0,10}(\d{4}년|\d+월|\d+일)", "severity": "MEDIUM", "description": "정책 시행일자 정확성 검증"},
        {"id": "GOV-004", "name": "부처/기관명", "pattern": r"(부|처|청|위원회|공단|공사|원)", "severity": "MEDIUM", "description": "정부 기관명 정확성 검증"},
    ]

    verification_prompt_suffix = """행정 도메인 추가 규칙:
1. 법령/조례 인용 시 법률명, 조항번호, 시행일이 정확해야 합니다.
2. 예산/통계 수치는 공식 발표 자료와 일치해야 합니다.
3. 정부 부처/기관명은 정식 명칭을 사용해야 합니다.
4. 정책 시행일자와 적용 대상은 원본과 일치해야 합니다."""

    entity_types = ["GovernmentAgency", "Legislation", "Policy", "Budget"]


# ─── 교육 도메인 ────────────────────────────────────────

class EducationDomainAdapter(DomainAdapter):
    id = "education"
    name = "Education"
    name_ko = "교육"
    description = "Academic research, citations, educational content"
    description_ko = "학술 연구, 인용, 교육 콘텐츠 전문 검증"
    icon = "GraduationCap"

    guardrail_patterns = [
        {"id": "EDU-001", "name": "학술 인용 정확성", "pattern": r"\(\d{4}\)|\[\d+\]|et al\.", "severity": "HIGH", "description": "학술 인용 형식이 포함된 주장은 출처 검증 필수"},
        {"id": "EDU-002", "name": "통계 수치 인용", "pattern": r"(연구|조사|실험).{0,10}(결과|발표|보고).{0,10}\d+", "severity": "HIGH", "description": "연구 통계 수치는 원본 논문 대조 필수"},
        {"id": "EDU-003", "name": "표절 의심", "pattern": r"(에 따르면|에 의하면|주장에 따르면)", "severity": "MEDIUM", "description": "인용 출처가 정확한지 검증"},
        {"id": "EDU-004", "name": "교육과정 정보", "pattern": r"(교육과정|커리큘럼|학점|이수).{0,10}\d", "severity": "MEDIUM", "description": "교육과정 관련 수치/조건 정확성"},
    ]

    verification_prompt_suffix = """교육 도메인 추가 규칙:
1. 학술 논문 인용 시 저자명, 연도, 저널명이 정확해야 합니다.
2. 연구 결과 수치(p-value, 표본 크기, 효과 크기)는 원본 대조 필수입니다.
3. 인용 출처가 실제 존재하는 논문인지 확인하세요.
4. 교육 제도/과정 관련 정보는 최신 기준인지 확인하세요."""

    entity_types = ["Paper", "Author", "Journal", "University", "Course"]


# ─── 레지스트리 초기화 ──────────────────────────────────

def _register_adapters():
    for cls in [FinanceDomainAdapter, DefenseDomainAdapter, GovernmentDomainAdapter, EducationDomainAdapter]:
        adapter = cls()
        DOMAIN_REGISTRY[adapter.id] = adapter
    # 기본(general) 어댑터
    DOMAIN_REGISTRY["general"] = DomainAdapter()

_register_adapters()


def get_domain_adapter(domain_id: str) -> DomainAdapter:
    """도메인 ID로 어댑터를 반환. 없으면 general."""
    return DOMAIN_REGISTRY.get(domain_id, DOMAIN_REGISTRY["general"])


def list_domains() -> list[dict]:
    """사용 가능한 도메인 목록 반환."""
    return [
        {
            "id": a.id,
            "name": a.name,
            "name_ko": a.name_ko,
            "description": a.description,
            "description_ko": a.description_ko,
            "icon": a.icon,
            "guardrail_count": len(a.guardrail_patterns) + len(COMMON_GUARDRAIL_PATTERNS) + len(CODE_BASED_GUARDRAILS),
            "entity_types": a.entity_types,
        }
        for a in DOMAIN_REGISTRY.values()
    ]


def count_all_rules() -> dict:
    """전체 규칙 수 집계"""
    return {
        "common_patterns": len(COMMON_GUARDRAIL_PATTERNS),       # CG-001~010: 10
        "finance_domain": len(FINANCE_DOMAIN_PATTERNS),           # CG-018~025: 8
        "defense_domain": 4,                                       # DEF-001~004
        "government_domain": 4,                                    # GOV-001~004
        "education_domain": 4,                                     # EDU-001~004
        "code_based": len(CODE_BASED_GUARDRAILS),                 # CG-011~017, CG-026~028: 10
        "total": (
            len(COMMON_GUARDRAIL_PATTERNS)
            + len(FINANCE_DOMAIN_PATTERNS)
            + 4 + 4 + 4  # DEF, GOV, EDU
            + len(CODE_BASED_GUARDRAILS)
        ),
    }
