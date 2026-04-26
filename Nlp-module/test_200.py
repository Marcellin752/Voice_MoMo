import sys
from app.entity_normalizer import extract_amount_and_phone, normalize_parsed_entities
from app.models import ParseCommandResponse, Intent, ParseMetadata

text = "un forfait 200f tout de suite"
am, ph = extract_amount_and_phone(text)
print(f"Amount extracted: {am}, Phone: {ph}")

# Test normalizer with simulated Gemini return
parsed = ParseCommandResponse(
    intent=Intent.TRANSFER, # Gemini hallucinates transfer
    amount=2000, # Gemini hallucinates 2000
    recipient=None,
    bill_type=None,
    needs_confirmation=False,
    confirmation_message="",
    understood_text=text,
    metadata=ParseMetadata(**{"provider":"test", "model":"test", "confidence":1.0, "raw_output":text})
)

final = normalize_parsed_entities(parsed)
print(f"Final intent: {final.intent.value}")
print(f"Final amount: {final.amount}")
print(f"Needs confirmation: {final.needs_confirmation}")

