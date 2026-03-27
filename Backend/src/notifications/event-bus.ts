import IORedis from "ioredis";
import { logger } from "../shared/logger/logger";

let publisher: IORedis | null = null;

function getPublisher(): IORedis {
  if (!publisher) {
    publisher = new IORedis({
      host: process.env.REDIS_HOST || "localhost",
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }
  return publisher;
}

export const USSD_EVENT_CHANNEL = "ussd:events";

/**
 * Publie un événement de fin de transaction (API + WebSocket).
 */
export async function publishUssdEvent(payload: Record<string, unknown>): Promise<void> {
  try {
    await getPublisher().publish(USSD_EVENT_CHANNEL, JSON.stringify(payload));
  } catch (e) {
    logger.error("publishUssdEvent failed", { err: e });
  }
}
