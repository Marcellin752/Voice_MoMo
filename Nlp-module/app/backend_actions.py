import httpx

from app.config import settings


class BackendActionClient:
    def __init__(self) -> None:
        self.base_url = settings.backend_action_url.rstrip("/")
        self.api_key = settings.backend_api_key
        self.timeout = settings.request_timeout_seconds

    async def run(self, action: str, payload: dict) -> dict:
        if not self.base_url:
            return {
                "status": "simulated",
                "action": action,
                "payload": payload,
                "message": "Mode simulation actif: BACKEND_ACTION_URL non configure.",
            }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        body = {"action": action, "payload": payload}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/actions/execute", json=body, headers=headers)
            response.raise_for_status()
            return response.json()
