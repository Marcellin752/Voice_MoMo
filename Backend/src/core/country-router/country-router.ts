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
 * Supporte les actions principales et spécialisées (forfaits, retrait GAB, etc.)
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
  const number = String(params.number ?? params.phone ?? "");
  const airtimeType = String(params.airtimeType ?? params.forfaitType ?? "");

  switch (action) {
    case "transfer":
      return cfg.transfer.replace("{to}", to).replace("{amount}", amount);
    
    case "withdraw":
      // Support retrait GAB UBA si spécifié
      if ((params.type === "gab" || params.gab === true) && cfg.withdrawGAB) {
        return cfg.withdrawGAB;
      }
      return cfg.withdraw;
    
    case "balance":
    case "miniStatement":
      return cfg.balance;
    
    case "billPayment":
      return cfg.billPayment.replace("{ref}", ref);
    
    case "airtime":
      // Support forfaits spécialisés (Go Pack, Internet, etc.)
      if (airtimeType === "gopack-jour" && cfg.airtimeGoPackJour) {
        return cfg.airtimeGoPackJour.replace("{number}", number);
      }
      if (airtimeType === "gopack-semaine" && cfg.airtimeGoPackSemaine) {
        return cfg.airtimeGoPackSemaine.replace("{number}", number);
      }
      if (airtimeType === "gopack-mois" && cfg.airtimeGoPackMois) {
        return cfg.airtimeGoPackMois.replace("{number}", number);
      }
      if (airtimeType === "internet-jour" && cfg.airtimeInternetJour) {
        return cfg.airtimeInternetJour.replace("{number}", number);
      }
      if (airtimeType === "internet-semaine" && cfg.airtimeInternetSemaine) {
        return cfg.airtimeInternetSemaine.replace("{number}", number);
      }
      if (airtimeType === "internet-mois" && cfg.airtimeInternetMois) {
        return cfg.airtimeInternetMois.replace("{number}", number);
      }
      // Fallback au crédit simple
      return cfg.airtime.replace("{amount}", amount);
    
    case "sendToBank":
      return cfg.transfer.replace("{to}", to).replace("{amount}", amount);
    
    default:
      throw new AppError(`Action inconnue: ${action}`, "UNKNOWN_ACTION", 400);
  }
}
