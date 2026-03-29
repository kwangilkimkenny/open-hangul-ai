"""LLM 기반 엔티티/관계 추출 — 문서에서 지식그래프 트리플 생성"""

import json
import structlog

from halluguard.config import get_settings
from halluguard.engine.ontology import get_schema_prompt

logger = structlog.get_logger()
settings = get_settings()


async def extract_entities_and_relations(
    text: str,
    doc_name: str = "",
    model: str | None = None,
) -> dict:
    """문서 텍스트에서 온톨로지 스키마에 맞는 엔티티와 관계를 추출.

    Returns:
        {
            "entities": [{"name": str, "type": str, "properties": dict}, ...],
            "relations": [{"source": str, "target": str, "type": str, "properties": dict}, ...]
        }
    """
    if not text.strip():
        return {"entities": [], "relations": []}

    # 텍스트가 너무 길면 앞부분만 사용 (LLM 컨텍스트 제한)
    max_chars = 12_000
    truncated = text[:max_chars]

    schema = get_schema_prompt()

    try:
        import litellm

        prompt = f"""당신은 지식그래프 전문가입니다. 아래 문서에서 엔티티(개체)와 관계를 추출하세요.

## 온톨로지 스키마
{schema}

## 추출 규칙
1. 문서에 명시적으로 언급된 사실만 추출하세요.
2. 추론하거나 외부 지식을 추가하지 마세요.
3. 엔티티 이름은 문서에 쓰인 그대로 사용하세요.
4. 약어가 있으면 풀네임을 name으로, 약어를 properties.alias로 저장하세요.
5. 수치 정보는 Quantity 엔티티로 추출하고 value와 unit을 분리하세요.
6. 동일 엔티티가 여러 이름으로 등장하면 하나로 통합하세요.

## 문서
{truncated}

## 응답 형식 (JSON만 출력, 설명 없이)
{{
  "entities": [
    {{"name": "엔티티명", "type": "Organization|Person|Product|Technology|Event|Location|Quantity|Concept", "properties": {{"key": "value"}}}}
  ],
  "relations": [
    {{"source": "소스 엔티티명", "target": "타겟 엔티티명", "type": "DEVELOPED_BY|CONTAINS|PRESENTED_AT|LOCATED_IN|AFFILIATED_WITH|HAS_PROPERTY|REGULATES|COMPETES_WITH|RELATED_TO", "properties": {{}}}}
  ]
}}"""

        response = await litellm.acompletion(
            model=model or settings.DEFAULT_LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.0,
        )

        raw = response.choices[0].message.content.strip()

        # JSON 추출
        if "```" in raw:
            parts = raw.split("```")
            for part in parts:
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    raw = part
                    break

        parsed = json.loads(raw)

        entities = parsed.get("entities", [])
        relations = parsed.get("relations", [])

        # 유효성 검증
        valid_entities = []
        for e in entities:
            if isinstance(e, dict) and e.get("name"):
                valid_entities.append({
                    "name": str(e["name"]).strip(),
                    "type": str(e.get("type", "Thing")),
                    "properties": e.get("properties", {}),
                })

        valid_relations = []
        entity_names = {e["name"] for e in valid_entities}
        for r in relations:
            if isinstance(r, dict) and r.get("source") and r.get("target"):
                src = str(r["source"]).strip()
                tgt = str(r["target"]).strip()
                if src in entity_names and tgt in entity_names:
                    valid_relations.append({
                        "source": src,
                        "target": tgt,
                        "type": str(r.get("type", "RELATED_TO")),
                        "properties": r.get("properties", {}),
                    })

        logger.info(
            "Entities/relations extracted",
            doc_name=doc_name,
            entities=len(valid_entities),
            relations=len(valid_relations),
        )

        return {"entities": valid_entities, "relations": valid_relations}

    except json.JSONDecodeError as e:
        logger.warning("Entity extraction JSON parse failed", error=str(e))
        return {"entities": [], "relations": []}
    except Exception as e:
        logger.warning("Entity extraction failed", error=str(e))
        return {"entities": [], "relations": []}


async def extract_claim_entities(claim: str, model: str | None = None) -> list[str]:
    """클레임 텍스트에서 엔티티 이름만 빠르게 추출 (KG 쿼리용)."""
    try:
        import litellm

        prompt = f"""아래 문장에서 고유명사(조직명, 인물명, 제품명, 기술명, 행사명, 지명)를 추출하세요.
JSON 배열로만 응답하세요. 설명 없이.

문장: {claim}

응답 예시: ["YATAV", "AEGIS", "MWC 2026"]"""

        response = await litellm.acompletion(
            model=model or settings.DEFAULT_LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.0,
        )

        raw = response.choices[0].message.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        names = json.loads(raw)
        if isinstance(names, list):
            return [str(n).strip() for n in names if n]
        return []

    except Exception as e:
        logger.warning("Claim entity extraction failed", error=str(e))
        # 폴백: 대문자 단어/한국어 고유명사 패턴 추출
        import re
        patterns = re.findall(r'[A-Z][A-Za-z0-9]+(?:\s[A-Z][A-Za-z0-9]+)*', claim)
        return patterns
