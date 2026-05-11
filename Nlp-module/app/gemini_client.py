"""
Gemini 2.0 Flash NLP Client for Mobile Money Voice Commands
Replaces Grok with Google's free Gemini 2.0 Flash API
"""

import json
import requests
import os

from app.config import settings
from app.models import (
    Intent,
    ParseCommandResponse,
    ParseMetadata,
)

SYSTEM_PROMPT = """
Tu es un parseur NLP spécialisé pour les transferts d'argent Mobile Money.
Tu ne gères QUE les transferts d'argent. Rien d'autre.

## TA MISSION UNIQUE
Extraire les informations pour un transfert d'argent et retourner un JSON valide :

{
  "intent": "transfer",
  "amount": <entier>,
  "currency": "XOF",
  "recipient": "<numéro ou nom>",
  "recipient_type": "phone|contact",
  "confidence": <float 0-1>,
  "missing_info": ["amount"|"recipient"],
  "needs_confirmation": <bool>
}

## RÈGLES D'EXTRACTION STRICTES

### 1. MONTANT (amount)
- Toujours en francs CFA (XOF)
- Extraire les chiffres : "5000", "5000 francs", "5 mille"
- Si montant manquant → missing_info = ["amount"]
- Jamais de décimales (arrondir à l'entier)

### 2. DESTINATAIRE (recipient)
- Numéro de téléphone : 8 à 15 chiffres (ex: "97123456", "+22997123456")
- Nom de contact : "Jean", "Aurel", "maman"
- Si nom → recipient_type = "contact" (sera résolu par le système)
- Si numéro → recipient_type = "phone"

### 3. INTENT
- Toujours "transfer" pour toute commande de transfert
- Mots-clés : "envoie", "transfère", "donne", "envoyer", "transférer"

## EXEMPLES DE COMMANDES ET RÉPONSES

### Exemple 1 : Complet
Commande : "Envoie 5000 francs à 97123456"
Réponse :
{
  "intent": "transfer",
  "amount": 5000,
  "currency": "XOF",
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.98,
  "missing_info": [],
  "needs_confirmation": true
}

### Exemple 2 : Avec nom
Commande : "Transfère 10000 à Jean"
Réponse :
{
  "intent": "transfer",
  "amount": 10000,
  "currency": "XOF",
  "recipient": "Jean",
  "recipient_type": "contact",
  "confidence": 0.95,
  "missing_info": [],
  "needs_confirmation": true
}

### Exemple 3 : Montant manquant
Commande : "Envoie de l'argent à 97123456"
Réponse :
{
  "intent": "transfer",
  "amount": null,
  "currency": "XOF",
  "recipient": "97123456",
  "recipient_type": "phone",
  "confidence": 0.85,
  "missing_info": ["amount"],
  "needs_confirmation": false
}

### Exemple 4 : Destinataire manquant
Commande : "Je veux envoyer 5000 francs"
Réponse :
{
  "intent": "transfer",
  "amount": 5000,
  "currency": "XOF",
  "recipient": null,
  "recipient_type": null,
  "confidence": 0.80,
  "missing_info": ["recipient"],
  "needs_confirmation": false
}

## CONTRAINTES STRICTES

1. **UNIQUEMENT JSON** - Pas de texte avant/après
2. **Pas de markdown** - JSON brut
3. **Toujours retourner un JSON valide**
4. **Si incompréhension totale** → confidence = 0.2, missing_info = ["amount", "recipient"]

## TRAITEMENT DES CAS SPÉCIAUX

- "solde" → Ce n'est pas un transfert → confidence = 0.2, intent = "unknown"
- "recharge" → Ce n'est pas un transfert → confidence = 0.2, intent = "unknown"
- Nombres ambigus → Contexte détermine si amount ou recipient
- "tout mon argent" → amount = null, missing_info = ["amount"]

## FORMAT DE SORTIE OBLIGATOIRE

{
  "intent": "transfer|unknown",
  "amount": <int|null>,
  "currency": "XOF",
  "recipient": "<string|null>",
  "recipient_type": "phone|contact|null",
  "confidence": <float>,
  "missing_info": ["amount", "recipient"],
  "needs_confirmation": <bool>
}
""".strip()


class GeminiClient:
    """Google Gemini 2.0 Flash based NLP command parser"""
    
    def __init__(self) -> None:
        """Initialize Gemini client with API key from config"""
        self.api_key = settings.gemini_api_key
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured in environment")
        
        api_version = os.getenv("GEMINI_API_VERSION", "v1beta")
        self.url = f"https://generativelanguage.googleapis.com/{api_version}/models/{settings.gemini_model}:generateContent?key={self.api_key}"
    
    async def parse_command(self, text: str) -> ParseCommandResponse:
        """
        Parse a voice command using Gemini 2.0 Flash
        
        Args:
            text: User's voice command as text
            
        Returns:
            ParseCommandResponse with intent, entities, and metadata
        """
        if not self.api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")
        
        # Build prompt
        full_prompt = f"{SYSTEM_PROMPT}\n\nUser command: {text}"
        
        payload = {
            "contents": [{"parts": [{"text": full_prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 500,
            }
        }
        
        try:
            response = requests.post(self.url, json=payload, timeout=30)
            response.raise_for_status()
            data_resp = response.json()
            content = data_resp['candidates'][0]['content']['parts'][0]['text'].strip()
        except Exception as e:
            # If Gemini fails, return error response (will be caught by fallback)
            raise RuntimeError(f"Gemini API error: {str(e)}")
        
        # Parse JSON response
        data = self._extract_json(content)
        
        # Normalize intent
        intent_value = str(data.get("intent", "unknown")).lower().strip()
        if intent_value not in {item.value for item in Intent}:
            intent_value = Intent.UNKNOWN.value
        
        # Normalize amount
        amount = self._normalize_amount(data.get("amount"))
        
        # Normalize recipient
        recipient = data.get("recipient")
        recipient = str(recipient).strip() if recipient else None
        
        # Normalize bill type
        bill_type = data.get("bill_type")
        bill_type = str(bill_type).strip() if bill_type else None
        
        # Normalize airtime type
        airtime_type = data.get("airtime_type")
        airtime_type = str(airtime_type).strip() if airtime_type else None
        
        # Determine if confirmation needed
        needs_confirmation = bool(data.get("needs_confirmation", False))
        if intent_value in {
            Intent.TRANSFER.value, Intent.RECHARGE.value, Intent.BILL_PAYMENT.value,
            Intent.WITHDRAW_GAB.value, Intent.INTERNET_DAY.value, Intent.INTERNET_WEEK.value,
            Intent.INTERNET_MONTH.value, Intent.INTERNET_UNLIMITED.value,
            Intent.GOPACK_DAY.value, Intent.GOPACK_WEEK.value, Intent.GOPACK_MONTH.value
        }:
            needs_confirmation = True
        
        return ParseCommandResponse(
            intent=Intent(intent_value),
            amount=amount,
            recipient=recipient,
            bill_type=bill_type,
            airtime_type=airtime_type,
            needs_confirmation=needs_confirmation,
            confirmation_message=self._build_confirmation(intent_value, amount, recipient, bill_type, airtime_type),
            understood_text=text,
            metadata=ParseMetadata(
                provider="gemini",
                model=settings.gemini_model,
                confidence=float(data.get("confidence", 0.8)),
                raw_output=content,
            ),
        )
    
    @staticmethod
    def _extract_json(content: str) -> dict:
        """
        Extract JSON from response text.
        Handles markdown code blocks and malformed JSON.
        """
        content = content.strip()
        
        # Strip markdown code blocks
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()
        
        # Try to parse if looks like JSON
        if content.startswith("{") and content.endswith("}"):
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                pass
        
        # Try to find JSON block within response
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(content[start : end + 1])
            except json.JSONDecodeError:
                pass
        
        return {}
    
    @staticmethod
    def _normalize_amount(raw_amount: object) -> int | None:
        """Normalize amount from various types to integer"""
        if raw_amount is None:
            return None
        if isinstance(raw_amount, int):
            return raw_amount
        if isinstance(raw_amount, float):
            return int(raw_amount)
        if isinstance(raw_amount, str):
            # Remove spaces, commas, periods used as separators
            cleaned = raw_amount.strip().replace(" ", "").replace(",", "").replace(".", "")
            return int(cleaned) if cleaned.isdigit() else None
        return None
    
    @staticmethod
    def _build_confirmation(
        intent: str,
        amount: int | None,
        recipient: str | None,
        bill_type: str | None,
        airtime_type: str | None = None,
    ) -> str | None:
        """Build localized French confirmation message for user"""
        if intent == Intent.BALANCE.value:
            # Mock balance response - in production, fetch actual balance from API
            return "Votre solde est de 50000 francs et 500 pour vos services."
        
        if intent == Intent.TRANSFER.value:
            if amount and recipient:
                return f"Voulez-vous envoyer {amount} francs a {recipient} ?"
            return "Voulez-vous confirmer ce transfert ?"
        
        if intent == Intent.WITHDRAW_GAB.value:
            if amount:
                return f"Voulez-vous retirer {amount} francs via GAB UBA ?"
            return "Voulez-vous retirer des fonds via GAB UBA ?"
        
        if intent == Intent.RECHARGE.value:
            if amount:
                return f"Voulez-vous acheter {amount} francs de credit ?"
            return "Voulez-vous confirmer cette recharge ?"
        
        if intent in {
            Intent.INTERNET_DAY.value, Intent.INTERNET_WEEK.value,
            Intent.INTERNET_MONTH.value, Intent.INTERNET_UNLIMITED.value,
            Intent.GOPACK_DAY.value, Intent.GOPACK_WEEK.value, Intent.GOPACK_MONTH.value
        }:
            forfait_name = "forfait internet" if "internet" in intent else "Go Pack"
            period = intent.split("_")[-1].replace("_", " ")
            if amount:
                return f"Voulez-vous acheter le {forfait_name} {period} pour {amount} francs ?"
            return f"Voulez-vous confirmer l'achat du {forfait_name} {period} ?"
        
        if intent == Intent.BILL_PAYMENT.value:
            if amount and bill_type:
                return f"Voulez-vous payer {amount} francs pour la facture {bill_type} ?"
            return "Voulez-vous confirmer ce paiement de facture ?"
        
        return None
