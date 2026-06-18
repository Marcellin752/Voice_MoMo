import { Router } from "express";
import { authJwt } from "../middleware/auth.middleware";
import { transactionRateLimit } from "../middleware/rateLimit.middleware";
import * as transactionController from "../controllers/transaction.controller";

const router = Router();

router.post("/", authJwt, transactionRateLimit, transactionController.postTransaction);
router.get("/:jobId/status", authJwt, transactionController.getTransactionStatus);

export default router;
