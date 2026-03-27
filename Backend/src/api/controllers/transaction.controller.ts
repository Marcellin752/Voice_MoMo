import type { Request, Response, NextFunction } from "express";
import type { Job } from "bullmq";
import { z } from "zod";
import { randomUUID } from "crypto";
import { AppError } from "../../shared/errors/app-errors";
import type { TransactionAction } from "../../shared/types/api.types";
import { SUPPORTED_COUNTRIES } from "../../shared/constants/countries";
import { getCountryConfig } from "../../core/country-router/country-router";
import { buildPendingVoiceResponse } from "../../core/voice-adapter/voice-adapter";
import * as transactionRepository from "../../db/repositories/transaction.repository";
import { getUssdQueue, isUssdQueueAvailable, ussdQueue } from "../../queue/job-queue";
import { logger } from "../../shared/logger/logger";

const actionSchema = z.enum([
  "transfer",
  "withdraw",
  "balance",
  "billPayment",
  "airtime",
  "miniStatement",
  "sendToBank",
]);

const bodySchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().uuid(),
  country: z
    .string()
    .refine((c) => (SUPPORTED_COUNTRIES as readonly string[]).includes(c), "Pays non supporté"),
  action: actionSchema,
  params: z.record(z.string(), z.unknown()),
  encryptedPin: z.string().min(1),
});

/**
 * POST /api/v1/transaction — enqueue job USSD (réponse rapide).
 */
export async function postTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Payload invalide.", details: parsed.error.flatten() });
      return;
    }
    const body = parsed.data;
    if (!req.user || req.user.userId !== body.userId) {
      res.status(403).json({ error: "userId ne correspond pas au token." });
      return;
    }

    if (!isUssdQueueAvailable()) {
      res.status(503).json({
        error:
          "POST /api/v1/transaction désactivé (SKIP_REDIS=true). Mettez SKIP_REDIS=false et démarrez Redis (npm run dev:redis), ou utilisez uniquement l’API legacy.",
        code: "REDIS_DISABLED",
      });
      return;
    }

    const jobId = randomUUID();
    const amount =
      body.params.amount !== undefined ? Number(body.params.amount) : undefined;
    const toNum = body.params.to !== undefined ? String(body.params.to) : undefined;

    await transactionRepository.createPendingTransaction({
      userId: body.userId,
      jobId,
      action: body.action,
      country: body.country,
      toNumber: toNum,
      amount: Number.isFinite(amount) ? amount : undefined,
    });

    const payload = {
      sessionId: body.sessionId,
      userId: body.userId,
      country: body.country,
      action: body.action as TransactionAction,
      params: body.params,
      encryptedPin: body.encryptedPin,
    };

    try {
      await ussdQueue.add("execute-ussd", payload, {
        jobId,
        attempts: Number(process.env.MAX_RETRY_ATTEMPTS) || 3,
        backoff: { type: "exponential", delay: 5000 },
      });
    } catch (e) {
      logger.error("queue add failed", { err: e });
      await transactionRepository.updateTransactionByJobId(jobId, {
        status: "FAILED",
        failureReason: "QUEUE_UNAVAILABLE",
      });
      throw new AppError("Service temporairement indisponible.", "QUEUE_UNAVAILABLE", 503);
    }

    const cfg = getCountryConfig(body.country);
    const voiceResponse = buildPendingVoiceResponse(cfg.language, {
      country: body.country,
      action: body.action,
      amount: Number(body.params.amount ?? 0),
      to: String(body.params.to ?? ""),
    });

    res.status(201).json({
      jobId,
      status: "pending",
      estimatedSeconds: 12,
      voiceResponse,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/transaction/:jobId/status
 */
export async function getTransactionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { jobId } = req.params;
    const row = await transactionRepository.findByJobId(jobId);
    if (!row) {
      res.status(404).json({ error: "Job introuvable." });
      return;
    }
    if (req.user?.userId !== row.userId) {
      res.status(403).json({ error: "Accès refusé." });
      return;
    }

    let status: "pending" | "processing" | "completed" | "failed" = "pending";
    if (row.status === "PENDING") status = "pending";
    if (row.status === "PROCESSING") status = "processing";
    if (row.status === "COMPLETED") status = "completed";
    if (row.status === "FAILED") status = "failed";

    let job: Job | undefined;
    if (isUssdQueueAvailable()) {
      try {
        job = await getUssdQueue().getJob(jobId);
      } catch (e) {
        logger.warn("statut BullMQ indisponible", { err: e });
      }
    }
    if (job && (status === "pending" || status === "processing")) {
      const st = await job.getState();
      if (st === "active") status = "processing";
      else if (st === "waiting" || st === "delayed") status = "pending";
    }

    let result:
      | {
          success: boolean;
          mtnMessage: string;
          voiceResponse: string;
          transactionId: string;
        }
      | undefined;

    if (row.status === "COMPLETED") {
      result = {
        success: !row.failureReason,
        mtnMessage: row.mtnResponse || "",
        voiceResponse: row.voiceResponse || "",
        transactionId: row.mtnRef || row.id,
      };
    } else if (row.status === "FAILED") {
      result = {
        success: false,
        mtnMessage: row.mtnResponse || row.failureReason || "",
        voiceResponse: row.voiceResponse || "",
        transactionId: row.id,
      };
    }

    res.json({
      jobId,
      status,
      result,
    });
  } catch (err) {
    next(err);
  }
}
