from fastapi import FastAPI

from app.models import ParseCommandRequest, ParseCommandResponse
from app.service import CommandParserService

app = FastAPI(title="Voice MoMo NLP Service", version="0.1.0")
service = CommandParserService()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/parse", response_model=ParseCommandResponse)
async def parse_command(payload: ParseCommandRequest) -> ParseCommandResponse:
    return await service.parse(payload.text)
