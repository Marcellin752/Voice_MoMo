from fastapi import FastAPI, UploadFile, File, Body, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import logging
import json
from typing import Optional

from app.models import ParseCommandRequest, ParseCommandResponse
from app.service import CommandParserService
from app.gemini_voice_service import get_voice_service
from app.action_executor import get_action_executor
from app.transaction_cache import get_transaction_cache

logger = logging.getLogger(__name__)

app = FastAPI(title="Voice MoMo NLP Service", version="0.1.0")

# Instances globales
executor = get_action_executor()
cache = get_transaction_cache()

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
        
        # 3. Exécuter l'action selon l'intent
        user_id = "default"  # En production, obtenir du contexte utilisateur
        
        action_result = executor.execute(
            user_id=user_id,
            intent=nlp_result.intent,
            amount=nlp_result.amount,
            recipient=nlp_result.recipient,
            service_type=nlp_result.bill_type,
            needs_confirmation=nlp_result.needs_confirmation
        )
        
        logger.info(f"🎯 Exécution action: success={action_result.success}, message={action_result.message}")
        
        # 4. Construire la réponse
        response_data = nlp_result.model_dump()
        response_data.update(action_result.to_dict())
        
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
    cache.cleanup_expired()
    
    return {
        "status": "ok",
        "service": "Gemini Voice Command Processor",
        "audio_endpoint": "/api/voice-command",
        "cache_transactions": cache.size(),
        "features": [
            "voice_command",
            "balance_check",
            "money_transfer",
            "phone_recharge",
            "bill_payment",
            "action_confirmation"
        ]
    }


# ============================================================================
# ENDPOINTS DE CONFIRMATION/ANNULATION D'ACTIONS
# ============================================================================

@app.post("/api/confirm")
async def confirm_action(
    transaction_id: str = Body(...),
    user_id: str = Body(..., default="default")
):
    """
    ✅ Confirmer une action en attente
    
    Utilisé après la réponse de confirmation vocale ("Oui")
    """
    logger.info(f"✅ Confirmation reçue pour: {transaction_id}")
    
    result = executor.confirm_action(transaction_id, user_id)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": result.success,
        "message": result.message,
        "intent": result.intent,
        "data": result.data
    }


@app.post("/api/cancel")
async def cancel_action(
    transaction_id: str = Body(...),
    user_id: str = Body(..., default="default")
):
    """
    ❌ Annuler une action en attente
    
    Utilisé après la réponse de refus vocal ("Non")
    """
    logger.info(f"❌ Annulation reçue pour: {transaction_id}")
    
    result = executor.cancel_action(transaction_id, user_id)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": result.success,
        "message": result.message,
        "intent": result.intent
    }


@app.get("/api/pending-transactions")
async def get_pending_transactions(user_id: str = "default"):
    """
    📋 Lister les transactions en attente
    
    DEBUG ONLY - À utiliser pour le monitoring
    """
    tx = cache.get_by_user(user_id)
    
    if not tx:
        return {"user_id": user_id, "pending": None}
    
    return {
        "user_id": user_id,
        "pending": tx.to_dict()
    }
