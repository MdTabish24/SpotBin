import Redis from 'ioredis';
import { config } from './env';
import { logger } from './logger';

// Create Redis client
const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true,
});

// Event handlers
redis.on('connect', () => {
  logger.info('Redis client connected');
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis client error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Health check function
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return false;
  }
};

// Cache helper functions
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error({ error, key }, 'Cache get failed');
    return null;
  }
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number = 300
): Promise<boolean> => {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Cache set failed');
    return false;
  }
};

export const cacheDelete = async (key: string): Promise<boolean> => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ error, key }, 'Cache delete failed');
    return false;
  }
};

export const cacheDeletePattern = async (pattern: string): Promise<number> => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      return await redis.del(...keys);
    }
    return 0;
  } catch (error) {
    logger.error({ error, pattern }, 'Cache delete pattern failed');
    return 0;
  }
};

// Rate limiting helpers
export const incrementRateLimit = async (
  key: string,
  windowSeconds: number
): Promise<number> => {
  const multi = redis.multi();
  multi.incr(key);
  multi.expire(key, windowSeconds);
  const results = await multi.exec();
  return results ? (results[0][1] as number) : 0;
};

export const getRateLimit = async (key: string): Promise<number> => {
  const count = await redis.get(key);
  return count ? parseInt(count, 10) : 0;
};

// Graceful shutdown
export const closeRedis = async (): Promise<void> => {
  await redis.quit();
  logger.info('Redis connection closed');
};

export default redis;
