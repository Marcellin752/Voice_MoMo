#!/bin/bash
# Lance le service NLP en local (Voice MoMo monorepo)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT/apps/nlp"

if [ -d "venv" ]; then
  source venv/bin/activate
elif [ -d ".venv" ]; then
  source .venv/bin/activate
else
  echo "⚠️  Aucun venv trouvé dans apps/nlp — créez-en un : python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

if [ -f .env ]; then
  CERT_PATH=$(python -c "import certifi; print(certifi.where())" 2>/dev/null || true)
  if [ -n "${CERT_PATH:-}" ]; then
    export REQUESTS_CA_BUNDLE="$CERT_PATH"
    export CURL_CA_BUNDLE="$CERT_PATH"
    export SSL_CERT_FILE="$CERT_PATH"
  fi
fi

echo "🚀 Démarrage NLP sur http://0.0.0.0:8000"
exec python run_server.py
