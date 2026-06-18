/** Codes pays ISO supportés MTN (sous-ensemble USSD). */
export const SUPPORTED_COUNTRIES = [
  "BJ",
  "NG",
  "GH",
  "UG",
  "RW",
  "CM",
  "CI",
  "ZM",
  "LR",
  "GN",
  "CG",
  "SD",
  "SZ",
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];
