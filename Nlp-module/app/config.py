import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value: str, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_float(value: str, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    xai_api_key: str
    xai_base_url: str
    xai_model: str
    xai_voice: str
    gemini_api_key: str
    gemini_model: str
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    backend_action_url: str
    backend_api_key: str
    disable_ssl_verify: bool
    request_timeout_seconds: float


settings = Settings(
    xai_api_key=os.getenv("XAI_API_KEY", ""),
    xai_base_url=os.getenv("XAI_BASE_URL", "https://api.x.ai/v1"),
    xai_model=os.getenv("XAI_MODEL", "grok-2-latest"),
    xai_voice=os.getenv("XAI_VOICE", "Ara"),
    gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
    gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
    livekit_url=os.getenv("LIVEKIT_URL", ""),
    livekit_api_key=os.getenv("LIVEKIT_API_KEY", ""),
    livekit_api_secret=os.getenv("LIVEKIT_API_SECRET", ""),
    backend_action_url=os.getenv("BACKEND_ACTION_URL", ""),
    backend_api_key=os.getenv("BACKEND_API_KEY", ""),
    disable_ssl_verify=_as_bool(os.getenv("DISABLE_SSL_VERIFY"), False),
    request_timeout_seconds=_as_float(os.getenv("REQUEST_TIMEOUT_SECONDS"), 15.0),
)
