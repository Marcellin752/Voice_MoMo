import { Queue } from "bullmq";
import { createRedisConnection } from "../redis-connection";
import type { UssdJobPayload } from "../shared/types/transaction.types";

let queue: Queue<UssdJobPayload> | null = null;

/** Si false, aucune connexion Redis pour BullMQ (API legacy + HTTP seulement). */
export function isUssdQueueAvailable(): boolean {
  return process.env.SKIP_REDIS !== "true";
}

export function getUssdQueue(): Queue<UssdJobPayload> {
  if (!isUssdQueueAvailable()) {
    throw new Error("SKIP_REDIS=true — file USSD désactivée");
  }
  if (!queue) {
    const connection = createRedisConnection();
    queue = new Queue<UssdJobPayload>("ussd-jobs", {
      connection,
      defaultJobOptions: {
        attempts: Number(process.env.MAX_RETRY_ATTEMPTS) || 3,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return queue;
}

/** Conservé pour les tests Jest (mock du module) et appels style `ussdQueue.add`. */
export const ussdQueue = {
  add(...args: Parameters<Queue<UssdJobPayload>["add"]>) {
    return getUssdQueue().add(...args);
  },
  getJob(jobId: string) {
    return getUssdQueue().getJob(jobId);
  },
};
