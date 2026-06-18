import logging
import requests

from app.config import settings

logger = logging.getLogger(__name__)


class BackendActionClient:
    """Client synchrone vers le TypeScript backend (POST /api/v1/execute-sync)."""

    def __init__(self) -> None:
        self.base_url = settings.backend_action_url.rstrip("/")
        self.api_key = settings.backend_api_key
        self.timeout = settings.request_timeout_seconds

    @property
    def available(self) -> bool:
        return bool(self.base_url)

    def run(self, action: str, country: str, params: dict, pin: str = "0000") -> dict:
        """
        Exécute une action via le backend TypeScript.
        Retourne {"success": bool, "mtnMessage": str, "voiceResponse": str, "newBalance": float|None}
        ou {"status": "simulated"} si BACKEND_ACTION_URL n'est pas configuré.
        """
        if not self.available:
            return {
                "status": "simulated",
                "action": action,
                "message": "Mode simulation — BACKEND_ACTION_URL non configuré.",
            }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key

        body = {"action": action, "country": country, "params": params, "pin": pin}

        try:
            response = requests.post(
                f"{self.base_url}/api/v1/execute-sync",
                json=body,
                headers=headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.error("BackendActionClient timeout")
            raise
        except requests.exceptions.RequestException as e:
            logger.error(f"BackendActionClient error: {e}")
            raise


_client: BackendActionClient | None = None


def get_backend_client() -> BackendActionClient:
    global _client
    if _client is None:
        _client = BackendActionClient()
    return _client
