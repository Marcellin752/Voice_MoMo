#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_PY="/home/mericstudent/softride/.venv/bin/python"
PY_BIN="${VOICE_AGENT_PYTHON:-$DEFAULT_PY}"

cd "$ROOT_DIR"
if [[ "${VOICE_AGENT_ALLOW_INSECURE_SSL:-1}" == "1" ]]; then
	export DISABLE_SSL_VERIFY="${DISABLE_SSL_VERIFY:-true}"
	if [[ "$DISABLE_SSL_VERIFY" == "true" ]]; then
		echo "[local-agent] DISABLE_SSL_VERIFY=true (local TLS workaround enabled)"
	fi
fi

"$PY_BIN" -m app.voice_agent_local
