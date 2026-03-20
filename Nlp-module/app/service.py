from app.fallback import parse_with_fallback
from app.grok_client import GrokClient
from app.models import ParseCommandResponse


class CommandParserService:
    def __init__(self) -> None:
        self.client = GrokClient()

    async def parse(self, text: str) -> ParseCommandResponse:
        try:
            return await self.client.parse_command(text)
        except Exception:
            return parse_with_fallback(text)
