"""FastAPI TTS — POST /synthesize returns WAV."""

from __future__ import annotations

import json
import time
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

from tts_engine import synthesize_to_wav_bytes

app = FastAPI(title="Voice TTS", version="1.0.0")


def _log_json(level: str, message: str, **extra: object) -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "tts",
        "level": level,
        "message": message,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/synthesize")
async def synthesize(body: dict[str, Any]) -> Response:
    text = str(body.get("text", "")).strip()
    if not text:
        raise HTTPException(status_code=400, detail="text required")
    try:
        started = time.time()
        data = synthesize_to_wav_bytes(text)
        _log_json("info", "synthesize_ok", ms=int((time.time() - started) * 1000))
        return Response(content=data, media_type="audio/wav")
    except Exception as e:
        _log_json("error", "synthesize_failed", error=type(e).__name__)
        raise HTTPException(status_code=500, detail="Synthesis failed") from e
