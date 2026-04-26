#!/bin/bash
# Start backend with proper SSL certificate configuration

cd /home/satignon/Tek2/VoiceMomo/Voice_MoMo

# Activate venv
source .venv/bin/activate

# Get certifi certificate path
CERT_PATH=$(python -c "import certifi; print(certifi.where())")
echo "🔐 Using certificates from: $CERT_PATH"

# Set SSL environment variables
export REQUESTS_CA_BUNDLE="$CERT_PATH"
export CURL_CA_BUNDLE="$CERT_PATH"
export SSL_CERT_FILE="$CERT_PATH"
export SSL_CERT_DIR="$(dirname $CERT_PATH)"
export GRPC_DEFAULT_SSL_ROOTS_FILE_PATH="$CERT_PATH"

# Disable hostname verification (⚠️ development only)
export GRPC_GO_LOG_VERBOSITY_LEVEL=0
export GRPC_GO_LOG_SEVERITY_LEVEL=FATAL

echo "🚀 Starting backend with SSL configuration..."
echo "   REQUESTS_CA_BUNDLE=$REQUESTS_CA_BUNDLE"
echo "   CURL_CA_BUNDLE=$CURL_CA_BUNDLE"
echo ""

cd Nlp-module
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
