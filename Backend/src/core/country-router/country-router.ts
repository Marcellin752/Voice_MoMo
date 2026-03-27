import { SUPPORTED_COUNTRIES, type SupportedCountry } from "../../shared/constants/countries";
import { AppError } from "../../shared/errors/app-errors";
import type { TransactionAction } from "../../shared/types/api.types";
import { USSD_CODES, type CountryUssdConfig } from "./ussd-codes.config";

/**
 * Retourne la configuration USSD pour un pays.
 */
export function getCountryConfig(country: string): CountryUssdConfig {
  const c = country.toUpperCase() as SupportedCountry;
  if (!SUPPORTED_COUNTRIES.includes(c)) {
    throw new AppError(`Pays non supporté: ${country}`, "UNSUPPORTED_COUNTRY", 400);
  }
  return USSD_CODES[c];
}

/**
 * Construit la chaîne USSD initiale pour une action.
 */
export function buildInitialUssdCode(
  country: string,
  action: TransactionAction,
  params: Record<string, unknown>
): string {
  const cfg = getCountryConfig(country);
  const to = String(params.to ?? params.recipient ?? "");
  const amount = String(params.amount ?? "");
  const ref = String(params.ref ?? params.billRef ?? "1");

  switch (action) {
    case "transfer":
      return cfg.transfer.replace("{to}", to).replace("{amount}", amount);
    case "withdraw":
      return cfg.withdraw;
    case "balance":
    case "miniStatement":
      return cfg.balance;
    case "billPayment":
      return cfg.billPayment.replace("{ref}", ref);
    case "airtime":
      return cfg.airtime.replace("{amount}", amount);
    case "sendToBank":
      return cfg.transfer.replace("{to}", to).replace("{amount}", amount);
    default:
      throw new AppError(`Action inconnue: ${action}`, "UNKNOWN_ACTION", 400);
  }
}
