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
        
        self.system_prompt = """Tu es un assistant Mobile Money MTN MoMo Bénin. Tu analyses des commandes vocales en français.

RÈGLES STRICTES:
1. Tu dois TOUJOURS répondre en JSON valide, sans texte avant ni après.
2. Tu dois identifier l'intent EXACT parmi cette liste FERMÉE:
   - "balance" : consulter le solde (mots-clés: solde, combien, reste, avoir, montant disponible)
   - "transfer" : envoyer de l'argent à quelqu'un (mots-clés: envoyer, envoie, transférer, transfert, virer)
   - "deposit" : déposer de l'argent sur le compte de quelqu'un / faire un dépôt (mots-clés: dépôt, déposer, dépose, mettre de l'argent, recharger le compte de)
   - "withdraw" : retirer de l'argent de son compte (mots-clés: retirer, retrait, décaisser, sortir l'argent)
   - "recharge" : recharger du crédit téléphonique (mots-clés: recharge, crédit, forfait, pass, airtime)
   - "bill_payment" : payer une facture (mots-clés: facture, eau, électricité, internet, SBEE, SONEB)
   - "help" : demander de l'aide (mots-clés: aide, comment, help, quoi faire)
   - "confirm" : confirmer une action (mots-clés: oui, confirmer, ok, d'accord, je confirme)
   - "cancel" : annuler une action (mots-clés: non, annuler, j'annule, stop, arrête)
   - "unknown" : si rien ne correspond

3. Pour amount: extraire le nombre entier (ex: "deux mille" → 2000, "5000 francs" → 5000). Pas de décimales.
4. Pour recipient: extraire le NOM ou le NUMÉRO du destinataire tel quel (ex: "Aurel", "Jean", "97123456").
   - NE PAS inventer de numéro si seul un nom est donné.
   - Un nom propre (Aurel, Marie, Paul, Maman, Papa) est un recipient valide.
5. needs_confirmation: TOUJOURS true pour transfer, deposit, withdraw, recharge, bill_payment.

FORMAT DE SORTIE (JSON strict):
{
  "intent": "balance|transfer|deposit|withdraw|recharge|bill_payment|help|confirm|cancel|unknown",
  "amount": null ou nombre_entier,
  "recipient": null ou "nom_ou_numero",
  "bill_type": null ou "type_facture",
  "needs_confirmation": true ou false,
  "understood_text": "transcription exacte de ce que l'utilisateur a dit",
  "message": "ta réponse naturelle en français",
  "confidence": 0.0 à 1.0
}

EXEMPLES:
- Audio: "Fait un dépôt de 2000 à Aurel"
  → {"intent":"deposit","amount":2000,"recipient":"Aurel","bill_type":null,"needs_confirmation":true,"understood_text":"Fait un dépôt de 2000 à Aurel","message":"Voulez-vous déposer 2000 francs CFA sur le compte de Aurel ?","confidence":0.95}

- Audio: "Envoie 5000 francs à Jean"
  → {"intent":"transfer","amount":5000,"recipient":"Jean","bill_type":null,"needs_confirmation":true,"understood_text":"Envoie 5000 francs à Jean","message":"Voulez-vous envoyer 5000 francs CFA à Jean ?","confidence":0.95}

- Audio: "Dépôt de 10000 sur le numéro de maman"
  → {"intent":"deposit","amount":10000,"recipient":"maman","bill_type":null,"needs_confirmation":true,"understood_text":"Dépôt de 10000 sur le numéro de maman","message":"Voulez-vous faire un dépôt de 10000 francs CFA pour maman ?","confidence":0.95}

- Audio: "Quel est mon solde"
  → {"intent":"balance","amount":null,"recipient":null,"bill_type":null,"needs_confirmation":false,"understood_text":"Quel est mon solde","message":"Je consulte votre solde...","confidence":0.95}

- Audio: "Recharge 1000"
  → {"intent":"recharge","amount":1000,"recipient":null,"bill_type":null,"needs_confirmation":true,"understood_text":"Recharge 1000","message":"Voulez-vous recharger 1000 francs CFA de crédit ?","confidence":0.9}

- Audio: "Transfert de 10000 au 97123456"
  → {"intent":"transfer","amount":10000,"recipient":"97123456","bill_type":null,"needs_confirmation":true,"understood_text":"Transfert de 10000 au 97123456","message":"Voulez-vous transférer 10000 francs CFA au 97 12 34 56 ?","confidence":0.95}

- Audio: "Je veux retirer 15000 francs"
  → {"intent":"withdraw","amount":15000,"recipient":null,"bill_type":null,"needs_confirmation":true,"understood_text":"Je veux retirer 15000 francs","message":"Voulez-vous retirer 15000 francs CFA ?","confidence":0.9}

IMPORTANT:
- "dépôt" / "déposer" / "dépose" / "mettre" = intent "deposit" (PAS "transfer")
- "envoyer" / "transférer" / "virer" = intent "transfer" (PAS "deposit")
- Un numéro de téléphone (8+ chiffres) n'est JAMAIS un montant
- Le montant est toujours la somme d'argent en francs CFA
- Le recipient peut être un NOM DE PERSONNE (Aurel, Jean, Marie) ou un NUMÉRO DE TÉLÉPHONE
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
