"""Ollama Mistral intent extraction with strict JSON output."""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any

import httpx

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")
TIMEOUT_SEC = 10.0

ALLOWED_ACTIONS = frozenset(
    {
        "transfer",
        "balance",
        "airtime",
        "billPayment",
        "withdraw",
        "miniStatement",
        "unknown",
    }
)

SYSTEM_PROMPT = """
Tu es un assistant financier Mobile Money. Analyse la commande en français et retourne
UNIQUEMENT un objet JSON valide, sans texte avant ni après, sans balises markdown.

Actions possibles :
- transfer      : envoyer de l'argent
- balance       : consulter le solde
- airtime       : acheter du crédit téléphonique
- billPayment   : payer une facture
- withdraw      : retirer de l'argent
- miniStatement : voir les dernières transactions
- unknown       : commande incompréhensible

Format de réponse STRICT :
{
  "action": "string",
  "amount": number_ou_null,
  "to": "string_ou_null",
  "confidence": number_entre_0_et_1
}

Règles de conversion :
- "cinq mille" → 5000
- "deux cent cinquante" → 250
- "mille cinq cents" → 1500
- Montants avec "francs", "FCFA", "CFA" → extraire le nombre uniquement
- Noms propres, surnoms, "maman", "papa" → garder tels quels dans "to"
- Numéros de téléphone → garder tels quels dans "to"
- Si action = balance, airtime sans destinataire → "to" = null

Exemples :
"envoie 5000 à maman" → {"action":"transfer","amount":5000,"to":"maman","confidence":0.97}
"mon solde" → {"action":"balance","amount":null,"to":null,"confidence":0.99}
"achète mille francs de crédit" → {"action":"airtime","amount":1000,"to":null,"confidence":0.95}
"paye la facture SBEE" → {"action":"billPayment","amount":null,"to":"SBEE","confidence":0.88}
"retire 10000" → {"action":"withdraw","amount":10000,"to":null,"confidence":0.93}
"bonjour comment ça va" → {"action":"unknown","amount":null,"to":null,"confidence":0.1}
""".strip()


def _extract_json_object(text: str) -> dict[str, Any] | None:
    t = text.strip()
    m = re.search(r"\{[\s\S]*\}", t)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _normalize_intent(raw: dict[str, Any]) -> dict[str, Any]:
    action = str(raw.get("action", "unknown")).strip()
    if action not in ALLOWED_ACTIONS:
        action = "unknown"
    amount = raw.get("amount")
    if amount is not None and amount != "":
        try:
            amount = float(amount)
            if amount != amount:  # NaN
                amount = None
            else:
                amount = int(amount) if amount == int(amount) else amount
        except (TypeError, ValueError):
            amount = None
    else:
        amount = None
    to_val = raw.get("to")
    to_out = None if to_val is None or to_val == "" else str(to_val).strip()
    conf = raw.get("confidence", 0.5)
    try:
        conf = float(conf)
        conf = max(0.0, min(1.0, conf))
    except (TypeError, ValueError):
        conf = 0.5
    return {"action": action, "amount": amount, "to": to_out, "confidence": conf}


def _call_ollama(user_text: str) -> str:
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_text},
        ],
        "stream": False,
    }
    with httpx.Client(timeout=TIMEOUT_SEC) as client:
        r = client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        r.raise_for_status()
        data = r.json()
    msg = data.get("message", {}) or {}
    out = msg.get("content") or data.get("response") or ""
    return str(out)


def parse_intent(text: str) -> dict[str, Any]:
    """Return normalized intent dict or unknown on failure."""
    raw_text = (text or "").strip()
    if not raw_text:
        return {
            "action": "unknown",
            "amount": None,
            "to": None,
            "confidence": 0.0,
            "raw_text": "",
        }

    last_err: str | None = None
    for attempt in range(2):
        try:
            content = _call_ollama(raw_text)
            parsed = _extract_json_object(content)
            if not parsed:
                last_err = "invalid_json"
                continue
            normalized = _normalize_intent(parsed)
            normalized["raw_text"] = raw_text
            return normalized
        except Exception as e:
            last_err = type(e).__name__
            time.sleep(0.2 * (attempt + 1))

    return {
        "action": "unknown",
        "amount": None,
        "to": None,
        "confidence": 0.1,
        "raw_text": raw_text,
        "error": last_err or "ollama_failed",
    }


def build_voice_confirmation(intent: dict[str, Any]) -> str:
    action = intent.get("action")
    amount = intent.get("amount")
    to = intent.get("to")
    if action == "transfer" and amount is not None:
        a = f"{int(amount):,}".replace(",", " ")
        dest = to or "le destinataire"
        return f"Vous souhaitez envoyer {a} francs à {dest}. Confirmez-vous ?"
    if action == "withdraw" and amount is not None:
        a = f"{int(amount):,}".replace(",", " ")
        return f"Vous souhaitez retirer {a} francs. Confirmez-vous ?"
    if action == "balance":
        return "Vous souhaitez consulter votre solde. Confirmez-vous ?"
    if action == "airtime" and amount is not None:
        a = f"{int(amount):,}".replace(",", " ")
        return f"Vous souhaitez acheter {a} francs de crédit. Confirmez-vous ?"
    if action == "billPayment":
        return f"Vous souhaitez payer une facture {to or ''}. Confirmez-vous ?".strip()
    if action == "miniStatement":
        return "Vous souhaitez voir vos dernières transactions. Confirmez-vous ?"
    return "Je n'ai pas bien compris. Pouvez-vous reformuler ?"
