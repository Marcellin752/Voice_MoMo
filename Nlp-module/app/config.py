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
    gemini_api_key: str
    gemini_model: str
    backend_action_url: str
    backend_api_key: str
    disable_ssl_verify: bool
    request_timeout_seconds: float


settings = Settings(
    gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
    gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    backend_action_url=os.getenv("BACKEND_ACTION_URL", ""),
    backend_api_key=os.getenv("BACKEND_API_KEY", ""),
    disable_ssl_verify=_as_bool(os.getenv("DISABLE_SSL_VERIFY"), False),
    request_timeout_seconds=_as_float(os.getenv("REQUEST_TIMEOUT_SECONDS"), 15.0),
)
