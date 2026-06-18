import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { runUssdSession } from "../../core/ussd-session/ussd-session";
import { pinManager } from "../../core/pin-manager/pin-manager";
import { SUPPORTED_COUNTRIES } from "../../shared/constants/countries";
import type { TransactionAction } from "../../shared/types/api.types";
import { logger } from "../../shared/logger/logger";

const bodySchema = z.object({
  action: z.enum(["transfer", "withdraw", "balance", "billPayment", "airtime", "miniStatement", "sendToBank"]),
  country: z.string().refine((c) => (SUPPORTED_COUNTRIES as readonly string[]).includes(c), "Pays non supporté"),
  params: z.record(z.string(), z.unknown()).default({}),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

/**
 * POST /api/v1/execute-sync
 * Exécute une session USSD directement (sans Redis/BullMQ).
 * Appelé par le NLP module Python pour obtenir des vraies réponses MTN.
 * En mode USE_MOCK_MODEM=true : retourne des réponses réalistes sans modem physique.
 */
export async function executeSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = process.env.NLP_API_KEY || "";
    const authHeader = req.headers["x-api-key"] as string | undefined;
    if (apiKey && authHeader !== apiKey) {
      res.status(401).json({ error: "Clé API invalide." });
      return;
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Payload invalide.", details: parsed.error.flatten() });
      return;
    }

    const { action, country, params, pin } = parsed.data;
    const pinPlain = pin ?? "0000";
    const encryptedPin = pinManager.encrypt(pinPlain);

    logger.info("execute-sync", { action, country, params });

    const result = await runUssdSession({
      sessionId: `nlp-${Date.now()}`,
      userId: "nlp-service",
      country: country as (typeof SUPPORTED_COUNTRIES)[number],
      action: action as TransactionAction,
      params,
      encryptedPin,
    });

    res.json({
      success: result.parse.status === "SUCCESS",
      mtnMessage: result.mtnMessage,
      voiceResponse: result.voiceResponse,
      newBalance: result.parse.newBalance,
    });
  } catch (err) {
    logger.error("execute-sync error", { err });
    next(err);
  }
}
