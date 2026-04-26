from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class Intent(str, Enum):
    BALANCE = "balance"
    TRANSFER = "transfer"
    WITHDRAW = "withdraw"
    RECHARGE = "recharge"
    BILL_PAYMENT = "bill_payment"
    HELP = "help"
    CONFIRM = "confirm"
    CANCEL = "cancel"
    UNKNOWN = "unknown"


class ParseCommandRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    locale: str = Field(default="fr-FR")


class ParseMetadata(BaseModel):
    provider: str = "fallback"
    model: str | None = None
    confidence: float = 0.0
    raw_output: str | None = None


class ParseCommandResponse(BaseModel):
    intent: Intent
    amount: int | None = None
    currency: str = "XOF"
    recipient: str | None = None
    bill_type: str | None = None
    needs_confirmation: bool = False
    confirmation_message: str | None = None
    understood_text: str
    metadata: ParseMetadata


class GrokMessage(BaseModel):
    role: str
    content: str


class GrokRequest(BaseModel):
    model: str
    messages: list[GrokMessage]
    temperature: float = 0.1


class GrokChoiceMessage(BaseModel):
    content: str


class GrokChoice(BaseModel):
    message: GrokChoiceMessage


class GrokResponse(BaseModel):
    id: str | None = None
    choices: list[GrokChoice] = Field(default_factory=list)


class ErrorResponse(BaseModel):
    detail: str
    context: dict[str, Any] | None = None
