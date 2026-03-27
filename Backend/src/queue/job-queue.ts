import { Queue } from "bullmq";
import { logger } from "../shared/logger/logger";
import type { UssdJobPayload } from "../shared/types/transaction.types";
import { createRedisConnection } from "../redis-connection";

const connection = createRedisConnection();

connection.on("error", (err) => {
  logger.error("Redis connection error", { err });
});

/**
 * File BullMQ pour les jobs USSD.
 */
export const ussdQueue = new Queue<UssdJobPayload>("ussd-jobs", {
  connection,
  defaultJobOptions: {
    attempts: Number(process.env.MAX_RETRY_ATTEMPTS) || 3,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});
