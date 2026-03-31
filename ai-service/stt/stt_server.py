"""FastAPI STT service — POST /transcribe."""

from __future__ import annotations

import json
import logging
import os
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from whisper_engine import transcribe

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Voice STT", version="1.0.0")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _log_json(level: str, message: str, **extra: object) -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "stt",
        "level": level,
        "message": message,
        **{k: v for k, v in extra.items() if k not in ("phone", "pin")},
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)) -> JSONResponse:
    suffix = Path(audio.filename or "audio.bin").suffix.lower() or ".wav"
    allowed = {".wav", ".webm", ".m4a", ".mp3", ".ogg", ".flac", ".opus"}
    if suffix not in allowed:
        suffix = ".webm"

    data = await audio.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(data)
    tmp.close()
    path = tmp.name

    try:
        started = time.time()
        result = transcribe(path)
        elapsed = time.time() - started
        if elapsed > 30:
            _log_json("warn", "transcribe_slow", elapsed_sec=round(elapsed, 2))
        _log_json("info", "transcribe_ok", duration_ms=result.get("duration_ms"))
        return JSONResponse(content=result)
    except Exception as e:
        _log_json("error", "transcribe_failed", error_type=type(e).__name__)
        raise HTTPException(status_code=500, detail="Transcription failed") from e
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
