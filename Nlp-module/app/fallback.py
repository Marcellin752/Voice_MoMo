import re

from app.models import Intent, ParseCommandResponse, ParseMetadata


AMOUNT_PATTERN = re.compile(r"(\d[\d\s.,]*)")

# Solde utilisateur (simulé, à connecter avec API réelle)
user_state = {
    "balance": 50000,
    "services_balance": 500,
}


def _parse_amount(text: str) -> int | None:
    match = AMOUNT_PATTERN.search(text)
    if not match:
        return None

    raw = match.group(1)
    normalized = raw.replace(" ", "").replace(",", "").replace(".", "")
    if not normalized.isdigit():
        return None
    return int(normalized)


def parse_with_fallback(text: str) -> ParseCommandResponse:
    lowered = text.lower().strip()

    if lowered in {"oui", "ok", "confirme", "je confirme"}:
        return ParseCommandResponse(
            intent=Intent.CONFIRM,
            understood_text=text,
            metadata=ParseMetadata(confidence=0.7),
        )

    if lowered in {"non", "annule", "annuler", "stop"}:
        return ParseCommandResponse(
            intent=Intent.CANCEL,
            understood_text=text,
            metadata=ParseMetadata(confidence=0.7),
        )

    if "solde" in lowered:
        balance_msg = f"Votre solde est de {user_state['balance']} francs et {user_state['services_balance']} pour vos services."
        return ParseCommandResponse(
            intent=Intent.BALANCE,
            confirmation_message=balance_msg,
            understood_text=text,
            metadata=ParseMetadata(confidence=0.9),
        )

    if "aide" in lowered or "help" in lowered:
        return ParseCommandResponse(
            intent=Intent.HELP,
            understood_text=text,
            metadata=ParseMetadata(confidence=0.8),
        )

    if any(token in lowered for token in ["envoie", "envoi", "transfert", "transfer", "donne"]):
        amount = _parse_amount(lowered)
        recipient_match = re.search(r"a\s+([\w\-\s]+)$", lowered)
        recipient = recipient_match.group(1).strip() if recipient_match else None

        return ParseCommandResponse(
            intent=Intent.TRANSFER,
            amount=amount,
            recipient=recipient,
            needs_confirmation=True,
            confirmation_message=(
                f"Voulez-vous envoyer {amount} francs a {recipient} ?"
                if amount and recipient
                else "Voulez-vous confirmer ce transfert ?"
            ),
            understood_text=text,
            metadata=ParseMetadata(confidence=0.65),
        )

    if any(token in lowered for token in ["recharge", "credit", "airtime"]):
        amount = _parse_amount(lowered)
        return ParseCommandResponse(
            intent=Intent.RECHARGE,
            amount=amount,
            needs_confirmation=True,
            confirmation_message=(
                f"Voulez-vous acheter {amount} francs de credit ?"
                if amount
                else "Voulez-vous confirmer cette recharge ?"
            ),
            understood_text=text,
            metadata=ParseMetadata(confidence=0.65),
        )

    if any(token in lowered for token in ["facture", "eau", "electricite", "internet", "payer", "paye"]):
        amount = _parse_amount(lowered)
        bill_type = None
        if "eau" in lowered:
            bill_type = "eau"
        elif "internet" in lowered:
            bill_type = "internet"
        elif "electricite" in lowered:
            bill_type = "electricite"

        return ParseCommandResponse(
            intent=Intent.BILL_PAYMENT,
            amount=amount,
            bill_type=bill_type,
            needs_confirmation=True,
            confirmation_message=(
                f"Voulez-vous confirmer le paiement de la facture {bill_type or ''} ?".strip()
            ),
            understood_text=text,
            metadata=ParseMetadata(confidence=0.6),
        )

    return ParseCommandResponse(
        intent=Intent.UNKNOWN,
        understood_text=text,
        metadata=ParseMetadata(confidence=0.3),
    )
