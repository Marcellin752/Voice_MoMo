#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PY="/home/mericstudent/Voice_MoMo/.venv/bin/python"
PY_BIN="${LOCAL_AUDIO_PYTHON:-$DEFAULT_PY}"

cd "$ROOT_DIR"
if ! "$PY_BIN" - <<'PY'
import sounddevice  # noqa: F401
PY
then
	echo "Missing PortAudio runtime for sounddevice."
	echo "Install on Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y portaudio19-dev libportaudio2"
	exit 1
fi

"$PY_BIN" -m app.local_audio_client
