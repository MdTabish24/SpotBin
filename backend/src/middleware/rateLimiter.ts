import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis';
import { logger } from '../config/logger';

/**
 * Rate limiting middleware configuration
 * Enforces 100 requests per minute per IP as per Requirements 15.3
 */

// Create Redis store for rate limiting
const createRedisStore = () => {
  try {
    return new RedisStore({
      // @ts-expect-error - ioredis types don't match exactly but work at runtime
      sendCommand: async (...args: string[]) => {
        return redis.call(args[0], ...args.slice(1));
      },
      prefix: 'rl:',
    });
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store');
    return undefined;
  }
};

// General API rate limiter - 100 requests per minute per IP
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Use X-Forwarded-For header if behind proxy, otherwise use IP
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.ip || req.socket.remoteAddress || 'unknown';
    return ip;
  },
  handler: (req, res, _next, options) => {
    logger.warn({
      ip: req.ip,
      path: req.path,
      method: req.method,
    }, 'Rate limit exceeded');
    
    res.status(429).json(options.message);
  },
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  keyGenerator: (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.ip || req.socket.remoteAddress || 'unknown';
    return `auth:${ip}`;
  },
});

// Report submission rate limiter (device-based, handled separately in service)
// This is a backup IP-based limiter
export const reportRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute (generous, device limit is stricter)
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many report submissions, please try again later',
    },
  },
});
