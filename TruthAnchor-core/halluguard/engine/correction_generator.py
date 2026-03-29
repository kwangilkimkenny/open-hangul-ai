"""할루시네이션 발견 시 원본 근거 기반 수정문 생성"""

import structlog
from halluguard.config import get_settings

logger = structlog.get_logger()
settings = get_settings()


async def generate_correction(
    claim: str,
    evidence: str,
    model: str | None = None,
) -> str | None:
    """할루시네이션 클레임에 대해 원본 근거 기반 수정 제안을 생성.

    Args:
        claim: 할루시네이션으로 판정된 클레임
        evidence: 원본 문서에서 추출한 근거 텍스트
        model: 사용할 LLM 모델

    Returns:
        수정된 문장 또는 None
    """
    if not evidence.strip():
        return None

    try:
        import litellm

        prompt = f"""당신은 팩트체커입니다. 아래 '원문 주장'이 '근거 자료'와 다릅니다.
근거 자료에 기반하여 원문 주장을 정확하게 수정해 주세요.

[원문 주장]
{claim}

[근거 자료]
{evidence}

[수정 규칙]
1. 근거 자료에 있는 사실만 사용하세요.
2. 원문의 문체와 톤을 유지하세요.
3. 수정된 문장만 출력하세요. 설명 없이.

[수정된 문장]"""

        response = await litellm.acompletion(
            model=model or settings.DEFAULT_LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.1,
        )

        correction = response.choices[0].message.content.strip()
        return correction

    except Exception as e:
        logger.warning("Correction generation failed", error=str(e))
        return f"[수정 제안 불가] 근거: {evidence[:200]}"
