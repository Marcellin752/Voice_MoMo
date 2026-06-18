import { logger } from "../shared/logger/logger";
import type { ModemPool } from "./modem-pool";

const INTERVAL = Number(process.env.HEALTHCHECK_INTERVAL) || 60000;

/**
 * Lance un healthcheck périodique sur les modems du pool.
 */
export function startModemHealthcheck(pool: ModemPool): NodeJS.Timeout {
  return setInterval(() => {
    const status = pool.getPoolStatus();
    logger.info("modem pool health", { modems: status });
  }, INTERVAL);
}
