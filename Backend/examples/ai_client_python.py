import httpx


class NLPClient:
    def __init__(self, base_url: str = "http://localhost:8001", timeout: float = 3.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def parse(self, text: str, locale: str = "fr-FR") -> dict:
        payload = {"text": text, "locale": locale}
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(f"{self.base_url}/ai/parse", json=payload)
            response.raise_for_status()
            return response.json()


if __name__ == "__main__":
    client = NLPClient()
    result = client.parse("Envoie 5000 a Jean")
    print(result)
