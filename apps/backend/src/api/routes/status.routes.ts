import { Router } from "express";
import { authJwt } from "../middleware/auth.middleware";
import { getTransactionStatus } from "../controllers/transaction.controller";

/**
 * Suivi des jobs USSD (alias logique ; les routes sont aussi sous `/api/v1/transaction/:jobId/status`).
 */
const router = Router();
router.get("/:jobId/status", authJwt, getTransactionStatus);

export default router;
