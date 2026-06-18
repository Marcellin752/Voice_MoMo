import { Router } from "express";
import { executeSync } from "../controllers/execute-sync.controller";

const router = Router();

router.post("/", executeSync);

export default router;
