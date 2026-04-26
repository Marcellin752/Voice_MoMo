"""
Service Vocal Complet - Voice MoMo
===================================

Stack professionnelle :
- AssemblyAI Universal-2 (STT) - Transcription multi-accents
- Anthropic Claude Sonnet 4.6 (NLP) - Analyse d'intention
- ElevenLabs Multilingual v2 (TTS) - Synthèse vocale naturelle

Budget : ~$38-72/mois pour 5 000-15 000 transactions
"""

import os
import json
import base64
import asyncio
import logging
import time
from typing import Dict, Any, Optional
from pathlib import Path

# Imports des SDKs
import assemblyai as aai
from anthropic import Anthropic
from elevenlabs import ElevenLabs, VoiceSettings

# Configuration du logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VoiceMoMoService:
    """
    Service vocal complet pour Mobile Money
    """
    
    def __init__(
        self,
        assemblyai_key: str,
        claude_key: str,
        elevenlabs_key: str
    ):
        """
        Initialiser le service avec les 3 APIs
        
        Args:
            assemblyai_key: Clé API AssemblyAI
            claude_key: Clé API Anthropic Claude
            elevenlabs_key: Clé API ElevenLabs
        """
        
        # Configurer AssemblyAI (STT)
        aai.settings.api_key = assemblyai_key
        self.transcriber = aai.Transcriber()
        
        # Configurer Claude (NLP)
        self.claude = Anthropic(api_key=claude_key)
        
        # Configurer ElevenLabs (TTS)
        self.elevenlabs = ElevenLabs(api_key=elevenlabs_key)
        
        # Prompt système pour Claude
        self.system_prompt = """Tu es un assistant Mobile Money intelligent pour l'Afrique francophone.

Ton rôle :
1. Analyser la commande vocale de l'utilisateur
2. Extraire l'intention et les entités (montant, destinataire, service)
3. Générer une réponse claire et naturelle en français

INTENTS supportés :
- "balance" : Consulter le solde
- "transfer" : Transférer de l'argent
- "recharge" : Acheter du crédit téléphonique
- "bill" : Payer une facture (électricité, eau, internet)
- "help" : Demander de l'aide
- "unknown" : Commande non comprise

ENTITÉS à extraire :
- amount (int) : Montant en francs CFA (ou FCFA, ou F)
- recipient (str) : Nom ou numéro du destinataire
- service (str) : Type de service pour factures

RÈGLES D'EXTRACTION :
- Convertis les montants en lettres en chiffres :
  * "cinq mille" → 5000
  * "deux mille cinq cents" → 2500
  * "dix mille" → 10000
- Normalise les destinataires :
  * "maman" → "Maman"
  * "papa" → "Papa"
  * "jean" → "Jean"
- Détecte les variantes linguistiques :
  * "envoie", "transfert", "donne", "fais parvenir" → transfer
  * "solde", "balance", "combien j'ai" → balance
  * "recharge", "crédit", "unités" → recharge

GESTION DES INFORMATIONS MANQUANTES :
- Si montant manquant pour transfer/recharge/bill → demander le montant
- Si destinataire manquant pour transfer → demander à qui
- Si service manquant pour bill → demander quel service

RÉPONSES NATURELLES :
- Utilise un ton conversationnel amical
- Sois concis et clair
- Pour les confirmations, rappelle TOUS les détails
- Pour les erreurs, sois encourageant

FORMAT DE RÉPONSE (JSON strict) :
{
  "intent": "balance | transfer | recharge | bill | help | unknown",
  "entities": {
    "amount": <nombre_ou_null>,
    "recipient": "<texte_ou_null>",
    "service": "<texte_ou_null>"
  },
  "confidence": <0.0_à_1.0>,
  "requires_confirmation": <true_ou_false>,
  "response_message": "<message_en_français>",
  "clarification_needed": "<question_ou_null>"
}

EXEMPLES CONCRETS :

Commande : "Quel est mon solde ?"
{
  "intent": "balance",
  "entities": {"amount": null, "recipient": null, "service": null},
  "confidence": 1.0,
  "requires_confirmation": false,
  "response_message": "Je consulte votre solde...",
  "clarification_needed": null
}

Commande : "Envoie cinq mille francs à Jean"
{
  "intent": "transfer",
  "entities": {"amount": 5000, "recipient": "Jean", "service": null},
  "confidence": 0.95,
  "requires_confirmation": true,
  "response_message": "Voulez-vous vraiment envoyer 5 000 francs CFA à Jean ?",
  "clarification_needed": null
}

Commande : "Envoie de l'argent"
{
  "intent": "transfer",
  "entities": {"amount": null, "recipient": null, "service": null},
  "confidence": 0.7,
  "requires_confirmation": false,
  "response_message": "Combien voulez-vous envoyer et à qui ?",
  "clarification_needed": "Veuillez préciser le montant et le destinataire"
}

Commande : "Recharge deux mille"
{
  "intent": "recharge",
  "entities": {"amount": 2000, "recipient": null, "service": null},
  "confidence": 0.9,
  "requires_confirmation": true,
  "response_message": "Confirmez-vous la recharge de 2 000 francs CFA de crédit ?",
  "clarification_needed": null
}

Commande : "Paye ma facture d'électricité"
{
  "intent": "bill",
  "entities": {"amount": null, "recipient": null, "service": "électricité"},
  "confidence": 0.8,
  "requires_confirmation": false,
  "response_message": "Quel est le montant de votre facture d'électricité ?",
  "clarification_needed": "Veuillez préciser le montant"
}

Réponds UNIQUEMENT avec le JSON. Pas de texte avant ou après. Pas de markdown (```json).
"""
    
    async def process_voice_command(
        self,
        audio_file_path: str
    ) -> Dict[str, Any]:
        """
        Traiter une commande vocale complète
        
        Args:
            audio_file_path: Chemin vers le fichier audio (WAV, MP3, etc.)
        
        Returns:
            {
                "success": bool,
                "transcription": str,
                "nlp_result": {...},
                "audio_response": bytes,
                "latency": {
                    "stt": float,
                    "nlp": float,
                    "tts": float,
                    "total": float
                },
                "error": str | None
            }
        """
        
        start_time = time.time()
        latency = {}
        
        try:
            logger.info(f"📥 Traitement de: {audio_file_path}")
            
            # ================================================================
            # ÉTAPE 1 : SPEECH-TO-TEXT (AssemblyAI)
            # ================================================================
            
            stt_start = time.time()
            logger.info("🎤 [1/3] Transcription avec AssemblyAI...")
            
            transcription = await self._transcribe_audio(audio_file_path)
            
            latency["stt"] = time.time() - stt_start
            logger.info(f"✅ Transcription: '{transcription}' ({latency['stt']:.2f}s)")
            
            if not transcription or transcription.strip() == "":
                return {
                    "success": False,
                    "error": "Aucune parole détectée",
                    "transcription": "",
                    "nlp_result": {},
                    "audio_response": None,
                    "latency": latency
                }
            
            # ================================================================
            # ÉTAPE 2 : NLP ANALYSIS (Claude Sonnet 4.6)
            # ================================================================
            
            nlp_start = time.time()
            logger.info("🧠 [2/3] Analyse NLP avec Claude Sonnet 4.6...")
            
            nlp_result = await self._analyze_with_claude(transcription)
            
            latency["nlp"] = time.time() - nlp_start
            logger.info(f"✅ Intent: {nlp_result['intent']}, Entities: {nlp_result['entities']} ({latency['nlp']:.2f}s)")
            
            # ================================================================
            # ÉTAPE 3 : TEXT-TO-SPEECH (ElevenLabs)
            # ================================================================
            
            tts_start = time.time()
            logger.info("🔊 [3/3] Synthèse vocale avec ElevenLabs...")
            
            response_text = nlp_result.get("response_message", "")
            audio_response = await self._synthesize_speech(response_text)
            
            latency["tts"] = time.time() - tts_start
            logger.info(f"✅ Audio généré ({len(audio_response)} bytes) ({latency['tts']:.2f}s)")
            
            # ================================================================
            # RÉSULTAT FINAL
            # ================================================================
            
            latency["total"] = time.time() - start_time
            
            logger.info(f"🎯 Traitement complet: {latency['total']:.2f}s")
            
            return {
                "success": True,
                "transcription": transcription,
                "nlp_result": nlp_result,
                "audio_response": audio_response,
                "latency": latency,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"❌ Erreur: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "transcription": "",
                "nlp_result": {},
                "audio_response": None,
                "latency": latency
            }
    
    async def _transcribe_audio(self, audio_file_path: str) -> str:
        """
        Transcrire l'audio avec AssemblyAI Universal-2
        """
        
        try:
            # Validate file exists
            if not Path(audio_file_path).exists():
                raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
            
            # Configuration pour français avec multi-accents
            config = aai.TranscriptionConfig(
                language_code="fr",  # Français
                speech_model=aai.SpeechModel.universal_2,  # Modèle Universal-2
                punctuate=True,
                format_text=True
            )
            
            # Use asyncio.to_thread to prevent blocking the event loop
            transcript = await asyncio.to_thread(
                self.transcriber.transcribe,
                audio_file_path,
                config
            )
            
            if transcript.status == aai.TranscriptStatus.error:
                raise Exception(f"Erreur transcription: {transcript.error}")
            
            return transcript.text
            
        except Exception as e:
            logger.error(f"❌ Erreur AssemblyAI: {e}")
            raise
    
    async def _analyze_with_claude(self, transcription: str) -> Dict[str, Any]:
        """
        Analyser la transcription avec Claude Sonnet 4.6
        """
        
        try:
            # Appel à Claude (non-bloquant avec asyncio.to_thread)
            response = await asyncio.to_thread(
                self.claude.messages.create,
                model="claude-sonnet-4-6",
                max_tokens=500,
                system=self.system_prompt,
                messages=[{
                    "role": "user",
                    "content": f"Commande vocale : \"{transcription}\""
                }]
            )
            
            # Extraire le texte de réponse
            response_text = response.content[0].text
            
            # Nettoyer et parser le JSON
            cleaned_text = response_text.strip()
            
            # Enlever les backticks markdown si présents
            for marker in ["```json", "```"]:
                cleaned_text = cleaned_text.replace(marker, "")
            cleaned_text = cleaned_text.strip()
            
            # Parser le JSON
            try:
                nlp_result = json.loads(cleaned_text)
            except json.JSONDecodeError as parse_error:
                logger.warning(f"JSON parse failed, retrying with simpler prompt: {parse_error}")
                
                # Retry avec prompt plus simple
                response2 = await asyncio.to_thread(
                    self.claude.messages.create,
                    model="claude-sonnet-4-6",
                    max_tokens=300,
                    messages=[{
                        "role": "user",
                        "content": f"Respond with ONLY valid JSON for: {transcription}"
                    }]
                )
                response_text = response2.content[0].text.strip()
                nlp_result = json.loads(response_text)
            
            # Valider les champs obligatoires
            required_fields = ["intent", "entities", "response_message"]
            for field in required_fields:
                if field not in nlp_result:
                    raise ValueError(f"Champ manquant dans réponse Claude: {field}")
            
            # Ajouter valeurs par défaut
            nlp_result.setdefault("confidence", 0.8)
            nlp_result.setdefault("requires_confirmation", False)
            nlp_result.setdefault("clarification_needed", None)
            
            return nlp_result
        
        except Exception as e:
            logger.error(f"❌ Erreur Claude API: {e}")
            
            # Fallback
            return {
                "intent": "unknown",
                "entities": {},
                "confidence": 0.0,
                "requires_confirmation": False,
                "response_message": "Je n'ai pas bien compris. Pouvez-vous répéter ?",
                "clarification_needed": "Reformulez votre demande"
            }
    
    async def _synthesize_speech(self, text: str, voice: str = "Rachel") -> bytes:
        """
        Synthétiser la parole avec ElevenLabs Multilingual v2
        
        Args:
            text: Texte à synthétiser
            voice: Voix ElevenLabs ("Rachel" par défaut)
        
        Returns:
            Bytes de l'audio généré
        """
        
        try:
            # Valider le texte
            if not text or not text.strip():
                logger.warning("Empty text for TTS, returning empty bytes")
                return b""
            
            # Générer l'audio (non-bloquant avec asyncio.to_thread)
            audio_generator = await asyncio.to_thread(
                self.elevenlabs.generate,
                text=text,
                voice=voice,
                model="eleven_multilingual_v2",
                voice_settings=VoiceSettings(
                    stability=0.5,
                    similarity_boost=0.75,
                    style=0.0,
                    use_speaker_boost=True
                )
            )
            
            # Convertir le générateur en bytes de manière efficace
            audio_bytes = b"".join(chunk for chunk in audio_generator if chunk)
            
            if not audio_bytes:
                raise Exception("ElevenLabs returned empty audio")
            
            return audio_bytes
            
        except Exception as e:
            logger.error(f"❌ Erreur ElevenLabs: {e}")
            raise


# ============================================================================
# ENDPOINT FASTAPI
# ============================================================================

"""
Intégration dans ton backend FastAPI existant
==============================================

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import Response
from voice_momo_service import VoiceMoMoService
import os
from pathlib import Path
import tempfile

app = FastAPI()

# Initialiser le service avec les clés API
service = VoiceMoMoService(
    assemblyai_key=os.getenv("ASSEMBLYAI_API_KEY"),
    claude_key=os.getenv("ANTHROPIC_API_KEY"),
    elevenlabs_key=os.getenv("ELEVENLABS_API_KEY")
)

@app.post("/api/voice-command")
async def voice_command(audio_file: UploadFile = File(...)):
    '''
    Endpoint principal pour commandes vocales
    
    Input : Fichier audio (WAV, MP3, etc.)
    Output : Audio MP3 de réponse
    '''
    
    # Sauvegarder temporairement le fichier
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
        content = await audio_file.read()
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        # Traiter la commande vocale
        result = await service.process_voice_command(temp_path)
        
        if not result["success"]:
            return {"error": result["error"]}, 500
        
        # Récupérer l'analyse NLP
        nlp_result = result["nlp_result"]
        
        # Logger pour debug
        print(f"Intent: {nlp_result['intent']}")
        print(f"Entities: {nlp_result['entities']}")
        print(f"Latence totale: {result['latency']['total']:.2f}s")
        
        # Exécuter l'action Mobile Money selon l'intent
        # (TON CODE MÉTIER ICI)
        if nlp_result['intent'] == 'transfer':
            amount = nlp_result['entities'].get('amount')
            recipient = nlp_result['entities'].get('recipient')
            
            if nlp_result['requires_confirmation']:
                # Gérer la confirmation
                # (tu as déjà ce code)
                pass
            else:
                # Exécuter le transfert
                # execute_transfer(user_id, amount, recipient)
                pass
        
        elif nlp_result['intent'] == 'balance':
            # Consulter le solde
            # balance = get_user_balance(user_id)
            pass
        
        # Retourner l'audio de réponse
        return Response(
            content=result["audio_response"],
            media_type="audio/mpeg",
            headers={
                "X-Transcription": result["transcription"],
                "X-Intent": nlp_result["intent"],
                "X-Latency": str(result["latency"]["total"])
            }
        )
    
    finally:
        # Nettoyer le fichier temporaire
        Path(temp_path).unlink(missing_ok=True)

@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "services": {
            "stt": "AssemblyAI Universal-2",
            "nlp": "Claude Sonnet 4.6",
            "tts": "ElevenLabs Multilingual v2"
        }
    }
"""
