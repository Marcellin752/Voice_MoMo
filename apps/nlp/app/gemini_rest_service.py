"""
Gemini Voice Service using REST API (bypasses gRPC SSL issues)
"""

import os
import json
import base64
import requests
import urllib3
import time
from typing import Dict, Any
import logging
from app.config import settings
from app.models import ParseCommandResponse, Intent, ParseMetadata

# Disable SSL warnings
urllib3.disable_warnings()

logger = logging.getLogger(__name__)

# Create a session with SSL verification disabled
session = requests.Session()
session.verify = False

class GeminiRESTService:
    """
    Service vocal Gemini utilisant l'API REST (pas gRPC)
    Cela évite les problèmes de certificat SSL avec gRPC
    """
    
    def __init__(self):
        """Initialiser le service"""
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        
        self.api_key = settings.gemini_api_key
        # Use v1beta for standard Gemini API, v1 for Vertex AI
        api_version = os.getenv("GEMINI_API_VERSION", "v1beta")
        self.base_url = f"https://generativelanguage.googleapis.com/{api_version}/models/{settings.gemini_model}:generateContent"
        
        logger.info("✅ Gemini REST Service initialized (SSL bypass enabled)")
        
        self.system_prompt = """Tu es un assistant Mobile Money MTN MoMo pour l'Afrique de l'Ouest (Bénin, Nigeria, Ghana). Analyse la commande vocale en français et réponds UNIQUEMENT en JSON valide, sans texte autour.

INTENTS SUPPORTÉS:
- "balance": consulter le solde (mots: solde, combien j'ai, vérifier)
- "transfer": envoyer de l'argent à quelqu'un (mots: envoyer, transfert, virer, payer)
- "deposit": déposer de l'argent (mots: dépôt, déposer, mettre de l'argent)
- "withdraw": retirer de l'argent (mots: retirer, retrait, sortir de l'argent)
- "withdraw_gab": retrait au GAB/ATM UBA (mots: GAB, distributeur, UBA, ATM)
- "recharge": acheter crédit téléphonique (mots: recharger, crédit, airtime)
- "internet_day": forfait internet journalier (mots: internet jour, journée)
- "internet_week": forfait internet hebdomadaire (mots: internet semaine)
- "internet_month": forfait internet mensuel (mots: internet mois, mensuel)
- "internet_unlimited": forfait internet illimité (mots: illimité, unlimited)
- "gopack_day": Go Pack journalier (mots: go pack jour)
- "gopack_week": Go Pack hebdomadaire (mots: go pack semaine)
- "gopack_month": Go Pack mensuel (mots: go pack mois)
- "bill_payment": payer une facture (mots: facture, électricité, eau, CIE, SBEE, SONEB)
- "help": aide, liste des actions possibles
- "confirm": confirmation (mots: oui, confirme, d'accord, ok, vas-y)
- "cancel": annulation (mots: non, annule, arrête, pas maintenant)
- "unknown": commande incompréhensible ou hors sujet

RÈGLES:
- "amount": nombre entier uniquement, null si non mentionné.
- "recipient": nom ou numéro de téléphone, null si non mentionné.
- "needs_confirmation": true pour transfer, deposit, withdraw, withdraw_gab, recharge, bill_payment.
- "bill_type": "électricité", "eau", "CIE", "SBEE", etc. si applicable, sinon null.
- "confidence": entre 0.0 et 1.0 selon ta certitude.

FORMAT DE RÉPONSE (JSON uniquement, rien d'autre):
{
  "intent": "transfer",
  "amount": 5000,
  "recipient": "Jean",
  "bill_type": null,
  "needs_confirmation": true,
  "understood_text": "Envoie cinq mille francs à Jean",
  "message": "Voulez-vous envoyer 5000 FCFA à Jean ?",
  "confidence": 0.95
}"""

    def process_voice_command(
        self, 
        audio_bytes: bytes,
        audio_format: str = "wav"
    ) -> Dict[str, Any]:
        """
        Traiter une commande vocale via API REST
        
        Args:
            audio_bytes: Données audio brutes
            audio_format: Format audio (wav, webm, etc.)
        
        Returns:
            {
                "nlp_result": ParseCommandResponse,
                "audio_response": None,
                "success": bool,
                "error": str | None
            }
        """
        
        try:
            logger.info(f"📥 Audio reçu: {len(audio_bytes)} bytes, format={audio_format}")
            
            # Encoder l'audio en base64
            audio_base64 = base64.standard_b64encode(audio_bytes).decode('utf-8')
            
            # Map format to MIME type
            mime_type_map = {
                'wav': 'audio/wav',
                'webm': 'audio/webm',
                'ogg': 'audio/ogg',
                'opus': 'audio/opus',
                'mp3': 'audio/mpeg',
                'aac': 'audio/aac',
            }
            mime_type = mime_type_map.get(audio_format.lower(), 'audio/wav')
            
            # Préparer la requête — system_instruction pour que Gemini respecte le format
            payload = {
                "system_instruction": {
                    "parts": [{"text": self.system_prompt}]
                },
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": mime_type,
                                    "data": audio_base64
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.0,
                    "maxOutputTokens": 500,
                    "responseMimeType": "application/json",
                }
            }
            
            logger.info("🔌 Sending REST request to Gemini API...")
            
            # Retry logic with exponential backoff for 429 errors
            max_retries = 3
            base_delay = 2  # seconds
            
            for attempt in range(max_retries):
                try:
                    response = session.post(
                        f"{self.base_url}?key={self.api_key}",
                        json=payload,
                        timeout=120,
                        verify=False
                    )
                    
                    logger.info(f"📡 Response status: {response.status_code} (attempt {attempt + 1})")
                    
                    # Handle 429 rate limit with retry
                    if response.status_code == 429:
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt)  # Exponential backoff: 2, 4, 8 seconds
                            logger.warning(f"⚠️ Rate limit hit (429), retrying in {delay}s...")
                            time.sleep(delay)
                            continue
                        else:
                            logger.error("❌ Rate limit persist after all retries")
                            return self._create_fallback_response("Quota Gemini dépassé. Réessayez dans quelques secondes.")

                    # Handle 503 transient high-demand with retry (surge is temporary)
                    if response.status_code == 503:
                        if attempt < max_retries - 1:
                            delay = base_delay * (2 ** attempt)  # Exponential backoff: 2, 4, 8 seconds
                            logger.warning(f"⚠️ High demand (503), retrying in {delay}s...")
                            time.sleep(delay)
                            continue
                        else:
                            logger.error("❌ High demand persists after all retries")
                            return self._create_fallback_response("Gemini est surchargé. Réessayez dans quelques secondes.")

                    # Handle other errors
                    if response.status_code != 200:
                        error_text = response.text[:200]
                        logger.error(f"❌ API Error {response.status_code}: {error_text}")
                        return self._create_fallback_response(f"API Error {response.status_code}")
                    
                    # Success - break out of retry loop
                    break
                    
                except requests.exceptions.RequestException as e:
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)
                        logger.warning(f"⚠️ Request failed, retrying in {delay}s: {e}")
                        time.sleep(delay)
                    else:
                        raise
            
            # Parser la réponse
            data = response.json()
            
            # Extraire le texte
            try:
                text_content = data['candidates'][0]['content']['parts'][0]['text']
                logger.info(f"✅ Got response text: {text_content[:100]}...")
                
                # Parser comme JSON
                nlp_result = self._parse_nlp_response(text_content)
                
                return {
                    "nlp_result": nlp_result,
                    "audio_response": None,
                    "success": True,
                    "error": None
                }
                
            except (KeyError, IndexError, TypeError) as e:
                logger.error(f"❌ Failed to parse response: {e}")
                logger.error(f"   Response: {json.dumps(data, indent=2)[:500]}")
                return self._create_fallback_response(f"Parse error: {str(e)}")
            
        except requests.exceptions.Timeout:
            logger.warning("⚠️ REST API timeout")
            return self._create_fallback_response("REST API Timeout")
        except Exception as e:
            logger.error(f"❌ Error: {type(e).__name__}: {e}")
            return self._create_fallback_response(str(e))
    
    def _parse_nlp_response(self, text: str) -> ParseCommandResponse:
        """Parser la réponse JSON de Gemini"""
        try:
            # Essayer d'extraire JSON
            if '{' in text and '}' in text:
                json_str = text[text.find('{'):text.rfind('}')+1]
                data = json.loads(json_str)
                logger.info(f"✅ Parsed JSON: intent={data.get('intent')}")
            else:
                logger.warning("⚠️ No JSON in response, treating as text")
                data = {"intent": "unknown", "message": text}
            
            # Extraire l'intent
            intent_str = data.get("intent", "unknown").lower()
            
            # Normalisation robuste : traduction des intentions françaises de l'IA vers notre Enum
            intent_mapping = {
                "transfert": "transfer",
                "virement": "transfer",
                "envoi": "transfer",
                "solde": "balance",
                "retrait": "withdraw",
                "dépôt": "deposit",
                "depot": "deposit",
                "rechargement": "recharge",
                "facture": "bill_payment",
                "paiement": "bill_payment",
                "aide": "help",
                "annuler": "cancel",
                "annulation": "cancel",
                "confirmer": "confirm"
            }
            
            if intent_str in intent_mapping:
                intent_str = intent_mapping[intent_str]
                
            try:
                intent = Intent[intent_str.upper()]
            except KeyError:
                intent = Intent.UNKNOWN
            
            # Créer la réponse
            return ParseCommandResponse(
                intent=intent,
                amount=data.get("amount"),
                recipient=data.get("recipient"),
                bill_type=data.get("bill_type"),
                needs_confirmation=data.get("needs_confirmation", False),
                confirmation_message=data.get("confirmation_message"),
                understood_text=data.get("understood_text", "[Audio]"),
                metadata=ParseMetadata(
                    provider="gemini-rest",
                    model=settings.gemini_model,
                    confidence=data.get("confidence", 0.8),
                    raw_output=text[:200]
                )
            )
        
        except Exception as e:
            logger.error(f"❌ Parse error: {e}")
            return ParseCommandResponse(
                intent=Intent.UNKNOWN,
                amount=None,
                recipient=None,
                bill_type=None,
                needs_confirmation=False,
                confirmation_message=None,
                understood_text="[Parse Error]",
                metadata=ParseMetadata(
                    provider="gemini-rest-fallback",
                    model=settings.gemini_model,
                    confidence=0.0,
                    raw_output=f"Error: {str(e)}"
                )
            )
    
    def _create_fallback_response(self, error_msg: str) -> Dict[str, Any]:
        """Créer une réponse d'erreur — success=False pour déclencher le bon chemin dans main.py"""
        logger.warning(f"⚠️ Fallback response: {error_msg}")
        return {
            "nlp_result": None,
            "audio_response": None,
            "success": False,
            "error": error_msg
        }


# Singleton instance
_service = None

def get_voice_service():
    """Obtenir l'instance du service vocal"""
    global _service
    if _service is None:
        _service = GeminiRESTService()
    return _service
