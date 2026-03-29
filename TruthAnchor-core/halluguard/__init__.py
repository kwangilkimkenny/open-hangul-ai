"""HalluGuard Core — LLM 할루시네이션 검출·교정 엔진

독립 패키지로 제공되는 핵심 검증 파이프라인.
외부 DB/벡터 DB 없이 stateless로 동작합니다.

사용법:
    from halluguard import verify, verify_sync

    # 비동기
    result = await verify(source_text="원본 문서", llm_output="AI 생성 텍스트")

    # 동기 (편의용)
    result = verify_sync(source_text="원본 문서", llm_output="AI 생성 텍스트")
"""

__version__ = "0.2.0"

from halluguard.pipeline import verify, verify_sync

__all__ = ["verify", "verify_sync", "__version__"]
