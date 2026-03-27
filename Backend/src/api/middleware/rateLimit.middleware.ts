import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Limite le débit par utilisateur authentifié.
 */
export const transactionRateLimit = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const u = req.user?.userId;
    return u || req.ip || "anon";
  },
});
