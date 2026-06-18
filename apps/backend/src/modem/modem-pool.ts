import { logger } from "../shared/logger/logger";
import { ModemUnavailableError } from "../shared/errors/app-errors";
import type { ModemConfig } from "../shared/types/modem.types";
import { ModemClient } from "./modem-client";
import { ModemClientMock } from "./modem-mock";
import type { IModemClient } from "./modem.types";

interface LockedModem {
  client: IModemClient;
  country: string;
  inUse: boolean;
}

/**
 * Pool de modems par pays (verrou acquire/release, attente max configurable).
 */
export class ModemPool {
  private readonly pool: LockedModem[] = [];
  private readonly acquireTimeoutMs: number;

  constructor() {
    this.acquireTimeoutMs = Number(process.env.MODEM_ACQUIRE_TIMEOUT_MS) || 30000;
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const useMock =
      process.env.NODE_ENV === "development" || process.env.USE_MOCK_MODEM === "true";
    let idx = 0;
    for (;;) {
      const raw = process.env[`MODEM_${idx}`];
      if (!raw) break;
      try {
        const cfg = JSON.parse(raw) as ModemConfig;
        const client = useMock
          ? new ModemClientMock(cfg.country, Number(process.env.MOCK_FAILURE_RATE) || 0)
          : new ModemClient(cfg.portPath, cfg.country);
        this.pool.push({ client, country: cfg.country.toUpperCase(), inUse: false });
      } catch (e) {
        logger.error("Invalid MODEM_n JSON", { err: e, idx });
      }
      idx += 1;
    }
    if (this.pool.length === 0) {
      logger.warn("Aucun modem configuré — pool vide (jobs échoueront sans mock global).");
    }
  }

  /**
   * Acquiert un modem pour le pays donné ou attend jusqu'à {@link acquireTimeoutMs}.
   */
  async acquire(country: string): Promise<{ client: IModemClient; release: () => void }> {
    const c = country.toUpperCase();
    const useMock =
      process.env.NODE_ENV === "development" || process.env.USE_MOCK_MODEM === "true";

    if (this.pool.length === 0 && useMock) {
      const client = new ModemClientMock(c, Number(process.env.MOCK_FAILURE_RATE) || 0);
      return { client, release: () => {} };
    }

    const deadline = Date.now() + this.acquireTimeoutMs;
    for (;;) {
      const entry = this.pool.find((m) => m.country === c && !m.inUse);
      if (entry) {
        entry.inUse = true;
        return {
          client: entry.client,
          release: () => {
            entry.inUse = false;
          },
        };
      }
      if (Date.now() > deadline) {
        throw new ModemUnavailableError(
          "Notre service est momentanément surchargé. Veuillez réessayer dans quelques instants."
        );
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  getPoolStatus(): { country: string; inUse: boolean }[] {
    return this.pool.map((m) => ({ country: m.country, inUse: m.inUse }));
  }
}

export const modemPool = new ModemPool();
