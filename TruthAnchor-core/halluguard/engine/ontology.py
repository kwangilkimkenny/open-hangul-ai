"""온톨로지 스키마 정의 — 지식그래프의 엔티티/관계 타입 체계

존재론(Ontology) 철학을 기술적으로 반영:
- 엔티티는 "무엇이 존재하는가"를 분류 (Thing → Agent, Artifact, Event, Property)
- 관계는 "존재들이 어떻게 연결되는가"를 정의
- 속성은 "존재의 본질적 특성"을 기술
"""

# ─── 엔티티 타입 계층 ───────────────────────────────────

ENTITY_TYPES = {
    "Organization": {
        "description": "기업, 기관, 단체",
        "parent": "Agent",
        "properties": ["name", "type", "founded", "headquarters"],
    },
    "Person": {
        "description": "사람, 인물",
        "parent": "Agent",
        "properties": ["name", "title", "affiliation"],
    },
    "Product": {
        "description": "제품, 소프트웨어, 플랫폼, 서비스",
        "parent": "Artifact",
        "properties": ["name", "version", "type", "license"],
    },
    "Technology": {
        "description": "기술, 알고리즘, 프레임워크, 모델",
        "parent": "Artifact",
        "properties": ["name", "type", "domain"],
    },
    "Event": {
        "description": "행사, 회의, 발표, 사건",
        "parent": "Event",
        "properties": ["name", "date", "location", "participants"],
    },
    "Location": {
        "description": "장소, 도시, 국가",
        "parent": "Thing",
        "properties": ["name", "country", "type"],
    },
    "Quantity": {
        "description": "수치, 금액, 비율, 통계",
        "parent": "Property",
        "properties": ["value", "unit", "context"],
    },
    "Concept": {
        "description": "추상 개념, 정책, 법률, 표준",
        "parent": "Thing",
        "properties": ["name", "domain", "description"],
    },
}

# ─── 관계 타입 ──────────────────────────────────────────

RELATION_TYPES = {
    "DEVELOPED_BY": {
        "description": "제품/기술이 조직/사람에 의해 개발됨",
        "source": ["Product", "Technology"],
        "target": ["Organization", "Person"],
    },
    "CONTAINS": {
        "description": "상위 개체가 하위 개체를 포함",
        "source": ["Product", "Organization"],
        "target": ["Technology", "Product", "Person"],
    },
    "PRESENTED_AT": {
        "description": "발표/공개된 행사",
        "source": ["Product", "Organization"],
        "target": ["Event"],
    },
    "LOCATED_IN": {
        "description": "위치 관계",
        "source": ["Organization", "Event", "Person"],
        "target": ["Location"],
    },
    "AFFILIATED_WITH": {
        "description": "소속/제휴 관계",
        "source": ["Person"],
        "target": ["Organization"],
    },
    "HAS_PROPERTY": {
        "description": "수치/속성을 가짐",
        "source": ["Organization", "Product", "Event"],
        "target": ["Quantity"],
    },
    "REGULATES": {
        "description": "규제/관리 관계",
        "source": ["Concept"],
        "target": ["Organization", "Product", "Technology"],
    },
    "COMPETES_WITH": {
        "description": "경쟁 관계",
        "source": ["Organization", "Product"],
        "target": ["Organization", "Product"],
    },
    "RELATED_TO": {
        "description": "일반적 관련 관계 (기타)",
        "source": ["*"],
        "target": ["*"],
    },
}

# ─── LLM 프롬프트용 스키마 문자열 ───────────────────────

def get_schema_prompt() -> str:
    """LLM에게 전달할 온톨로지 스키마 설명 문자열"""
    entity_lines = []
    for etype, info in ENTITY_TYPES.items():
        props = ", ".join(info["properties"])
        entity_lines.append(f"  - {etype}: {info['description']} (속성: {props})")

    relation_lines = []
    for rtype, info in RELATION_TYPES.items():
        src = "/".join(info["source"])
        tgt = "/".join(info["target"])
        relation_lines.append(f"  - {rtype}: {info['description']} ({src} → {tgt})")

    return f"""## 엔티티 타입
{chr(10).join(entity_lines)}

## 관계 타입
{chr(10).join(relation_lines)}"""
