import winston from "winston";

/**
 * Logger Winston centralisé (niveaux info/warn/error — jamais de PIN en clair).
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console({ format: winston.format.simple() })],
});
