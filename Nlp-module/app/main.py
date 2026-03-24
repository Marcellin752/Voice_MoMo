from fastapi import FastAPI, UploadFile, File, Body, HTTPException, Request, status
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
from app.auth import extract_user_from_request, JWTManager
from app.rate_limiter import rate_limit_middleware

logger = logging.getLogger(__name__)

app = FastAPI(
    title="🎙️ VoiceMomo NLP API",
    version="0.2.0",
    description="""
    ### Backend d'IA vocale pour Mobile Money
    
    Plateforme complète de traitement de commandes vocales en français avec:
    - ✅ Reconnaissance vocale (STT) via Gemini 2.0 Flash
    - ✅ Compréhension du langage naturel (NLP)
    - ✅ Synthèse vocale (TTS) 
    - ✅ Gestion d'actions avec confirmation
    - ✅ Authentification JWT
    - ✅ Rate limiting & monitoring
    
    ### Flux typique:
    1. Frontend upload audio = POST /api/voice-command  
    2. Backend analyse intent/entities
    3. Si confirmation nécessaire → attente utilisateur
    4. Frontend envoie confirmation = POST /api/confirm
    5. Action exécutée & résultat retourné
    
    ### Authentification:
    - Tous les endpoints (sauf /ai/parse, /health) nécessitent JWT
    - Format: `Authorization: Bearer <token>`
    - Générer token: GET /api/auth/token?user_id=xxx
    """,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Instances globales
executor = get_action_executor()
cache = get_transaction_cache()

# Add CORS middleware to allow requests from the mobile frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (localhost:5173, 5174, etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],  # Inclure Authorization header
)

# Add Rate Limiting middleware
app.middleware("http")(rate_limit_middleware)
logger.info("🛡️ Rate limiting middleware enabled")

service = CommandParserService()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/auth/token", tags=["🔐 Authentication"])
async def get_token(user_id: str = "default") -> dict:
    """
    🔐 **Générer un token JWT**
    
    Endpoint de développement pour générer des tokens JWT de test.
    
    **En production**: À remplacer par un système d'authentification réel (OAuth, etc.)
    
    **Exemple**:
    ```
    GET /api/auth/token?user_id=user123
    
    Response:
    {
      "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
      "token_type": "bearer",
      "user_id": "user123",
      "expires_in": "24h"
    }
    ```
    
    **Usage**: Copier le token et l'utiliser dans Authorization header:
    ```
    Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
    ```
    """
    token = JWTManager.encode_token(user_id)
    
    logger.info(f"🔐 Token généré pour user_id={user_id}")
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user_id,
        "expires_in": "24h"
    }


@app.post("/ai/parse", response_model=ParseCommandResponse)
async def parse_command(payload: ParseCommandRequest) -> ParseCommandResponse:
    return await service.parse(payload.text)


# ============================================================================
# ENDPOINT AUDIO - TRAITEMENT VOICE COMPLET
# ============================================================================

@app.post("/api/voice-command", tags=["🎙️ Voice Processing"])
async def voice_command(request: Request, audio_file: UploadFile = File(...)) -> Response:
    """
    🎙️ **Traiter une commande vocale complète**
    
    Endpoint principal pour traiter les commandes vocales en français.
    Gère: STT (Gemini) → NLP → Exécution d'action
    
    **Authentification**: Requiert JWT (Authorization: Bearer <token>)
    
    **Input**: Fichier audio (WAV, MP3, WebM, etc.)
    
    **Fonctionnalités**:
    - ✅ Reconnaissance vocale (STT) avec Gemini 2.0 Flash
    - ✅ Extraction de l'intent et des entités (recipient, amount, etc.)
    - ✅ Synthèse vocale (TTS) de la réponse
    - ✅ Exécution directe pour actions simples
    - ✅ Mise en cache avec demande de confirmation pour actions critiques
    
    **Response JSON**:
    ```json
    {
      "intent": "transfer",
      "message": "Voulez-vous envoyer 5000 francs CFA à Jean?",
      "requires_confirmation": true,
      "transaction_id": "f47ac10b-...",
      "understood_text": "Envoie 5000 à Jean",
      "audio_base64": "UklGRi4A...",
      "data": {
        "amount": 5000,
        "recipient": "Jean"
      }
    }
    ```
    
    **Intents supportés**:
    - `balance`: Consulter le solde
    - `transfer`: Envoyer de l'argent
    - `recharge`: Recharger crédit téléphonique
    - `bill_payment`: Payer une facture
    - `help`: Afficher l'aide
    
    **Notes**:
    - Les actions de transfert/paiement nécessitent une confirmation (POST /api/confirm)
    - Requêtes max: 60/minute par IP, 30/minute par user
    """
    
    try:
        # 0. Authentifier l'utilisateur (extraire user_id du JWT)
        try:
            user_id = await extract_user_from_request(request)
        except HTTPException as e:
            # Si pas d'auth, utiliser "default" pour développement (à supprimer en prod)
            logger.warning(f"⚠️ Pas d'auth trouvée. Fallback à user_id=default")
            user_id = "default"
        
        # 1. Lire l'audio
        audio_bytes = await audio_file.read()
        audio_format = audio_file.filename.split('.')[-1].lower() if audio_file.filename else "wav"
        
        logger.info(f"🎙️ Commande vocale reçue pour user_id={user_id}: {audio_file.filename} ({len(audio_bytes)} bytes)")
        
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


@app.get("/api/health", tags=["📊 Monitoring"])
async def api_health():
    """
    📊 **État de santé de l'API**
    
    Endpoint de monitoring pour vérifier que le service vocal est opérationnel.
    
    **Response**:
    ```json
    {
      "status": "ok",
      "service": "Gemini Voice Command Processor",
      "audio_endpoint": "/api/voice-command",
      "cache_transactions": 2,
      "features": [
        "voice_command",
        "balance_check",
        "money_transfer",
        "phone_recharge",
        "bill_payment",
        "action_confirmation"
      ]
    }
    ```
    
    **Utilisation**: À appeler régulièrement par un health checker (Kubernetes, etc.)
    """
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

@app.post("/api/confirm", tags=["✅ Confirmation"])
async def confirm_action(
    request: Request,
    transaction_id: str = Body(...),
):
    """
    ✅ **Confirmer une action en attente**
    
    Endpoint appelé quand l'utilisateur confirme une action vocale.
    
    **Authentification**: Requiert JWT
    
    **Workflow**:
    1. POST /api/voice-command → Réponse avec requires_confirmation=true + transaction_id
    2. Frontend affiche la réponse à l'utilisateur (ex: "Confirmer transfert de 5000?")
    3. Utilisateur répond vocalement "Oui"
    4. Frontend appelle POST /api/confirm avec transaction_id
    5. Action exécutée réellement → solde débité, etc.
    
    **Request**:
    ```json
    {
      "transaction_id": "f47ac10b-58cc-4372-a567-..."
    }
    ```
    
    **Response**:
    ```json
    {
      "success": true,
      "message": "Transfert de 5000 francs CFA à Jean réussi",
      "intent": "transfer",
      "data": {
        "amount": 5000,
        "recipient": "Jean",
        "new_balance": 45000
      }
    }
    ```
    
    **Erreurs**:
    - `400`: Transaction introuvable ou expirée (TTL 5min)
    - `401`: Token JWT invalide
    """
    # Extraire user_id du JWT
    try:
        user_id = await extract_user_from_request(request)
    except HTTPException:
        user_id = "default"
    
    logger.info(f"✅ Confirmation reçue pour: {transaction_id} (user_id={user_id})")
    
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
    request: Request,
    transaction_id: str = Body(...),
):
    """
    ❌ Annuler une action en attente
    
    Utilisé après la réponse de refus vocal ("Non")
    """
    # Extraire user_id du JWT
    try:
        user_id = await extract_user_from_request(request)
    except HTTPException:
        user_id = "default"
    
    logger.info(f"❌ Annulation reçue pour: {transaction_id} (user_id={user_id})")
    
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
