#!/bin/bash

# Script pour lancer l'agent Mobile Money LiveKit
# Utilise Grok pour NLP, Deepgram pour STT, ElevenLabs pour TTS

set -e  # Exit on error

echo "🚀 Démarrage de l'Agent Mobile Money LiveKit..."
echo ""

# Vérifier que les variables d'environnement essentielles sont définies
if [ -z "$XAI_API_KEY" ]; then
    echo "❌ ERREUR : XAI_API_KEY manquante"
    echo "   Ajoute à ton .env : XAI_API_KEY=ta_clé_grok"
    exit 1
fi

if [ -z "$LIVEKIT_URL" ]; then
    echo "❌ ERREUR : LIVEKIT_URL manquante"
    echo "   Ajoute à ton .env : LIVEKIT_URL=wss://your-livekit-server"
    exit 1
fi

if [ -z "$DEEPGRAM_API_KEY" ]; then
    echo "⚠️  AVERTISSEMENT : DEEPGRAM_API_KEY manquante"
    echo "    (Optionnel : utilise un service par défaut)"
fi

if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo "⚠️  AVERTISSEMENT : ELEVENLABS_API_KEY manquante"
    echo "    (Optionnel : utilise un service par défaut)"
fi

echo ""
echo "📡 Configuration :"
echo "   LiveKit URL: $LIVEKIT_URL"
echo "   Grok Model: ${XAI_MODEL:-grok-2-latest}"
echo ""

# Activer venv si présent
if [ -f "./venv/bin/activate" ]; then
    source ./venv/bin/activate
    echo "✅ Virtual env activated"
fi

echo ""
echo "🎙️  Lancement de l'agent..."
echo ""

# Lancer l'agent avec python livekit
python -m livekit.agents dev app.mobile_money_agent

echo ""
echo "✅ Agent Mobile Money démarré!"
echo ""
echo "Pour tester :"
echo "  1. Ouvre http://localhost:8081 dans le navigateur"
echo "  2. Connecte-toi à la room 'voice-momo'"
echo "  3. Active le micro et parle à l'agent"
echo ""
