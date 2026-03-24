from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import ParseCommandRequest, ParseCommandResponse
from app.service import CommandParserService

app = FastAPI(title="Voice MoMo NLP Service", version="0.1.0")

# Add CORS middleware to allow requests from the mobile frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (localhost:5173, 5174, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = CommandParserService()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/parse", response_model=ParseCommandResponse)
async def parse_command(payload: ParseCommandRequest) -> ParseCommandResponse:
    return await service.parse(payload.text)
