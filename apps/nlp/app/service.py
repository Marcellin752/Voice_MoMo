from app.fallback import parse_with_fallback
from app.entity_normalizer import normalize_parsed_entities
from app.gemini_client import GeminiClient
from app.models import ParseCommandResponse


class CommandParserService:
    def __init__(self) -> None:
        self.client = GeminiClient()

    async def parse(self, text: str) -> ParseCommandResponse:
        try:
            parsed = await self.client.parse_command(text)
            return normalize_parsed_entities(parsed)
        except Exception:
            parsed = parse_with_fallback(text)
            return normalize_parsed_entities(parsed)
