import { logger } from "../shared/logger/logger";
import { createRedisConnection } from "../redis-connection";

let publisher: ReturnType<typeof createRedisConnection> | null = null;

function getPublisher(): ReturnType<typeof createRedisConnection> {
  if (!publisher) {
    publisher = createRedisConnection();
  }
  return publisher;
}

export const USSD_EVENT_CHANNEL = "ussd:events";

/**
 * Publie un événement de fin de transaction (API + WebSocket).
 */
export async function publishUssdEvent(payload: Record<string, unknown>): Promise<void> {
  if (process.env.SKIP_REDIS === "true") {
    return;
  }
  try {
    await getPublisher().publish(USSD_EVENT_CHANNEL, JSON.stringify(payload));
  } catch (e) {
    logger.error("publishUssdEvent failed", { err: e });
  }
}
