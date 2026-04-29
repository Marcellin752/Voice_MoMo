"""Singleton faster-whisper engine with RAM-based model selection."""

from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger("stt")

_engine: Any = None
_model_name: str | None = None


def _log_json(level: str, message: str, **extra: Any) -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "stt",
        "level": level,
        "message": message,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def _detect_ram_gb() -> float:
    try:
        import psutil

        return psutil.virtual_memory().total / (1024**3)
    except Exception:
        return 8.0


def _pick_model() -> str:
    override = os.environ.get("WHISPER_MODEL", "").strip()
    if override:
        return override
    ram = _detect_ram_gb()
    if ram >= 8:
        return "large-v3"
    if ram >= 4:
        return "medium"
    return "small"


def _detect_device() -> tuple[str, str]:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda", "int8_float16"
    except Exception:
        pass
    return "cpu", "int8"


def get_engine() -> tuple[Any, str]:
    global _engine, _model_name
    if _engine is not None:
        return _engine, _model_name or ""

    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        _log_json("error", "import_failed", module="faster_whisper", error=str(e))
        raise

    name = _pick_model()
    device, ctype = _detect_device()
    if device == "cpu":
        ctype = "int8"

    _log_json("info", "loading_whisper_model", model=name, device=device, compute_type=ctype)
    _engine = WhisperModel(name, device=device, compute_type=ctype)
    _model_name = name
    return _engine, name


def _to_wav_16k_mono(src: Path) -> Path:
    dst = Path(tempfile.mkstemp(suffix=".wav")[1])
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(dst),
    ]
    try:
        _log_json("info", "ffmpeg_start", src=str(src), size=src.stat().st_size)
        subprocess.run(cmd, check=True, capture_output=True, text=True)
        return dst
    except subprocess.CalledProcessError as e:
        _log_json("error", "ffmpeg_failed", stderr=e.stderr, stdout=e.stdout)
        raise


def transcribe(audio_path: str) -> dict[str, Any]:
    """Transcribe audio file; converts to 16 kHz mono WAV via ffmpeg when needed."""
    path = Path(audio_path)
    if not path.exists():
        raise FileNotFoundError(audio_path)

    wav_path: Path | None = None
    try:
        suffix = path.suffix.lower()
        if suffix not in {".wav"}:
            wav_path = _to_wav_16k_mono(path)
            work = wav_path
        else:
            work = path

        model, model_name = get_engine()
        started = time.time()
        segments, info = model.transcribe(
            str(work),
            language="fr",
            beam_size=5,
            vad_filter=True,
        )
        texts: list[str] = []
        for seg in segments:
            texts.append(seg.text)
        text = "".join(texts).strip()
        duration_ms = int((time.time() - started) * 1000)
        return {
            "text": text,
            "language": getattr(info, "language", "fr") or "fr",
            "duration_ms": duration_ms,
            "model": model_name,
        }
    finally:
        if wav_path and wav_path.exists():
            try:
                wav_path.unlink()
            except OSError:
                pass
