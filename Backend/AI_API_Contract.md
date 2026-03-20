# Voice MoMo NLP API Contract

This document defines the stable contract between backend services and the NLP module.

## Base URL
- Local default: `http://localhost:8001`

## Health Check
- Method: `GET`
- Path: `/health`
- Success response:
```json
{
  "status": "ok"
}
```

## Parse Command
- Method: `POST`
- Path: `/ai/parse`
- Purpose: Convert a French voice transcript into an action intent + entities.

### Request Body
```json
{
  "text": "Envoie 5000 francs a Jean",
  "locale": "fr-FR"
}
```

Fields:
- `text` (string, required, 1..500): user transcript from STT.
- `locale` (string, optional): language locale. Default is `fr-FR`.

### Response Body
```json
{
  "intent": "transfer",
  "amount": 5000,
  "currency": "XOF",
  "recipient": "Jean",
  "bill_type": null,
  "needs_confirmation": true,
  "confirmation_message": "Voulez-vous envoyer 5000 francs a Jean ?",
  "understood_text": "Envoie 5000 francs a Jean",
  "metadata": {
    "provider": "grok",
    "model": "grok-2-latest",
    "confidence": 0.91,
    "raw_output": "{...}"
  }
}
```

### Intent Enum
- `balance`
- `transfer`
- `recharge`
- `bill_payment`
- `help`
- `confirm`
- `cancel`
- `unknown`

### Semantic Rules For Backend
- `needs_confirmation = true`: do not execute transaction yet. Ask user confirmation first.
- `intent = confirm`: execute the pending operation.
- `intent = cancel`: drop pending operation.
- `intent = unknown`: ask user to rephrase.

### Error Handling
- If Grok is unavailable, service falls back to local parser and still returns HTTP 200 with lower confidence.
- If request payload is invalid, FastAPI returns HTTP 422.

### Recommended Backend Timeout
- 2 to 4 seconds for parse requests.

## Example Flows

### Transfer Flow
1. Backend sends transcript to `/ai/parse`.
2. Receives `intent=transfer`, amount/recipient, and `needs_confirmation=true`.
3. Backend asks user to confirm with `confirmation_message`.
4. User says "Oui".
5. Backend parses "Oui" -> `intent=confirm` and executes transfer.

### Balance Flow
1. Backend sends transcript.
2. Receives `intent=balance`, `needs_confirmation=false`.
3. Backend directly calls balance provider API.
