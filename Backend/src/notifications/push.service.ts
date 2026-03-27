import { logger } from "../shared/logger/logger";

/**
 * Envoi FCM (stub — brancher avec FCM_SERVER_KEY en production).
 */
export async function sendPushNotification(_userId: string, _title: string, _body: string): Promise<void> {
  if (!process.env.FCM_SERVER_KEY) {
    logger.debug("FCM non configuré — notification push ignorée.");
    return;
  }
  logger.info("FCM stub: notification would be sent.");
}
