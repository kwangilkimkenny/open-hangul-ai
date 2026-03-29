"""HalluGuard Core 설정 — 외부 프레임워크(pydantic-settings) 의존성 없음

환경변수 또는 직접 설정으로 동작합니다.
"""

import os
from dataclasses import dataclass, field


@dataclass
class HalluGuardConfig:
    """검증 엔진 설정. 환경변수 또는 직접 값 주입."""

    # LLM 설정
    DEFAULT_LLM_MODEL: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEEPSEEK_API_KEY: str = ""

    # NLI 설정
    NLI_MODEL: str = "cross-encoder/nli-deberta-v3-base"
    NLI_ENABLED: bool = True

    # LLM 검증 활성화
    LLM_VERIFY_ENABLED: bool = True

    # 도메인 기본값
    DEFAULT_DOMAIN: str = "general"

    # 내부 플래그: 필드가 명시적으로 전달되었는지 추적
    _explicit_keys: set = field(default_factory=set, repr=False)

    def __post_init__(self):
        """환경변수에서 미설정 값을 로드. 명시적으로 전달된 값은 환경변수보다 우선."""
        if "DEFAULT_LLM_MODEL" not in self._explicit_keys and not self.DEFAULT_LLM_MODEL:
            self.DEFAULT_LLM_MODEL = os.getenv("HALLUGUARD_LLM_MODEL", os.getenv("DEFAULT_LLM_MODEL", ""))
        if "OPENAI_API_KEY" not in self._explicit_keys and not self.OPENAI_API_KEY:
            self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        if "ANTHROPIC_API_KEY" not in self._explicit_keys and not self.ANTHROPIC_API_KEY:
            self.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
        if "DEEPSEEK_API_KEY" not in self._explicit_keys and not self.DEEPSEEK_API_KEY:
            self.DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

        # LLM 모델 자동 결정: API 키가 있는 첫 번째 모델 선택
        if not self.DEFAULT_LLM_MODEL:
            if self.OPENAI_API_KEY:
                self.DEFAULT_LLM_MODEL = "openai/gpt-4-turbo-preview"
            elif self.ANTHROPIC_API_KEY:
                self.DEFAULT_LLM_MODEL = "anthropic/claude-sonnet-4-20250514"
            elif self.DEEPSEEK_API_KEY:
                self.DEFAULT_LLM_MODEL = "deepseek/deepseek-chat"

        # API 키를 litellm 환경변수에도 설정
        if self.OPENAI_API_KEY:
            os.environ.setdefault("OPENAI_API_KEY", self.OPENAI_API_KEY)
        if self.ANTHROPIC_API_KEY:
            os.environ.setdefault("ANTHROPIC_API_KEY", self.ANTHROPIC_API_KEY)
        if self.DEEPSEEK_API_KEY:
            os.environ.setdefault("DEEPSEEK_API_KEY", self.DEEPSEEK_API_KEY)


# 전역 설정 싱글턴
_config: HalluGuardConfig | None = None


def get_settings() -> HalluGuardConfig:
    """전역 설정 반환. 최초 호출 시 환경변수에서 자동 로드."""
    global _config
    if _config is None:
        _config = HalluGuardConfig()
    return _config


def configure(**kwargs) -> HalluGuardConfig:
    """설정을 직접 주입. API 서버 시작 시 또는 테스트에서 사용.

    예:
        from halluguard.config import configure
        configure(OPENAI_API_KEY="sk-...", DEFAULT_LLM_MODEL="openai/gpt-4-turbo-preview")
    """
    global _config
    explicit = set(kwargs.keys())
    _config = HalluGuardConfig(**kwargs, _explicit_keys=explicit)
    return _config
