export type ParseStatus = "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN";

export type FailureReason =
  | "INSUFFICIENT_FUNDS"
  | "INVALID_RECIPIENT"
  | "WRONG_PIN"
  | "TIMEOUT"
  | "NETWORK_ERROR";

export interface ParseResult {
  status: ParseStatus;
  reason?: FailureReason;
  newBalance?: number;
  currency?: string;
  transactionRef?: string;
  rawMessage: string;
}

const SUCCESS_FR = ["réussie", "effectué", "confirmé", "succès", "envoyé", "validé"];
const SUCCESS_EN = ["successful", "completed", "confirmed", "success", "sent", "received"];
const FAIL_FR = ["insuffisant", "invalide", "échoué", "incorrect", "expiré", "introuvable"];
const FAIL_EN = ["insufficient", "invalid", "failed", "incorrect", "expired", "not found", "wrong pin", "wrong"];

/**
 * Analyse une réponse texte renvoyée par le réseau MTN (multilingue).
 */
export function parseMtnResponse(rawMessage: string, countryKeywords?: { success: string[]; failure: string[] }): ParseResult {
  const lower = rawMessage.toLowerCase();
  const successPool = [...SUCCESS_FR, ...SUCCESS_EN, ...(countryKeywords?.success || [])];
  const failPool = [...FAIL_FR, ...FAIL_EN, ...(countryKeywords?.failure || [])];

  let status: ParseStatus = "UNKNOWN";
  if (successPool.some((k) => lower.includes(k.toLowerCase()))) status = "SUCCESS";
  else if (failPool.some((k) => lower.includes(k.toLowerCase()))) status = "FAILED";

  let reason: FailureReason | undefined;
  if (status === "FAILED") {
    if (/insuffisant|insufficient/i.test(rawMessage)) reason = "INSUFFICIENT_FUNDS";
    else if (/pin|incorrect|wrong/i.test(rawMessage)) reason = "WRONG_PIN";
    else if (/invalide|invalid|introuvable|not found/i.test(rawMessage)) reason = "INVALID_RECIPIENT";
    else if (/timeout|expir/i.test(rawMessage)) reason = "TIMEOUT";
    else if (/network|réseau/i.test(rawMessage)) reason = "NETWORK_ERROR";
  }

  const balanceMatch = rawMessage.match(/(\d[\d\s.,]*)\s*(FCFA|GHS|NGN|UGX|RWF|ZMW|LRD|GNF|SDG|SZL|EUR)?/i);
  let newBalance: number | undefined;
  if (balanceMatch) {
    const num = balanceMatch[1].replace(/\s/g, "").replace(",", ".");
    const parsed = parseFloat(num);
    if (!Number.isNaN(parsed)) newBalance = parsed;
  }

  const refMatch = rawMessage.match(/(ref|reference|id)[:\s#]*([A-Z0-9-]+)/i);
  const transactionRef = refMatch ? refMatch[2] : undefined;

  return {
    status,
    reason,
    newBalance,
    currency: balanceMatch?.[2],
    transactionRef,
    rawMessage,
  };
}
