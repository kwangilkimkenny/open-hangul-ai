"""LLM 기반 2차 클레임 검증 — NLI 미확인(neutral) 클레임을 재검증"""

import json
import re
import structlog
from halluguard.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

# LLM 호출 최대 재시도 횟수
_MAX_RETRIES = 1


def _extract_json_from_text(text: str) -> dict | None:
    """LLM 응답에서 JSON을 추출. 코드블록, 불완전 JSON 등 다양한 형식 처리."""
    raw = text.strip()

    # 1차: 코드블록 감싸인 경우
    if "```" in raw:
        parts = raw.split("```")
        for part in parts[1:]:
            candidate = part.strip()
            if candidate.startswith("json"):
                candidate = candidate[4:].strip()
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                continue

    # 2차: 직접 JSON 파싱
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # 3차: 텍스트에서 JSON 객체 패턴 추출
    json_match = re.search(r'\{[^{}]*"verdict"[^{}]*\}', raw, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    # 4차: 정규식 기반 필드별 추출 (최후 수단)
    verdict_match = re.search(r'"verdict"\s*:\s*"(supported|contradicted|neutral)"', raw)
    conf_match = re.search(r'"confidence"\s*:\s*([\d.]+)', raw)
    reason_match = re.search(r'"reasoning"\s*:\s*"([^"]*)"', raw)

    if verdict_match:
        return {
            "verdict": verdict_match.group(1),
            "confidence": float(conf_match.group(1)) if conf_match else 0.5,
            "reasoning": reason_match.group(1) if reason_match else "",
        }

    return None


async def llm_verify_claim(
    claim: str,
    evidence_texts: list[str],
    model: str | None = None,
    domain_context: str = "",
) -> dict:
    """LLM에 직접 클레임-근거 판정을 요청.

    NLI 모델이 neutral로 판정한 클레임에 대해 2차 검증으로 사용.
    원본 문서 근거만 사용하여 판정 (외부 지식 사용 금지).

    개선사항:
    - Few-shot 예시 포함으로 판정 일관성 향상
    - 견고한 JSON 파싱 (정규식 폴백)
    - 1회 재시도 로직

    Returns:
        {
            "verdict": "supported" | "contradicted" | "neutral",
            "confidence": float (0.0~1.0),
            "best_evidence": str,
            "reasoning": str,
        }
    """
    default_result = {
        "verdict": "neutral", "confidence": 0.5,
        "best_evidence": evidence_texts[0] if evidence_texts else "",
        "reasoning": "",
    }

    if not evidence_texts:
        return {**default_result, "reasoning": "근거 없음"}

    evidence_block = "\n\n".join(
        f"[근거 {i+1}]\n{ev}" for i, ev in enumerate(evidence_texts) if ev.strip()
    )

    prompt = f"""당신은 팩트체크 전문가입니다. 주어진 '클레임'이 '근거 자료'에 의해 지지되는지 판정해주세요.

## 판정 규칙
1. 근거 자료에 명시적으로 포함된 정보만 사용하세요.
2. 외부 지식이나 상식을 절대 사용하지 마세요. 근거 자료에 없는 정보로 판단하면 안 됩니다.
3. 근거 자료의 내용과 클레임의 의미가 일치하면 "supported"입니다.
4. 근거 자료의 내용과 클레임이 명백히 모순되면 "contradicted"입니다.
5. 근거 자료에 관련 내용이 없거나 판단할 수 없으면 "neutral"입니다.
6. 부분적으로 일치하더라도 핵심 주장이 근거와 부합하면 "supported"로 판정하세요.
7. 수치(금액, 비율, 날짜)가 다르면 반드시 "contradicted"로 판정하세요.

## 판정 예시
- 클레임: "한국은행 기준금리는 3.5%이다" / 근거: "한국은행이 기준금리를 3.50%로 유지" → supported (0.95)
- 클레임: "GDP 성장률이 2.1%이다" / 근거: "GDP 성장률은 1.4%로 하락" → contradicted (0.92)
- 클레임: "삼성전자가 신제품을 출시했다" / 근거: "현대차의 신차 출시 일정" → neutral (0.5)

## 클레임
{claim}

## 근거 자료
{evidence_block}
{domain_context}
## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{{"verdict": "supported 또는 contradicted 또는 neutral", "confidence": 0.0~1.0 사이 숫자, "reasoning": "판정 이유를 한 문장으로"}}"""

    import litellm

    for attempt in range(_MAX_RETRIES + 1):
        try:
            response = await litellm.acompletion(
                model=model or settings.DEFAULT_LLM_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.0,
            )

            raw = response.choices[0].message.content.strip()
            parsed = _extract_json_from_text(raw)

            if parsed is None:
                logger.warning("LLM verify JSON parse failed", raw=raw[:200], attempt=attempt)
                if attempt < _MAX_RETRIES:
                    continue
                return default_result

            verdict = parsed.get("verdict", "neutral")
            if verdict not in ("supported", "contradicted", "neutral"):
                verdict = "neutral"

            confidence = float(parsed.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))
            reasoning = parsed.get("reasoning", "")

            best_evidence = evidence_texts[0] if evidence_texts else ""

            logger.info(
                "LLM re-verification",
                claim=claim[:60],
                verdict=verdict,
                confidence=round(confidence, 2),
            )

            return {
                "verdict": verdict,
                "confidence": round(confidence, 4),
                "best_evidence": best_evidence,
                "reasoning": reasoning,
            }

        except Exception as e:
            logger.warning("LLM verify failed", error=str(e), attempt=attempt)
            if attempt < _MAX_RETRIES:
                continue
            return default_result

    return default_result
