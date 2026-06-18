import { Worker, type Job } from "bullmq";
import { logger } from "../shared/logger/logger";
import { createRedisConnection } from "../redis-connection";
import type { UssdJobPayload } from "../shared/types/transaction.types";
import { runUssdSession } from "../core/ussd-session/ussd-session";
import * as transactionRepository from "../db/repositories/transaction.repository";
import { publishUssdEvent } from "../notifications/event-bus";
import { sendPushNotification } from "../notifications/push.service";
import { buildVoiceResponse } from "../core/voice-adapter/voice-adapter";
import { getCountryConfig } from "../core/country-router/country-router";
import { parseMtnResponse } from "../core/ussd-session/session-parser";

const JOB_MS = Number(process.env.JOB_TIMEOUT) || 120000;

/**
 * Démarre le worker BullMQ qui exécute les sessions USSD.
 */
export function startUssdWorker(): Worker<UssdJobPayload> {
  const connection = createRedisConnection();

  const worker = new Worker<UssdJobPayload>(
    "ussd-jobs",
    async (job: Job<UssdJobPayload>) => {
      const jobId = job.id as string;
      await transactionRepository.updateTransactionByJobId(jobId, { status: "PROCESSING" });

      try {
        const result = await Promise.race([
          runUssdSession(job.data),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("JOB_TIMEOUT")), JOB_MS)
          ),
        ]);

        const ok = result.parse.status === "SUCCESS";
        await transactionRepository.updateTransactionByJobId(jobId, {
          status: ok ? "COMPLETED" : "FAILED",
          mtnResponse: result.mtnMessage,
          voiceResponse: result.voiceResponse,
          mtnRef: result.parse.transactionRef,
          failureReason: ok ? undefined : result.parse.reason || "MTN_REJECTED",
        });

        await publishUssdEvent({
          event: ok ? "transaction:completed" : "transaction:failed",
          jobId,
          userId: job.data.userId,
          voiceResponse: result.voiceResponse,
          success: ok,
        });

        await sendPushNotification(
          job.data.userId,
          "MTN MoMo",
          result.voiceResponse.slice(0, 120)
        );

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("ussd job failed", { jobId, err: msg });

        const cfg = getCountryConfig(job.data.country);
        const failParse = parseMtnResponse(msg, {
          success: cfg.successKeywords,
          failure: cfg.failureKeywords,
        });
        const voiceResponse = buildVoiceResponse(cfg.language, failParse, {
          country: job.data.country,
          action: job.data.action,
          amount: Number(job.data.params.amount ?? 0),
          to: String(job.data.params.to ?? ""),
        });

        await transactionRepository.updateTransactionByJobId(jobId, {
          status: "FAILED",
          failureReason: msg,
          mtnResponse: msg,
          voiceResponse,
          retryCount: job.attemptsMade,
        });

        await publishUssdEvent({
          event: "transaction:failed",
          jobId,
          userId: job.data.userId,
          voiceResponse,
          success: false,
        });

        throw err;
      }
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    logger.error("worker job failed event", { jobId: job?.id, err });
  });

  return worker;
}
