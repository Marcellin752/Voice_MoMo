import IORedis, { type RedisOptions } from "ioredis";
import { logger } from "./shared/logger/logger";

let redisHelpLogged = false;

function logRedisHelpOnce(host: string, port: number): void {
  if (redisHelpLogged) return;
  redisHelpLogged = true;
  logger.warn(
    `Redis injoignable (${host}:${port}). Pour la file USSD : « npm run dev:redis » ou « docker compose up -d redis » (dossier Backend). ` +
      `Pour l’API legacy seule sans Redis : SKIP_REDIS=true dans .env`
  );
}

/**
 * Options Redis partagées (BullMQ exige maxRetriesPerRequest: null sur le client dupliqué).
 */
export function getRedisOptions(): RedisOptions {
  if (process.env.REDIS_URL) {
    return {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy(times: number) {
        const max = Number(process.env.REDIS_CONNECT_RETRIES) || 10;
        if (times > max) return null;
        return Math.min(times * 400, 3000);
      },
    };
  }

  const host = process.env.REDIS_HOST || "localhost";
  const port = Number(process.env.REDIS_PORT) || 6379;
  return {
    host,
    port,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy(times: number) {
      const max = Number(process.env.REDIS_CONNECT_RETRIES) || 10;
      if (times > max) return null;
      return Math.min(times * 400, 3000);
    },
  };
}

function attachRedisErrorHandler(client: IORedis, host: string, port: number): void {
  client.on("error", (err: Error & { code?: string }) => {
    const refused =
      err.code === "ECONNREFUSED" || String(err.message || "").includes("ECONNREFUSED");
    if (refused) {
      logRedisHelpOnce(host, port);
    } else {
      logger.error("Redis connection error", { err });
    }
  });
}

export function createRedisConnection(): IORedis {
  const opts = getRedisOptions();
  const redisUrl = process.env.REDIS_URL;
  const client = redisUrl ? new IORedis(redisUrl, opts) : new IORedis(opts);
  
  const host = redisUrl ? "URL" : String(opts.host ?? "localhost");
  const port = redisUrl ? 0 : (typeof opts.port === "number" ? opts.port : Number(opts.port) || 6379);
  
  attachRedisErrorHandler(client, host, port);
  return client;
}

/**
 * Client dédié à SUBSCRIBE : ne pas réutiliser les options BullMQ
 * (`enableOfflineQueue: false` + `lazyConnect` fait échouer subscribe avant connexion).
 */
export function createRedisSubscriberConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 20,
      lazyConnect: false,
    });
    attachRedisErrorHandler(client, "URL", 0);
    return client;
  }

  const host = process.env.REDIS_HOST || "localhost";
  const port = Number(process.env.REDIS_PORT) || 6379;
  const client = new IORedis({
    host,
    port,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 20,
    lazyConnect: false,
  });
  attachRedisErrorHandler(client, host, port);
  return client;
}
