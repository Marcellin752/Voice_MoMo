import re
from typing import Optional

from app.models import Intent, ParseCommandResponse

CURRENCY_HINTS = (
    "fcfa",
    "cfa",
    "xof",
    "franc",
    "francs",
    "montant",
)

PHONE_HINTS = (
    "au",
    "a",
    "vers",
    "numero",
    "numéro",
    "telephone",
    "téléphone",
    "tel",
    "destinataire",
)

AMOUNT_WITH_CURRENCY_PATTERN = re.compile(
    r"((?:\d[\d\s.,]{0,18}\d)|\d)\s*(?:f\.?c\.?f\.?a|fcfa|cfa|xof|francs?)\b",
    flags=re.IGNORECASE,
)

PHONE_WITH_HINT_PATTERN = re.compile(
    r"\b(?:au|a|vers|numero|numéro|tel|telephone|téléphone|destinataire)\b\s*"
    r"(?:le\s*)?(?:num[eé]ro\s*)?((?:\d[\s.-]?){8,15})",
    flags=re.IGNORECASE,
)

NUMBER_PATTERN = re.compile(r"(?<!\d)(?:\d[\d\s.,]{0,18}\d|\d)(?!\d)")

MAX_REASONABLE_AMOUNT = 50_000_000


def _digits_only(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _is_phone_number(value: Optional[str]) -> bool:
    if not value:
        return False
    digits = _digits_only(value)
    return 8 <= len(digits) <= 15


def _to_int(value: str) -> Optional[int]:
    digits = _digits_only(value)
    if not digits:
        return None
    try:
        return int(digits)
    except ValueError:
        return None


def extract_amount_and_phone(text: str) -> tuple[Optional[int], Optional[str]]:
    lowered = (text or "").lower()

    phone_value = None
    phone_match = PHONE_WITH_HINT_PATTERN.search(lowered)
    if phone_match:
        digits = _digits_only(phone_match.group(1))
        if 8 <= len(digits) <= 15:
            phone_value = digits

    amount_value = None
    amount_match = AMOUNT_WITH_CURRENCY_PATTERN.search(lowered)
    if amount_match:
        amount_value = _to_int(amount_match.group(1))

    tokens: list[dict] = []
    for match in NUMBER_PATTERN.finditer(lowered):
        raw = match.group(0)
        digits = _digits_only(raw)
        if not digits:
            continue

        value = int(digits)
        context_before = lowered[max(0, match.start() - 20):match.start()]
        context_after = lowered[match.end(): min(len(lowered), match.end() + 20)]
        context = f"{context_before} {context_after}"

        has_currency_hint = any(hint in context for hint in CURRENCY_HINTS)
        has_phone_hint = any(
            re.search(rf"\b{re.escape(hint)}\b", context) is not None
            for hint in PHONE_HINTS
        )

        tokens.append(
            {
                "value": value,
                "digits": digits,
                "len": len(digits),
                "has_currency": has_currency_hint,
                "has_phone_hint": has_phone_hint,
            }
        )

    if amount_value is None:
        # 1) Priorité au nombre explicitement monétaire
        for token in tokens:
            if token["has_currency"] and token["value"] <= MAX_REASONABLE_AMOUNT:
                amount_value = token["value"]
                break

    if amount_value is None:
        # 2) Sinon prendre un montant plausible qui n'est pas un téléphone
        for token in tokens:
            if token["len"] <= 7 and token["value"] <= MAX_REASONABLE_AMOUNT:
                amount_value = token["value"]
                break

    if phone_value is None:
        # 3) Détecter un numéro de téléphone plausible
        for token in tokens:
            if 8 <= token["len"] <= 15 and not token["has_currency"]:
                if amount_value is None or token["value"] != amount_value:
                    phone_value = token["digits"]
                    break

    return amount_value, phone_value


def normalize_parsed_entities(parsed: ParseCommandResponse) -> ParseCommandResponse:
    if parsed.intent in {Intent.BALANCE, Intent.HELP, Intent.CONFIRM, Intent.CANCEL}:
        return parsed

    lowered = (parsed.understood_text or "").lower()
    amount_from_text, phone_from_text = extract_amount_and_phone(parsed.understood_text)

    # Récupération d'intent quand le modèle renvoie unknown
    if parsed.intent == Intent.UNKNOWN:
        if any(token in lowered for token in ("recharge", "crédit", "credit", "airtime", "forfait", "pass")) and amount_from_text:
            parsed.intent = Intent.RECHARGE
            parsed.needs_confirmation = True
        elif phone_from_text and amount_from_text:
            parsed.intent = Intent.TRANSFER
            parsed.needs_confirmation = True
        elif any(token in lowered for token in ("facture", "eau", "electricite", "électricité", "internet")) and amount_from_text:
            parsed.intent = Intent.BILL_PAYMENT
            parsed.needs_confirmation = True
        elif any(token in lowered for token in ("paye", "payer", "paiement", "paiment", "payment")) and amount_from_text:
            parsed.intent = Intent.TRANSFER if phone_from_text else Intent.BILL_PAYMENT
            parsed.needs_confirmation = True
        else:
            return parsed

    # Forcer la réécriture de l'intent si le mot-clé forfait/recharge est présent très explicitement 
    # même si l'IA a détecté un transfert par erreur (sans destinataire)
    if parsed.intent == Intent.TRANSFER and not phone_from_text:
        if any(token in lowered for token in ("forfait", "recharge", "crédit", "credit", "pour moi", "moi même", "moi meme", "mon numéro", "mon numero")):
            parsed.intent = Intent.RECHARGE

    amount = parsed.amount
    recipient = parsed.recipient.strip() if parsed.recipient else None

    if recipient and _is_phone_number(recipient):
        recipient = _digits_only(recipient)

    if amount_from_text is not None:
        # Toujours privilégier l'extraction par Regex si elle a trouvé un montant valide, 
        # car elle est moins sujette aux hallucinations (ex: 200f vs 2000)
        amount = amount_from_text

    if parsed.intent == Intent.TRANSFER:
        if phone_from_text:
            recipient = phone_from_text

    # Si le modèle classifie "paiement" comme facture mais qu'un numéro est donné,
    # reclassifier en transfert (paiement vers numéro)
    if parsed.intent == Intent.BILL_PAYMENT and phone_from_text and not parsed.bill_type:
        parsed.intent = Intent.TRANSFER
        recipient = phone_from_text
        
    # Toujours forcer la confirmation pour les actions sensibles
    if parsed.intent in {Intent.TRANSFER, Intent.RECHARGE, Intent.BILL_PAYMENT}:
        parsed.needs_confirmation = True

    parsed.amount = amount
    parsed.recipient = recipient
    return parsed


def format_amount_for_tts(amount: float | int) -> str:
    return str(int(float(amount)))


def format_recipient_for_tts(recipient: Optional[str]) -> str:
    if not recipient:
        return "destinataire"

    if _is_phone_number(recipient):
        digits = _digits_only(recipient)
        grouped = " ".join(digits[i:i + 2] for i in range(0, len(digits), 2))
        return f"le numéro {grouped}"

    return recipient
