"""Coqui TTS singleton for French VITS (fallback XTTS)."""

from __future__ import annotations

import io
import json
import os
import re
import tempfile
import time
import wave
from typing import Any

_tts: Any = None
_model_name: str | None = None

PRIMARY_MODEL = "tts_models/fr/css10/vits"
FALLBACK_MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"


def _log_json(level: str, message: str, **extra: object) -> None:
    payload = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "service": "tts",
        "level": level,
        "message": message,
        **extra,
    }
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def preprocess_text(text: str) -> str:
    s = text.replace("FCFA", "francs CFA").replace("MoMo", "Mobile Money")
    s = re.sub(
        r"\b(\d{4,})\b",
        lambda m: "{:,}".format(int(m.group(1))).replace(",", " "),
        s,
    )
    return s


def torch_gpu() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def get_tts() -> tuple[Any, str]:
    global _tts, _model_name
    if _tts is not None:
        return _tts, _model_name or PRIMARY_MODEL

    from TTS.api import TTS as CoquiTTS

    override = os.environ.get("COQUI_MODEL", "").strip()
    order = [override] if override else [PRIMARY_MODEL, FALLBACK_MODEL]
    last_err: Exception | None = None
    for name in order:
        if not name:
            continue
        try:
            _log_json("info", "loading_tts", model=name)
            _tts = CoquiTTS(model_name=name, progress_bar=False, gpu=torch_gpu())
            _model_name = name
            return _tts, name
        except Exception as e:
            last_err = e
            _log_json("warn", "tts_model_failed", model=name, error=type(e).__name__)
    raise RuntimeError(str(last_err) if last_err else "TTS init failed")


def synthesize_to_wav_bytes(text: str) -> bytes:
    tts, model_name = get_tts()
    clean = preprocess_text(text)
    if not clean.strip():
        clean = "Désolé, je n'ai rien à dire."

    import numpy as np

    if "xtts" in model_name.lower():
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        try:
            tts.tts_to_file(text=clean, file_path=path, language="fr")
            with open(path, "rb") as f:
                return f.read()
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    wav = tts.tts(clean)
    arr = np.asarray(wav, dtype=np.float32).flatten()
    int16 = np.clip(arr * 32767, -32768, 32767).astype(np.int16)
    sr = int(getattr(getattr(tts, "synthesizer", None), "output_sample_rate", None) or 22050)
    bio = io.BytesIO()
    with wave.open(bio, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int16.tobytes())
    return bio.getvalue()
