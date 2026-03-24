"""
Service vocal complet avec Gemini 2.0 Flash
Gère: Audio Input → NLP Analysis → Audio Output en UNE SEULE API
"""

import google.generativeai as genai
import base64
import json
from typing import Dict, Any, Optional
import logging
from app.config import settings
from app.models import ParseCommandResponse, Intent, ParseMetadata

# Configuration du logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class GeminiVoiceService:
    """
    Service vocal complet utilisant Gemini 2.0 Flash
    Traite l'audio et retourne l'analyse NLP + réponse vocale
    """
    
    def __init__(self):
        """Initialiser le service Gemini"""
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Prompt système optimisé pour Mobile Money
        self.system_prompt = """Tu es un assistant Mobile Money intelligent en français.

Ton rôle :
1. Écouter la commande vocale de l'utilisateur
2. Analyser l'intention et extraire les informations
3. Répondre de manière claire et naturelle en français

INTENTS supportés :
- "balance" : Consulter le solde
- "transfer" : Transférer de l'argent
- "recharge" : Acheter du crédit téléphonique
- "bill_payment" : Payer une facture
- "help" : Demander de l'aide

ENTITÉS à extraire :
- amount (int) : Montant en francs CFA
- recipient (str) : Nom ou numéro du destinataire
- bill_type (str) : Type de service (electricite, eau, internet)

RÈGLES :
- Convertis les montants en lettres en chiffres ("cinq mille" → 5000)
- Normalise les destinataires ("maman" → "Maman")
- Si une info manquante, demande clarification
- Réponds toujours en français naturel

FORMAT DE RÉPONSE (JSON STRICT) :
{
  "intent": "balance|transfer|recharge|bill_payment|help|unknown",
  "amount": <nombre_ou_null>,
  "recipient": "<nom_ou_null>",
  "bill_type": "<service_ou_null>",
  "needs_confirmation": <true_ou_false>,
  "response_message": "<message_en_français>",
  "confidence": <0.0_à_1.0>
}

Réponds UNIQUEMENT avec le JSON. Pas de texte avant ou après."""
    
    def process_voice_command(
        self, 
        audio_bytes: bytes,
        audio_format: str = "wav"
    ) -> Dict[str, Any]:
        """
        Traiter une commande vocale complète
        
        IMPORTANT: Gemini free tier ne supporte pas async pour l'audio,
        donc cette méthode est synchrone
        
        Args:
            audio_bytes: Données audio brutes
            audio_format: Format audio (wav, mp3, etc.)
        
        Returns:
            {
                "nlp_result": ParseCommandResponse,
                "audio_response": bytes | None,
                "success": bool,
                "error": str | None
            }
        """
        
        try:
            logger.info(f"📥 Audio reçu ({len(audio_bytes)} bytes, format: {audio_format})")
            
            # Préparer le contenu pour Gemini
            audio_part = {
                "mime_type": f"audio/{audio_format}",
                "data": audio_bytes
            }
            
            # Appel Gemini avec audio input + audio output
            logger.info("🧠 Envoi à Gemini 2.0 Flash (audio + voice response)...")
            
            try:
                # Essayer avec audio + text output (la vieille API n'a pas SpeechConfig)
                response = self.model.generate_content(
                    [
                        self.system_prompt,
                        audio_part
                    ],
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=500,
                    )
                )
                logger.info("✅ Réponse texte reçue de Gemini")
            except Exception as e:
                # Si l'audio échoue, fallback sur texte seul
                logger.warning(f"⚠️ Erreur audio Gemini, fallback sur texte: {e}")
                response = self.model.generate_content(
                    [
                        self.system_prompt,
                        audio_part
                    ],
                    generation_config=genai.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=500,
                    )
                )
            
            # Extraire le texte (JSON NLP)
            text_part = None
            audio_part_response = None
            
            if hasattr(response, 'candidates') and response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        text_part = part.text
                    elif hasattr(part, 'inline_data') and part.inline_data:
                        audio_part_response = part.inline_data.data
            
            if not text_part:
                raise ValueError("Pas de réponse texte de Gemini")
            
            # Parser le JSON
            logger.info(f"📝 Réponse reçue ({len(text_part)} chars)")
            nlp_result = self._parse_nlp_response(text_part)
            
            # Extraire l'audio si dispo
            audio_response = None
            if audio_part_response:
                try:
                    audio_response = base64.b64decode(audio_part_response)
                    logger.info(f"🔊 Audio de réponse généré ({len(audio_response)} bytes)")
                except Exception as e:
                    logger.warning(f"⚠️ Décodage audio échoué: {e}")
            
            return {
                "nlp_result": nlp_result,
                "audio_response": audio_response,
                "success": True,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement vocal: {str(e)}")
            
            # Créer une réponse fallback
            fallback_response = ParseCommandResponse(
                intent=Intent.UNKNOWN,
                amount=None,
                recipient=None,
                bill_type=None,
                needs_confirmation=False,
                confirmation_message=None,
                understood_text="[Erreur]",
                metadata=ParseMetadata(
                    provider="gemini-voice",
                    model="gemini-2.0-flash-exp",
                    confidence=0.0,
                    raw_output=f"Error: {str(e)}"
                )
            )
            
            return {
                "nlp_result": fallback_response,
                "audio_response": None,
                "success": False,
                "error": str(e)
            }
    
    def _parse_nlp_response(self, text: str) -> ParseCommandResponse:
        """
        Parser la réponse JSON de Gemini et retourner ParseCommandResponse
        """
        try:
            # Nettoyer le texte
            cleaned_text = text.strip()
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text.replace("```json", "").replace("```", "").strip()
            elif cleaned_text.startswith("```"):
                cleaned_text = cleaned_text.replace("```", "").strip()
            
            # Parser le JSON
            data = json.loads(cleaned_text)
            
            # Extraire et normaliser les champs
            intent_str = str(data.get("intent", "unknown")).lower().strip()
            if intent_str not in {item.value for item in Intent}:
                intent_str = "unknown"
            
            intent = Intent(intent_str)
            amount = self._normalize_amount(data.get("amount"))
            recipient = data.get("recipient")
            bill_type = data.get("bill_type")
            needs_confirmation = bool(data.get("needs_confirmation", False))
            response_message = data.get("response_message", "")
            confidence = float(data.get("confidence", 0.8))
            
            return ParseCommandResponse(
                intent=intent,
                amount=amount,
                recipient=recipient if recipient else None,
                bill_type=bill_type if bill_type else None,
                needs_confirmation=needs_confirmation,
                confirmation_message=response_message if needs_confirmation else None,
                understood_text=response_message,
                metadata=ParseMetadata(
                    provider="gemini-voice",
                    model="gemini-2.0-flash-exp",
                    confidence=confidence,
                    raw_output=cleaned_text
                )
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Erreur parsing JSON: {e}")
            logger.error(f"Texte reçu: {text[:500]}")
            
            # Fallback : créer une réponse par défaut
            return ParseCommandResponse(
                intent=Intent.UNKNOWN,
                amount=None,
                recipient=None,
                bill_type=None,
                needs_confirmation=False,
                confirmation_message=None,
                understood_text="Parsing error",
                metadata=ParseMetadata(
                    provider="gemini-voice",
                    model="gemini-2.0-flash-exp",
                    confidence=0.0,
                    raw_output=f"JSON Parse Error: {str(e)}"
                )
            )
    
    @staticmethod
    def _normalize_amount(value: Any) -> Optional[int]:
        """Normaliser un montant"""
        if value is None:
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None


# Instance globale du service
_voice_service: Optional[GeminiVoiceService] = None


def get_voice_service() -> GeminiVoiceService:
    """Obtenir l'instance du service (lazy loading)"""
    global _voice_service
    if _voice_service is None:
        _voice_service = GeminiVoiceService()
    return _voice_service
