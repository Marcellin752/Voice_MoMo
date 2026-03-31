"""FastAPI NLU service — POST /parse."""

from __future__ import annotations

import json
import time
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from contact_resolver import resolve
from intent_parser import build_voice_confirmation, parse_intent

app = FastAPI(title="Voice NLU", version="1.0.0")


class ParseRequest(BaseModel):
    text: str = Field(default="")


def _log_json(level: str, message: str, **extra: object) -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "nlu",
        "level": level,
        "message": message,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse")
async def parse(body: ParseRequest) -> JSONResponse:
    text = body.text.strip()
    intent = parse_intent(text)
    to_alias = intent.get("to")
    to_resolved = resolve(to_alias) if to_alias else None
    voice_confirmation = build_voice_confirmation(intent)

    out = {
        "action": intent["action"],
        "amount": intent.get("amount"),
        "to": to_alias,
        "to_resolved": to_resolved,
        "confidence": intent.get("confidence", 0.5),
        "voice_confirmation": voice_confirmation,
        "raw_text": intent.get("raw_text", text),
    }
    _log_json("info", "parse_ok", action=out["action"])
    return JSONResponse(content=out)
