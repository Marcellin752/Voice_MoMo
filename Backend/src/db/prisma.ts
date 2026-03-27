import { PrismaClient } from "@prisma/client";
import { logger } from "../shared/logger/logger";

/**
 * Client Prisma singleton.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

process.on("beforeExit", async () => {
  await prisma.$disconnect().catch((e) => logger.error(e));
});
