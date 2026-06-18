import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import http from "http";
import path from "path";
import cors from "cors";
import { Server } from "socket.io";
import { createRedisSubscriberConnection } from "./redis-connection";
import { USSD_EVENT_CHANNEL } from "./notifications/event-bus";
import transactionRoutes from "./api/routes/transaction.routes";
import statusRoutes from "./api/routes/status.routes";
import executeSyncRoutes from "./api/routes/execute-sync.routes";
import { AppError } from "./shared/errors/app-errors";
import { logger } from "./shared/logger/logger";
import { getUssdQueue, isUssdQueueAvailable } from "./queue/job-queue";
import { startModemHealthcheck } from "./modem/modem-health";
import { modemPool } from "./modem/modem-pool";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { registerLegacyRoutes } = require(path.join(__dirname, "../legacy/registerRoutes.js")) as {
  registerLegacyRoutes: (app: express.Express) => void;
};

const PORT = Number(process.env.PORT) || 3001;

/**
 * Point d’entrée HTTP + WebSocket + routes legacy + API USSD v1.
 */
async function bootstrap(): Promise<void> {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.use("/api/v1/transaction", transactionRoutes);
  app.use("/api/v1/status", statusRoutes);
  app.use("/api/v1/execute-sync", executeSyncRoutes);

  registerLegacyRoutes(app);

  if (process.env.BULL_BOARD_ENABLED === "true" && isUssdQueueAvailable()) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createBullBoard } = require("@bull-board/api");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BullMQAdapter } = require("@bull-board/api/bullMQAdapter");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ExpressAdapter } = require("@bull-board/express");
      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath("/admin/queues");
      createBullBoard({
        queues: [new BullMQAdapter(getUssdQueue())],
        serverAdapter,
      });
      app.use("/admin/queues", serverAdapter.getRouter());
      logger.info("Bull Board activé sur /admin/queues");
    } catch (e) {
      logger.warn("Bull Board indisponible (packages manquants).", { err: e });
    }
  }

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Route introuvable." });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    logger.error("unhandled error", { err });
    res.status(500).json({ error: "Erreur interne." });
  });

  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    path: "/events",
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.query.userId as string | undefined;
    if (userId) {
      socket.join(`user:${userId}`);
    }
    next();
  });

  io.on("connection", (socket) => {
    logger.info("socket connected", { id: socket.id });
  });

  if (isUssdQueueAvailable()) {
    try {
      const sub = createRedisSubscriberConnection();
      await sub.subscribe(USSD_EVENT_CHANNEL);
      sub.on("message", (_ch, msg) => {
        try {
          const data = JSON.parse(msg) as {
            userId?: string;
            event?: string;
            voiceResponse?: string;
            jobId?: string;
            success?: boolean;
          };
          if (data.userId) {
            io.to(`user:${data.userId}`).emit(data.event || "ussd", data);
          }
        } catch (e) {
          logger.error("invalid redis event", { err: e });
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("Redis subscriber indisponible — WebSocket temps réel limité.", {
        message: msg,
        stack: e instanceof Error ? e.stack : undefined,
      });
    }
  } else {
    logger.info("SKIP_REDIS=true — pas d’abonnement Redis (WebSocket USSD désactivé).");
  }

  startModemHealthcheck(modemPool);

  httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`Voice MoMo + MTN USSD API sur http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((e) => {
  logger.error(e);
  process.exit(1);
});
