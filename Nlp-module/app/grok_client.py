import json

import httpx

from app.config import settings
from app.models import (
    GrokMessage,
    GrokRequest,
    GrokResponse,
    Intent,
    ParseCommandResponse,
    ParseMetadata,
)

SYSTEM_PROMPT = """
Tu es un parseur NLP pour des commandes Mobile Money en francais.
Retourne uniquement un JSON valide avec ce schema exact:
{
  "intent": "balance|transfer|recharge|bill_payment|help|confirm|cancel|unknown",
  "amount": <int|null>,
  "currency": "XOF",
  "recipient": <string|null>,
  "bill_type": <"electricite"|"eau"|"internet"|null>,
  "needs_confirmation": <bool>,
  "confidence": <float entre 0 et 1>
}
Regles:
- "solde" => intent balance
- "envoie/transfert" => intent transfer
- "recharge/credit" => intent recharge
- "facture/paye" => intent bill_payment
- "oui/je confirme" => intent confirm
- "non/annule" => intent cancel
- Si incertain => unknown
- Ne retourne aucun texte hors JSON
""".strip()


class GrokClient:
    def __init__(self) -> None:
        self.base_url = settings.xai_base_url.rstrip("/")
        self.api_key = settings.xai_api_key
        self.model = settings.xai_model
        self.timeout = settings.request_timeout_seconds

    async def parse_command(self, text: str) -> ParseCommandResponse:
        if not self.api_key:
            raise RuntimeError("XAI_API_KEY is not configured")

        request_payload = GrokRequest(
            model=self.model,
            messages=[
                GrokMessage(role="system", content=SYSTEM_PROMPT),
                GrokMessage(role="user", content=text),
            ],
            temperature=0.1,
        )

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=request_payload.model_dump(),
            )
            response.raise_for_status()
            parsed = GrokResponse.model_validate(response.json())

        content = parsed.choices[0].message.content.strip() if parsed.choices else "{}"
        data = self._extract_json(content)

        intent_value = str(data.get("intent", "unknown")).lower().strip()
        if intent_value not in {item.value for item in Intent}:
            intent_value = Intent.UNKNOWN.value

        amount = self._normalize_amount(data.get("amount"))

        recipient = data.get("recipient")
        recipient = str(recipient).strip() if recipient else None

        bill_type = data.get("bill_type")
        bill_type = str(bill_type).strip() if bill_type else None

        needs_confirmation = bool(data.get("needs_confirmation", False))
        if intent_value in {Intent.TRANSFER.value, Intent.RECHARGE.value, Intent.BILL_PAYMENT.value}:
            needs_confirmation = True

        return ParseCommandResponse(
            intent=Intent(intent_value),
            amount=amount,
            recipient=recipient,
            bill_type=bill_type,
            needs_confirmation=needs_confirmation,
            confirmation_message=self._build_confirmation(intent_value, amount, recipient, bill_type),
            understood_text=text,
            metadata=ParseMetadata(
                provider="grok",
                model=self.model,
                confidence=float(data.get("confidence", 0.7)),
                raw_output=content,
            ),
        )

    @staticmethod
    def _extract_json(content: str) -> dict:
        content = content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()
        if content.startswith("{") and content.endswith("}"):
            return json.loads(content)

        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            return json.loads(content[start : end + 1])

        return {}

    @staticmethod
    def _normalize_amount(raw_amount: object) -> int | None:
        if raw_amount is None:
            return None
        if isinstance(raw_amount, int):
            return raw_amount
        if isinstance(raw_amount, float):
            return int(raw_amount)
        if isinstance(raw_amount, str):
            cleaned = raw_amount.strip().replace(" ", "").replace(",", "").replace(".", "")
            return int(cleaned) if cleaned.isdigit() else None
        return None

    @staticmethod
    def _build_confirmation(intent: str, amount: int | None, recipient: str | None, bill_type: str | None) -> str | None:
        if intent == Intent.TRANSFER.value:
            if amount and recipient:
                return f"Voulez-vous envoyer {amount} francs a {recipient} ?"
            return "Voulez-vous confirmer ce transfert ?"
        if intent == Intent.RECHARGE.value:
            if amount:
                return f"Voulez-vous acheter {amount} francs de credit ?"
            return "Voulez-vous confirmer cette recharge ?"
        if intent == Intent.BILL_PAYMENT.value:
            if amount and bill_type:
                return f"Voulez-vous payer {amount} francs pour la facture {bill_type} ?"
            return "Voulez-vous confirmer ce paiement de facture ?"
        return None
