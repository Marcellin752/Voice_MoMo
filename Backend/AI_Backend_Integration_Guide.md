# Backend Integration Guide - NLP Module

This guide helps backend engineers integrate the AI parser quickly and safely.

## 1) What The NLP Module Does
- Input: transcript text from voice recognition.
- Output: structured intent and entities for Mobile Money actions.
- Provider chain:
  - Primary: Grok API (`XAI_API_KEY`).
  - Fallback: local regex parser when provider fails.

## 2) Integration Checklist
- Run NLP service on internal URL (example `http://nlp-service:8001`).
- Configure backend env:
  - `NLP_BASE_URL`
  - `NLP_TIMEOUT_SECONDS`
- Call `/ai/parse` for each user utterance.
- Persist a short pending-action state per session/user.
- Require explicit confirmation before sensitive execution.

## 3) Minimal State Machine
- `IDLE`: waiting for new request.
- `PENDING_CONFIRMATION`: waiting for user yes/no.

Transitions:
- `IDLE` + parse(intent with `needs_confirmation=true`) -> `PENDING_CONFIRMATION`
- `PENDING_CONFIRMATION` + parse(`confirm`) -> execute action -> `IDLE`
- `PENDING_CONFIRMATION` + parse(`cancel`) -> discard action -> `IDLE`
- `PENDING_CONFIRMATION` + parse(other) -> ask yes/no again

## 4) Recommended Backend Flow
1. Receive transcript from app.
2. Call NLP `/ai/parse`.
3. If `intent=unknown`: return help prompt.
4. If `needs_confirmation=true`: store pending action and ask confirmation.
5. If `intent=confirm` and pending exists: execute provider transaction.
6. If `intent=cancel`: clear pending and return cancel message.
7. For non-sensitive intents (`balance`, `help`): process directly.

## 5) Confidence Policy
- `confidence >= 0.80`: auto-accept parse.
- `0.55 <= confidence < 0.80`: ask a short clarification if transaction amount/recipient missing.
- `< 0.55`: ask user to rephrase.

## 6) Validation Rules Before Execution
- Transfer:
  - amount > 0
  - recipient exists and maps to contact/number
- Recharge:
  - amount > 0
- Bill payment:
  - bill type recognized (`electricite`, `eau`, `internet`)
  - amount > 0

## 7) Security And Reliability
- Never execute financial actions from parse output alone.
- Always require user confirmation for transfer/recharge/bill payment.
- Add idempotency key to transaction requests.
- Log parse request/response with PII masking.
- Circuit-break NLP calls if provider latency spikes.

## 8) Copy-Paste Clients
Ready examples are available in:
- `Backend/examples/ai_client_python.py`
- `Backend/examples/ai_client_node.mjs`

## 9) Team Handoff Tips
- Keep API contract stable (see `Backend/AI_API_Contract.md`).
- If adding new intent/entity, update both:
  - NLP parser model schema
  - backend execution mapping table
