import type { SupportedCountry } from "../../shared/constants/countries";
import type { TransactionAction } from "../../shared/types/api.types";

export interface CountryUssdConfig {
  root: string;
  transfer: string;
  withdraw: string;
  balance: string;
  billPayment: string;
  airtime: string;
  menuFlow: string[];
  currency: string;
  language: "fr" | "en";
  successKeywords: string[];
  failureKeywords: string[];
  // Additional codes for specialized operations
  withdrawGAB?: string; // Retrait GAB UBA
  airtimeGoPackJour?: string;
  airtimeGoPackSemaine?: string;
  airtimeGoPackMois?: string;
  airtimeInternetJour?: string;
  airtimeInternetSemaine?: string;
  airtimeInternetMois?: string;
}

/**
 * Configuration complète des codes USSD MTN par pays (menus indicatifs).
 */
export const USSD_CODES: Record<SupportedCountry, CountryUssdConfig> = {
  BJ: {
    root: "*880#",
    transfer: "*880*1*1*{to}*{to}*{amount}#",
    withdraw: "*880*2#",
    balance: "*880*9#",
    billPayment: "*880*5#",
    airtime: "*880*4*{amount}#",
    withdrawGAB: "*880*724#", // Retrait GAB UBA
    airtimeGoPackJour: "*840*172*1*{number}#",
    airtimeGoPackSemaine: "*840*172*2*{number}#",
    airtimeGoPackMois: "*840*172*3*{number}#",
    airtimeInternetJour: "*840*123*1*{number}#",
    airtimeInternetSemaine: "*840*123*2*{number}#",
    airtimeInternetMois: "*840*123*3*{number}#",
    menuFlow: ["ENTER_PIN", "CONFIRM"],
    currency: "FCFA",
    language: "fr",
    successKeywords: ["réussie", "effectué", "confirmé", "succès", "envoyé", "successful", "confirmed", "success"],
    failureKeywords: ["insuffisant", "invalide", "échoué", "incorrect", "insufficient", "invalid", "failed", "wrong"],
  },
  NG: {
    root: "*671#",
    transfer: "*671*1*{to}*{amount}#",
    withdraw: "*671*3#",
    balance: "*671*0#",
    billPayment: "*671*5*{ref}#",
    airtime: "*671*4*{amount}#",
    menuFlow: ["ENTER_PIN"],
    currency: "NGN",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent", "réussie", "succès"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect", "insuffisant", "échoué"],
  },
  GH: {
    root: "*170#",
    transfer: "*170*1*{to}*{amount}#",
    withdraw: "*170*3#",
    balance: "*170*7#",
    billPayment: "*170*5#",
    airtime: "*170*6*{amount}#",
    menuFlow: ["ENTER_PIN", "CONFIRM"],
    currency: "GHS",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent", "réussie"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  UG: {
    root: "*165#",
    transfer: "*165*3*{to}*{amount}#",
    withdraw: "*165*2#",
    balance: "*185*8*1#",
    billPayment: "*165*5#",
    airtime: "*165*1#",
    menuFlow: ["ENTER_PIN"],
    currency: "UGX",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  RW: {
    root: "*182#",
    transfer: "*182*1*{to}*{amount}#",
    withdraw: "*182*2#",
    balance: "*182*6*1#",
    billPayment: "*182*5#",
    airtime: "*182*3#",
    menuFlow: ["ENTER_PIN"],
    currency: "RWF",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent", "réussie"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  CM: {
    root: "*126#",
    transfer: "*126*1*{to}*{amount}#",
    withdraw: "*126*2#",
    balance: "*126*9#",
    billPayment: "*126*5#",
    airtime: "*126*4#",
    menuFlow: ["ENTER_PIN", "CONFIRM"],
    currency: "FCFA",
    language: "fr",
    successKeywords: ["réussie", "effectué", "confirmé", "succès", "successful", "confirmed"],
    failureKeywords: ["insuffisant", "invalide", "échoué", "incorrect", "insufficient", "failed"],
  },
  CI: {
    root: "*133#",
    transfer: "*133*1*{to}*{amount}#",
    withdraw: "*133*2#",
    balance: "*133*1#",
    billPayment: "*133*5#",
    airtime: "*133*3#",
    menuFlow: ["ENTER_PIN"],
    currency: "FCFA",
    language: "fr",
    successKeywords: ["réussie", "effectué", "confirmé", "succès", "successful"],
    failureKeywords: ["insuffisant", "invalide", "échoué", "incorrect", "failed"],
  },
  ZM: {
    root: "*303#",
    transfer: "*303*1*{to}*{amount}#",
    withdraw: "*303*3#",
    balance: "*303*5#",
    billPayment: "*303*4#",
    airtime: "*303*2#",
    menuFlow: ["ENTER_PIN"],
    currency: "ZMW",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  LR: {
    root: "*156#",
    transfer: "*156*1*{to}*{amount}#",
    withdraw: "*156*3#",
    balance: "*156*9#",
    billPayment: "*156*5#",
    airtime: "*156*4#",
    menuFlow: ["ENTER_PIN"],
    currency: "LRD",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  GN: {
    root: "*555#",
    transfer: "*555*1*{to}*{amount}#",
    withdraw: "*555*2#",
    balance: "*555*9#",
    billPayment: "*555*5#",
    airtime: "*555*4#",
    menuFlow: ["ENTER_PIN"],
    currency: "GNF",
    language: "fr",
    successKeywords: ["réussie", "effectué", "confirmé", "succès", "successful"],
    failureKeywords: ["insuffisant", "invalide", "échoué", "incorrect", "failed"],
  },
  CG: {
    root: "*126#",
    transfer: "*126*1*{to}*{amount}#",
    withdraw: "*126*2#",
    balance: "*126*9#",
    billPayment: "*126*5#",
    airtime: "*126*4#",
    menuFlow: ["ENTER_PIN", "CONFIRM"],
    currency: "FCFA",
    language: "fr",
    successKeywords: ["réussie", "effectué", "confirmé", "succès", "successful"],
    failureKeywords: ["insuffisant", "invalide", "échoué", "incorrect", "failed"],
  },
  SD: {
    root: "*901#",
    transfer: "*901*1*{to}*{amount}#",
    withdraw: "*901*3#",
    balance: "*901*9#",
    billPayment: "*901*5#",
    airtime: "*901*4#",
    menuFlow: ["ENTER_PIN"],
    currency: "SDG",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
  SZ: {
    root: "*115#",
    transfer: "*115*1*{to}*{amount}#",
    withdraw: "*115*3#",
    balance: "*115*9#",
    billPayment: "*115*5#",
    airtime: "*115*4#",
    menuFlow: ["ENTER_PIN"],
    currency: "SZL",
    language: "en",
    successKeywords: ["successful", "completed", "confirmed", "sent"],
    failureKeywords: ["insufficient", "invalid", "failed", "incorrect"],
  },
};
