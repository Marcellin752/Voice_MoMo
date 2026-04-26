PARSER_CONTRACT = {
    "intents": [
        "balance",
        "transfer",
        "withdraw",
        "recharge",
        "bill_payment",
        "help",
        "confirm",
        "cancel",
        "unknown",
    ],
    "required_keys": [
        "intent",
        "amount",
        "currency",
        "recipient",
        "bill_type",
        "needs_confirmation",
        "confidence",
    ],
}
