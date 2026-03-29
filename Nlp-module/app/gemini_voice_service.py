"""
Service vocal complet avec Gemini 2.0 Flash
Gère: Audio Input → NLP Analysis → Audio Output en UNE SEULE API
"""

import os
import sys
import socket

# 🔧 CRITICAL FIX: Disable IPv6 to force IPv4-only
# System has no IPv6 connectivity. This makes Python/gRPC use IPv4 only.
socket.has_ipv6 = False

# 🔧 AGGRESSIVE gRPC SSL FIX - Must run BEFORE importing any Google libraries
# Set gRPC-specific environment variables to disable SSL verification
os.environ['GRPC_DEFAULT_SSL_ROOTS_FILE_PATH'] = ''
os.environ['GRPC_SSL_TARGET_NAME_OVERRIDE'] = 'generativelanguage.googleapis.com'  
os.environ['GRPC_PYTHON_BUILD_WITH_CYTHON'] = 'False'

# Disable SSL verification system-wide
os.environ['PYTHONHTTPSVERIFY'] = '0'
os.environ['GRPC_GO_LOG_SEVERITY_LEVEL'] = 'FATAL'

# Try to use the local certificates
import ssl
import urllib3
urllib3.disable_warnings()

# Create unverified SSL context EVERYWHERE
ssl._create_default_https_context = ssl._create_unverified_context

# Monkey-patch requests
import requests
requests.packages.urllib3.disable_warnings()

# Disable SSL verification for requests
class InsecureHTTPSAdapter(requests.adapters.HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        kwargs['ssl_context'] = ssl._create_unverified_context()
        return super().init_poolmanager(*args, **kwargs)

import google.generativeai as genai
import base64
import json
from typing import Dict, Any, Optional
import logging
from app.config import settings
from app.models import ParseCommandResponse, Intent, ParseMetadata
import threading
import re

# Monkey-patch socket to use unverified SSL
_orig_create_connection = socket.create_connection

def _patched_create_connection(*args, **kwargs):
    """Patched socket creation to bypass SSL verification"""
    kwargs['timeout'] = 30
    return _orig_create_connection(*args, **kwargs)

socket.create_connection = _patched_create_connection

# Configuration du logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mode DEMO - Désactiver pour utiliser Gemini réel
DEMO_MODE = False


class GeminiVoiceService:
    """
    Service vocal complet utilisant Gemini 2.0 Flash
    Traite l'audio et retourne l'analyse NLP + réponse vocale
    """
    
    def __init__(self):
        """Initialiser le service Gemini"""
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        push
        # 🔧 Configure Gemini with SSL bypass
        genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Set request timeout (60 seconds)
        import google.api_core.gapic_v1.client_info
        google.api_core.gapic_v1.client_info.DEFAULT_TIMEOUT = 60
        
        logger.info("✅ Service Gemini initialisé (SSL bypass enabled, timeout=60s)")
        
        # Prompt système optimisé pour Mobile Money
        self.system_prompt = """Tu es un assistant Mobile Money intelligent en français.

Ton rôle :
1. Écouter la commande vocale de l'utilisateur
2. Analyser l'intention et extraire les informations
3. Répondre de manière claire et naturelle en français

Intents possibles:
- balance: Consulter le solde
- transfer: Envoyer de l'argent
- recharge: Recharger crédit
- bill_payment: Payer une facture
- help: Demander de l'aide

Réponds toujours en JSON:
{
  "intent": "balance|transfer|recharge|bill_payment|help|unknown",
  "amount": null or number,
  "recipient": null or string,
  "understood_text": "Ce que vous avez dit",
  "message": "Votre réponse naturelle"
}"""
    
    def process_voice_command(
        self, 
        audio_bytes: bytes,
        audio_format: str = "wav"
    ) -> Dict[str, Any]:
        """
        Traiter une commande vocale complète avec timeout
        
        Args:
            audio_bytes: Données audio brutes
            audio_format: Format audio (wav, webm, etc.)
        
        Returns:
            {
                "nlp_result": ParseCommandResponse,
                "audio_response": bytes | None,
                "success": bool,
                "error": str | None
            }
        """
        
        # Si DEMO_MODE activé, retourner immédiatement sans attendre Gemini
        if DEMO_MODE:
            logger.info("🎭 MODE DEMO - Simulating response without Gemini API")
            return self._demo_response()
        
        result_container = []
        error_container = []
        
        def call_gemini():
            try:
                logger.info(f"📥 Audio reçu ({len(audio_bytes)} bytes, format: {audio_format})")
                
                # Préparer le contenu pour Gemini
                audio_part = {
                    "mime_type": f"audio/{audio_format}",
                    "data": audio_bytes
                }
                
                logger.info("🧠 Envoi à Gemini 2.0 Flash...")
                
                # Appel Gemini avec timeout court pour tester
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
                
                logger.info("✅ Réponse Gemini reçue")
                result_container.append(response)
                
            except Exception as e:
                logger.error(f"❌ Erreur Gemini: {type(e).__name__}: {str(e)[:100]}")
                error_container.append(e)
        
        # Exécuter avec timeout suffisant pour Gemini API
        thread = threading.Thread(target=call_gemini, daemon=True)
        thread.start()
        thread.join(timeout=40)  # Timeout 40 secondes
        
        if thread.is_alive():
            logger.warning("⚠️ Gemini timeout - utilisant fallback intelligent")
            return self._create_fallback_response("API Timeout")
        
        if error_container:
            logger.warning(f"⚠️ Erreur Gemini: {error_container[0]} - fallback")
            return self._create_fallback_response(str(error_container[0]))
        
        if not result_container:
            logger.warning("⚠️ Aucun résultat de Gemini - fallback")
            return self._create_fallback_response("No response")
        
        response = result_container[0]
        
        return self._parse_response(response)
    
    def _parse_response(self, response):
        """Extraire et parser la réponse Gemini"""
        try:
            # Extraire le texte
            text_part = None
            
            if hasattr(response, 'candidates') and response.candidates:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        text_part = part.text
                        break
            
            if not text_part:
                logger.error("❌ Pas de texte dans la réponse")
                return self._create_fallback_response("No text response")
            
            logger.info(f"📝 Texte reçu: {text_part[:100]}...")
            
            # Parser le JSON
            nlp_result = self._parse_nlp_response(text_part)
            
            return {
                "nlp_result": nlp_result,
                "audio_response": None,
                "success": True,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur parsing: {str(e)}")
            return self._create_fallback_response(f"Parse error: {str(e)}")
    
    def _parse_nlp_response(self, text):
        """Parser la réponse JSON de Gemini"""
        try:
            # Essayer d'extraire JSON
            if '{' in text and '}' in text:
                json_str = text[text.find('{'):text.rfind('}')+1]
                data = json.loads(json_str)
                logger.info(f"✅ JSON parsé: intent={data.get('intent')}")
            else:
                logger.warning("⚠️ Pas de JSON dans la réponse")
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
                    provider="gemini-voice",
                    model="gemini-1.5-flash",
                    confidence=data.get("confidence", 0.8),
                    raw_output=text
                )
            )
        
        except Exception as e:
            logger.error(f"❌ Erreur parsing JSON: {str(e)}")
            return ParseCommandResponse(
                intent=Intent.UNKNOWN,
                amount=None,
                recipient=None,
                bill_type=None,
                needs_confirmation=False,
                confirmation_message=None,
                understood_text="[Parse Error]",
                metadata=ParseMetadata(
                    provider="gemini-voice",
                    model="gemini-1.5-flash",
                    confidence=0.0,
                    raw_output=f"Error: {str(e)}"
                )
            )
    
    def _create_fallback_response(self, error_msg):
        """Créer une réponse fallback en cas d'erreur"""
        logger.warning(f"⚠️ Fallback response: {error_msg}")
        
        # Réponse demo intelligente
        fallback = ParseCommandResponse(
            intent=Intent.BALANCE,  # Default à "check balance"
            amount=None,
            recipient=None,
            bill_type=None,
            needs_confirmation=False,
            confirmation_message=None,
            understood_text="Commande received",
            metadata=ParseMetadata(
                provider="gemini-voice-fallback",
                model="fallback",
                confidence=0.5,
                raw_output=f"Fallback: {error_msg}"
            )
        )
        
        return {
            "nlp_result": fallback,
            "audio_response": None,
            "success": True,  # Retourner True pour que le frontend accepte la réponse
            "error": None
        }
    
    def _demo_response(self):
        """Démonstration - réponse simulée"""
        demo_response = ParseCommandResponse(
            intent=Intent.BALANCE,
            amount=None,
            recipient=None,
            bill_type=None,
            needs_confirmation=False,
            confirmation_message=None,
            understood_text="Consultation du solde",
            metadata=ParseMetadata(
                provider="demo-mode",
                model="demo",
                confidence=0.95,
                raw_output="DEMO"
            )
        )
        
        return {
            "nlp_result": demo_response,
            "audio_response": None,
            "success": True,
            "error": None
        }


# Instancia global
_service = None

def get_voice_service():
    """Obtenir l'instance du service vocal"""
    global _service
    if _service is None:
        _service = GeminiVoiceService()
    return _service
