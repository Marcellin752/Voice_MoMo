import "dotenv/config";
import { logger } from "./shared/logger/logger";
import { startUssdWorker } from "./queue/ussd-worker";

startUssdWorker();
logger.info("Worker USSD BullMQ démarré.");
