import { getCountryConfig } from "../country-router/country-router";
import type { ParseResult } from "../ussd-session/session-parser";

/**
 * Formate un montant pour la lecture vocale (FR: espaces milliers).
 */
export function formatAmountForVoice(amount: number, lang: "fr" | "en"): string {
  if (lang === "en") {
    return amount.toLocaleString("en-US");
  }
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Formate un numéro pour la lecture vocale (FR groupes de 2).
 */
export function formatPhoneForVoice(phone: string, lang: "fr" | "en"): string {
  const digits = phone.replace(/\D/g, "");
  if (lang === "en") {
    return digits.split("").join(" ");
  }
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return local.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export interface VoiceContext {
  country: string;
  action: string;
  amount?: number;
  to?: string;
  balance?: number;
  currency?: string;
}

/**
 * Génère une phrase naturelle pour le TTS selon le résultat technique.
 */
export function buildVoiceResponse(
  lang: "fr" | "en",
  parse: ParseResult,
  ctx: VoiceContext
): string {
  const cfg = getCountryConfig(ctx.country);
  const currency = ctx.currency || cfg.currency;
  const amountStr =
    ctx.amount !== undefined ? formatAmountForVoice(ctx.amount, lang) : "";
  const toStr = ctx.to ? formatPhoneForVoice(ctx.to, lang) : "";

  if (parse.status === "PENDING" || parse.status === "UNKNOWN") {
    return lang === "fr"
      ? "Votre demande est en cours de traitement. Je vous confirme le résultat dans quelques secondes."
      : "Your request is being processed. I will confirm the result in a few seconds.";
  }

  if (parse.status === "SUCCESS") {
    if (ctx.action === "balance" || ctx.action === "miniStatement") {
      const bal = parse.newBalance ?? ctx.balance;
      return lang === "fr"
        ? `Votre solde MTN MoMo est de ${formatAmountForVoice(bal ?? 0, lang)} ${currency}.`
        : `Your MTN MoMo balance is ${formatAmountForVoice(bal ?? 0, lang)} ${currency}.`;
    }
    return lang === "fr"
      ? `Parfait ! Le transfert de ${amountStr} ${currency} vers le ${toStr} a bien été effectué.`
      : `Done! The transfer of ${amountStr} ${currency} to ${toStr} was successful.`;
  }

  if (parse.reason === "INSUFFICIENT_FUNDS") {
    const bal = parse.newBalance ?? ctx.balance ?? 0;
    return lang === "fr"
      ? `Désolé, votre solde est insuffisant pour effectuer cette opération. Votre solde actuel est de ${formatAmountForVoice(bal, lang)} ${currency}.`
      : `Sorry, your balance is insufficient. Your current balance is ${formatAmountForVoice(bal, lang)} ${currency}.`;
  }

  if (parse.reason === "INVALID_RECIPIENT") {
    return lang === "fr"
      ? `Le numéro ${toStr} ne semble pas être un compte MTN MoMo valide. Veuillez vérifier le numéro.`
      : `The number ${toStr} does not appear to be a valid MTN MoMo account. Please check the number.`;
  }

  return lang === "fr"
    ? "L'opération n'a pas pu aboutir. Veuillez réessayer dans quelques instants."
    : "The operation could not be completed. Please try again shortly.";
}

/**
 * Message vocal immédiat après enqueue (non-bloquant).
 */
export function buildPendingVoiceResponse(lang: "fr" | "en", ctx: VoiceContext): string {
  const cfg = getCountryConfig(ctx.country);
  const currency = cfg.currency;
  if (ctx.action === "transfer" || ctx.action === "sendToBank") {
    const amt = ctx.amount ?? 0;
    const to = ctx.to ? formatPhoneForVoice(ctx.to, lang) : "";
    return lang === "fr"
      ? `Bien reçu. J'effectue le transfert de ${formatAmountForVoice(amt, lang)} ${currency} vers le ${to}. Veuillez patienter quelques secondes.`
      : `Received. I am processing the transfer of ${formatAmountForVoice(amt, lang)} ${currency} to ${to}. Please wait a few seconds.`;
  }
  return lang === "fr"
    ? "Bien reçu. Je traite votre demande, veuillez patienter quelques secondes."
    : "Received. I am processing your request; please wait a few seconds.";
}
