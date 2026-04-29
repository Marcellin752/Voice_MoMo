"""
Gemini Voice Service using REST API (bypasses gRPC SSL issues)
"""

import os
import json
import base64
import requests
import ssl
import urllib3
import time
from typing import Dict, Any, Optional
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
        
        self.system_prompt = """Tu es un assistant Mobile Money intelligent en français.

Ton rôle :
1. Écouter la commande vocale de l'utilisateur
2. Analyser l'intention et extraire les informations
3. Répondre de manière claire et naturelle en français

Intents possibles:
- balance: Consulter le solde
- transfer: Envoyer de l'argent
- withdraw: Retirer de l'argent de son compte (ex: "retrait", "retirer", "décaisser")
- recharge: Recharger crédit
- bill_payment: Payer une facture
- help: Demander de l'aide
- confirm: Confirmer une action (ex: "oui", "je confirme", "ok")
- cancel: Annuler une action (ex: "non", "annuler", "j'annule")

Réponds toujours en JSON:
{
  "intent": "balance|transfer|withdraw|recharge|bill_payment|help|confirm|cancel|unknown",
  "amount": null or number,
  "recipient": null or string,
  "understood_text": "Ce que vous avez dit",
  "message": "Votre réponse naturelle"
}

Règles critiques d'extraction:
- Si un montant et un numéro sont présents, le montant est la somme en FCFA, le numéro est le destinataire.
- Un numéro de téléphone (8 à 15 chiffres) ne doit jamais être interprété comme un montant.
- L'ordre peut changer dans la phrase; utilise les indices de contexte (FCFA, francs, à, au, numéro, vers) pour attribuer correctement amount vs recipient.
"""
    
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
            
            # Préparer la requête
            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [
                            {"text": self.system_prompt},
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
                    "temperature": 0.1,
                    "maxOutputTokens": 500,
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
        """Créer une réponse fallback"""
        logger.warning(f"⚠️ Fallback response: {error_msg}")
        
        fallback = ParseCommandResponse(
            intent=Intent.BALANCE,
            amount=None,
            recipient=None,
            bill_type=None,
            needs_confirmation=False,
            confirmation_message=None,
            understood_text="Commande received",
            metadata=ParseMetadata(
                provider="gemini-rest-fallback",
                model="fallback",
                confidence=0.5,
                raw_output=f"Fallback: {error_msg}"
            )
        )
        
        return {
            "nlp_result": fallback,
            "audio_response": None,
            "success": True,
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
