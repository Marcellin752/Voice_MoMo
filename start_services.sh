#!/bin/bash

# Kill any existing processes
pkill -f "uvicorn\|npm run dev" 2>/dev/null

echo "🚀 Starting Voice MoMo Services..."
echo ""

# Start NLP Service
echo "📡 Starting NLP Service on port 8001..."
cd /home/satignon/Tek2/VoiceMomo/Voice_MoMo/Nlp-module
source venv/bin/activate
uvicorn app.main:app --reload --port 8001 > /tmp/nlp_service.log 2>&1 &
NLP_PID=$!
echo "✅ NLP Service PID: $NLP_PID"

sleep 3

# Start Mobile App
echo "📱 Starting Mobile App on port 5173..."
cd /home/satignon/Tek2/VoiceMomo/Voice_MoMo/Mobile
npm run dev > /tmp/mobile_app.log 2>&1 &
MOBILE_PID=$!
echo "✅ Mobile App PID: $MOBILE_PID"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Voice MoMo Services Ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Open in browser: http://localhost:5173"
echo ""
echo "📡 NLP Service: http://localhost:8001 (with CORS enabled)"
echo ""
echo "📝 Logs:"
echo "   NLP: tail -f /tmp/nlp_service.log"
echo "   Mobile: tail -f /tmp/mobile_app.log"
echo ""
echo "To stop: press Ctrl+C or run 'pkill -f \"uvicorn|npm run dev\"'"
echo ""

wait
