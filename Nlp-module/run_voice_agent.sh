#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PY="/home/mericstudent/softride/.venv/bin/python"

if [[ -n "${VOICE_AGENT_PYTHON:-}" ]]; then
  PY_BIN="$VOICE_AGENT_PYTHON"
else
  PY_BIN="$DEFAULT_PY"
fi

if [[ ! -x "$PY_BIN" ]]; then
  echo "Python executable not found: $PY_BIN"
  echo "Set VOICE_AGENT_PYTHON to a Python interpreter that has livekit.plugins.xai installed."
  exit 1
fi

cd "$ROOT_DIR"
"$PY_BIN" -m app.voice_agent start
