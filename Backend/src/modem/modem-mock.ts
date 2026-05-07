import type { SupportedCountry } from "../shared/constants/countries";
import type { TransactionAction } from "../shared/types/api.types";
import { logger } from "../shared/logger/logger";
import type { IModemClient } from "./modem.types";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randStep(): number {
  return 2000 + Math.floor(Math.random() * 2000);
}

const MOCK_BALANCE = 23500;

/**
 * Réponses USSD simulées pour le développement sans modem physique.
 */
export const MOCK_RESPONSES: Record<
  string,
  Partial<
    Record<
      TransactionAction | "default",
      { success: string; insufficient?: string; balance?: string }
    >
  >
> = {
  BJ: {
    transfer: {
      success:
        "Transaction réussie. {amount} FCFA envoyés à {to}. Nouveau solde: {balance} FCFA.",
      insufficient: "Fonds insuffisants. Solde actuel: {balance} FCFA.",
    },
    withdraw: {
      success: "Retrait autorisé. Veuillez vous présenter au GAB le plus proche.",
      insufficient: "Montant demandé dépasse votre limite.",
    },
    balance: { success: "Votre solde MoMo est de {balance} FCFA.", balance: "Votre solde MoMo est de {balance} FCFA." },
    billPayment: {
      success: "Paiement de {amount} FCFA effectué au marchand. Nouveau solde: {balance} FCFA.",
      insufficient: "Fonds insuffisants pour ce paiement.",
    },
    airtime: {
      success: "Forfait acheté avec succès. {amount} FCFA débité. Nouveau solde: {balance} FCFA.",
      insufficient: "Solde insuffisant pour ce forfait.",
    },
    miniStatement: { success: "Relevé: 3 dernières transactions affichées." },
    default: { success: "Opération effectuée avec succès." },
  },
  NG: {
    transfer: {
      success: "Successful. {amount} NGN sent to {to}. New balance: {balance} NGN.",
      insufficient: "Insufficient funds. Balance: {balance} NGN.",
    },
    withdraw: {
      success: "Withdrawal approved. Visit nearest ATM.",
      insufficient: "Amount exceeds your limit.",
    },
    balance: { success: "Your balance is {balance} NGN." },
    billPayment: {
      success: "Payment of {amount} NGN completed. New balance: {balance} NGN.",
      insufficient: "Insufficient balance for payment.",
    },
    airtime: {
      success: "Plan purchased successfully. {amount} NGN charged. Balance: {balance} NGN.",
      insufficient: "Insufficient balance for this plan.",
    },
    default: { success: "Operation completed." },
  },
};

/**
 * Client modem simulé (délais 2–4s par étape, PIN 1234 ou 0000 acceptés).
 */
export class ModemClientMock implements IModemClient {
  constructor(
    private readonly country: string,
    private readonly failureRate: number = 0
  ) {}

  async connect(): Promise<void> {
    await delay(randStep());
    logger.info("mock connect", { modem: "mock", country: this.country });
  }

  async sendUSSD(code: string): Promise<string> {
    await delay(randStep());
    if (Math.random() < this.failureRate) {
      return "Network error. Please try again.";
    }
    return `+CUSD: 1,"Menu MTN. 1. Transfert 2. Solde",15`;
  }

  async replyUSSD(response: string): Promise<string> {
    await delay(randStep());
    const pin = response.replace(/\D/g, "");
    if (pin && pin !== "1234" && pin !== "0000") {
      return `+CUSD: 2,"PIN incorrect.",15`;
    }
    return `+CUSD: 0,"Transaction réussie.",15`;
  }

  async cancelUSSD(): Promise<void> {
    await delay(200);
  }

  async isAlive(): Promise<boolean> {
    return true;
  }

  async getSignalStrength(): Promise<number> {
    return 20;
  }

  async disconnect(): Promise<void> {
    logger.info("mock disconnect");
  }
}

/**
 * Génère un message MTN simulé final selon pays / action / params.
 */
export function buildMockFinalMessage(
  country: string,
  action: TransactionAction,
  params: Record<string, unknown>,
  failInsufficient: boolean
): string {
  const c = country.toUpperCase() as SupportedCountry;
  const pool = MOCK_RESPONSES[c] || MOCK_RESPONSES.BJ;
  const to = String(params.to ?? "");
  const amount = Number(params.amount ?? 0);
  const balance = MOCK_BALANCE;
  const templ =
    action === "balance" || action === "miniStatement"
      ? pool.balance?.success || pool.balance?.balance || pool.transfer?.success
      : pool.transfer?.success || pool.default?.success;

  if (failInsufficient && pool.transfer?.insufficient) {
    return pool.transfer.insufficient
      .replace("{balance}", String(balance))
      .replace("{amount}", String(amount))
      .replace("{to}", to);
  }
  if (!templ) return "Transaction réussie.";
  return templ
    .replace("{amount}", String(amount))
    .replace("{to}", to)
    .replace("{balance}", String(balance));
}
