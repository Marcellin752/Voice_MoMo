import IORedis from "ioredis";

/**
 * Connexion Redis partagée (BullMQ exige maxRetriesPerRequest: null sur le client dupliqué).
 */
export function createRedisConnection(): IORedis {
  return new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}
