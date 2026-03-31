#!/usr/bin/env bash
# One-shot setup for Ubuntu 22.04 / macOS — continues on non-fatal errors.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

log() { echo "[setup] $*"; }
warn() { echo "[setup] WARN: $*" >&2; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    warn "missing command: $1"
    return 1
  }
}

log "Checking Python 3.10+..."
if ! need_cmd python3; then
  warn "Install Python 3.10+"
else
  python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" || warn "Python 3.10+ recommended"
fi

log "Checking Node.js 18+..."
if need_cmd node; then
  node -e "const m=parseInt(process.versions.node); process.exit(m>=18?0:1)" || warn "Node 18+ recommended"
else
  warn "Install Node.js 18+"
fi

log "Checking Docker..."
need_cmd docker || warn "Docker not found — use venv installs below only"

log "Checking ffmpeg..."
need_cmd ffmpeg || warn "ffmpeg required for STT preprocessing"

if command -v nvidia-smi >/dev/null 2>&1; then
  log "NVIDIA GPU detected — faster-whisper can use CUDA if torch+GPU installed."
else
  log "No nvidia-smi — STT/TTS will use CPU (slower)."
fi

if need_cmd curl && ! command -v ollama >/dev/null 2>&1; then
  log "Ollama not in PATH — install from https://ollama.com or: curl -fsSL https://ollama.com/install.sh | sh"
fi

if command -v ollama >/dev/null 2>&1; then
  log "Pulling Ollama model (mistral)..."
  ollama pull mistral || warn "ollama pull failed — start ollama later and pull manually"
fi

for SVC in stt nlu tts; do
  log "Python venv: $SVC"
  if [[ -d "$ROOT/$SVC" ]]; then
    python3 -m venv "$ROOT/$SVC/.venv" 2>/dev/null || true
    if [[ -f "$ROOT/$SVC/.venv/bin/pip" ]]; then
      "$ROOT/$SVC/.venv/bin/pip" install -U pip >/dev/null 2>&1 || true
      "$ROOT/$SVC/.venv/bin/pip" install -r "$ROOT/$SVC/requirements.txt" || warn "pip install failed in $SVC"
    fi
  fi
done

log "npm install orchestrator..."
if [[ -f "$ROOT/orchestrator/package.json" ]]; then
  (cd "$ROOT/orchestrator" && npm install) || warn "npm install orchestrator failed"
fi

mkdir -p "$ROOT/data"
if [[ ! -f "$ROOT/data/contacts.json" ]]; then
  echo '{"maman":"0022961000001","papa":"0022961000002"}' >"$ROOT/data/contacts.json"
  log "Created data/contacts.json sample"
fi

log "Done."
log "Local (venvs): run each service in its folder with .venv/bin/uvicorn ..."
log "Docker: cd $ROOT && docker compose up --build"
log "After Ollama is up: ollama pull mistral"
log "Mobile: set VITE_VOICE_AI_URL=http://YOUR_LAN_IP:5004"
