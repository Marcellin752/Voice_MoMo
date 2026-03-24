from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import logging
import json

from app.models import ParseCommandRequest, ParseCommandResponse
from app.service import CommandParserService
from app.gemini_voice_service import get_voice_service

logger = logging.getLogger(__name__)

app = FastAPI(title="Voice MoMo NLP Service", version="0.1.0")

# Add CORS middleware to allow requests from the mobile frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (localhost:5173, 5174, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = CommandParserService()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ai/parse", response_model=ParseCommandResponse)
async def parse_command(payload: ParseCommandRequest) -> ParseCommandResponse:
    return await service.parse(payload.text)


# ============================================================================
# ENDPOINT AUDIO - TRAITEMENT VOICE COMPLET
# ============================================================================

@app.post("/api/voice-command")
async def voice_command(audio_file: UploadFile = File(...)) -> Response:
    """
    🎙️ Endpoint principal pour commandes vocales
    
    Input: Fichier audio (WAV, MP3, etc.)
    Output: JSON ParseCommandResponse + Audio de réponse (optionnel)
    
    Actions déclenchées:
    - Audio → Transcription
    - NLP Analysis (intent, entities)
    - Réponse vocale via TTS
    """
    
    try:
        # 1. Lire l'audio
        audio_bytes = await audio_file.read()
        audio_format = audio_file.filename.split('.')[-1].lower() if audio_file.filename else "wav"
        
        logger.info(f"🎙️ Commande vocale reçue: {audio_file.filename} ({len(audio_bytes)} bytes)")
        
        # 2. Traiter avec Gemini Voice Service (TOUT EN UN !)
        voice_service = get_voice_service()
        result = voice_service.process_voice_command(
            audio_bytes=audio_bytes,
            audio_format=audio_format
        )
        
        if not result["success"]:
            logger.error(f"❌ Erreur traitement vocal: {result['error']}")
            return Response(
                content=result["nlp_result"].model_dump_json(),
                status_code=500,
                media_type="application/json"
            )
        
        nlp_result: ParseCommandResponse = result["nlp_result"]
        
        logger.info(f"✅ Analyse complétée: intent={nlp_result.intent.value}, confidence={nlp_result.metadata.confidence}")
        
        # 3. Exécuter la transaction selon l'intent
        # (INTÉGRATION AVEC TON BACKEND EXISTANT ICI)
        
        if nlp_result.intent.value == "balance":
            logger.info("💰 Balance check requested")
            # Appeler ton service de consultation de solde
            # balance = get_user_balance(user_id)
            # nlp_result.confirmation_message = f"Votre solde: {balance} XOF"
        
        elif nlp_result.intent.value == "transfer":
            amount = nlp_result.amount
            recipient = nlp_result.recipient
            
            if nlp_result.needs_confirmation:
                logger.info(f"📝 Confirmation requise: {amount} XOF → {recipient}")
                # Mettre en cache la transaction en attente de confirmation
                # session.pending_transaction = {"type": "transfer", "amount": amount, "recipient": recipient}
            else:
                logger.info(f"✅ Transfert: {amount} XOF → {recipient}")
                # execute_transfer(user_id, amount, recipient)
        
        elif nlp_result.intent.value == "recharge":
            amount = nlp_result.amount
            logger.info(f"📱 Recharge: {amount} XOF")
            # execute_recharge(user_id, amount)
        
        elif nlp_result.intent.value == "bill_payment":
            amount = nlp_result.amount
            bill_type = nlp_result.bill_type
            logger.info(f"📄 Paiement: {amount} XOF pour {bill_type}")
            # execute_payment(user_id, amount, bill_type)
        
        # 4. Retourner le résultat NLP + audio optionnel
        response_data = nlp_result.model_dump()
        
        if result["audio_response"]:
            # Si on a l'audio, l'ajouter au JSON
            import base64
            response_data["audio_base64"] = base64.b64encode(result["audio_response"]).decode()
            logger.info(f"🔊 Audio de réponse inclus ({len(result['audio_response'])} bytes)")
        
        return Response(
            content=json.dumps(response_data, ensure_ascii=False),
            media_type="application/json"
        )
        
    except Exception as e:
        logger.error(f"❌ Exception dans /api/voice-command: {str(e)}")
        return Response(
            content=json.dumps({
                "error": str(e),
                "intent": "unknown"
            }),
            status_code=500,
            media_type="application/json"
        )


@app.get("/api/health")
async def api_health():
    """Vérifier que le service vocal est opérationnel"""
    return {
        "status": "ok",
        "service": "Gemini Voice Command Processor",
        "audio_endpoint": "/api/voice-command"
    }
