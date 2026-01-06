import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis';
import { logger } from '../config/logger';

/**
 * Rate limiting middleware configuration
 * Requirements: 15.3
 * Property 35: Rate limiting enforcement
 * 
 * Enforces 100 requests per minute per IP as per Requirements 15.3
 * Returns 429 status code when limit exceeded
 */

// ============================================
// Rate Limit Configuration
// ============================================

export const RATE_LIMIT_CONFIG = {
  // General API rate limit
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  // Authentication rate limit
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 attempts per 15 minutes
  },
  // Report submission rate limit
  report: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
};

// Redis key prefix for rate limiting
const RATE_LIMIT_PREFIX = 'rl:';

// ============================================
// Redis Store Creation
// ============================================

// Create Redis store for rate limiting
const createRedisStore = () => {
  try {
    return new RedisStore({
      // @ts-expect-error - ioredis types don't match exactly but work at runtime
      sendCommand: async (...args: string[]) => {
        return redis.call(args[0], ...args.slice(1));
      },
      prefix: RATE_LIMIT_PREFIX,
    });
  } catch (error) {
    logger.warn('Redis not available for rate limiting, using memory store');
    return undefined;
  }
};

// ============================================
// IP Extraction Helper
// ============================================

/**
 * Extract client IP from request
 * Handles X-Forwarded-For header for proxy scenarios
 */
export function extractClientIp(req: { 
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// ============================================
// Rate Limiters
// ============================================

// General API rate limiter - 100 requests per minute per IP
export const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.api.windowMs,
  max: RATE_LIMIT_CONFIG.api.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => extractClientIp(req),
  handler: (req, res, _next, options) => {
    logger.warn({
      ip: extractClientIp(req),
      path: req.path,
      method: req.method,
    }, 'Rate limit exceeded');
    
    res.status(429).json(options.message);
  },
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.auth.windowMs,
  max: RATE_LIMIT_CONFIG.auth.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  keyGenerator: (req) => `auth:${extractClientIp(req)}`,
  handler: (req, res, _next, options) => {
    logger.warn({
      ip: extractClientIp(req),
      path: req.path,
      method: req.method,
    }, 'Auth rate limit exceeded');
    
    res.status(429).json(options.message);
  },
});

// Report submission rate limiter (device-based, handled separately in service)
// This is a backup IP-based limiter
export const reportRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.report.windowMs,
  max: RATE_LIMIT_CONFIG.report.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many report submissions, please try again later',
    },
  },
  keyGenerator: (req) => `report:${extractClientIp(req)}`,
  handler: (req, res, _next, options) => {
    logger.warn({
      ip: extractClientIp(req),
      path: req.path,
      method: req.method,
    }, 'Report rate limit exceeded');
    
    res.status(429).json(options.message);
  },
});

// ============================================
// Rate Limit Tracking Functions (for testing)
// ============================================

/**
 * Get current request count for an IP
 * Used for property testing
 */
export async function getRequestCount(ip: string, type: 'api' | 'auth' | 'report' = 'api'): Promise<number> {
  try {
    const prefix = type === 'api' ? '' : `${type}:`;
    const key = `${RATE_LIMIT_PREFIX}${prefix}${ip}`;
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    logger.error({ error, ip, type }, 'Failed to get request count');
    return 0;
  }
}

/**
 * Increment request count for an IP (for testing)
 */
export async function incrementRequestCount(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<number> {
  try {
    const prefix = type === 'api' ? '' : `${type}:`;
    const key = `${RATE_LIMIT_PREFIX}${prefix}${ip}`;
    const config = RATE_LIMIT_CONFIG[type];
    
    const count = await redis.incr(key);
    
    // Set expiry on first request
    if (count === 1) {
      await redis.pexpire(key, config.windowMs);
    }
    
    return count;
  } catch (error) {
    logger.error({ error, ip, type }, 'Failed to increment request count');
    return 0;
  }
}

/**
 * Reset request count for an IP (for testing)
 */
export async function resetRequestCount(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<void> {
  try {
    const prefix = type === 'api' ? '' : `${type}:`;
    const key = `${RATE_LIMIT_PREFIX}${prefix}${ip}`;
    await redis.del(key);
  } catch (error) {
    logger.error({ error, ip, type }, 'Failed to reset request count');
  }
}

/**
 * Check if an IP is rate limited
 * Property 35: Rate limiting enforcement
 */
export async function isRateLimited(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<boolean> {
  const count = await getRequestCount(ip, type);
  const config = RATE_LIMIT_CONFIG[type];
  return count >= config.maxRequests;
}

/**
 * Get remaining requests for an IP
 */
export async function getRemainingRequests(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<number> {
  const count = await getRequestCount(ip, type);
  const config = RATE_LIMIT_CONFIG[type];
  return Math.max(0, config.maxRequests - count);
}

/**
 * Get TTL (time to live) for rate limit window
 */
export async function getRateLimitTTL(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<number> {
  try {
    const prefix = type === 'api' ? '' : `${type}:`;
    const key = `${RATE_LIMIT_PREFIX}${prefix}${ip}`;
    const ttl = await redis.pttl(key);
    return ttl > 0 ? ttl : 0;
  } catch (error) {
    logger.error({ error, ip, type }, 'Failed to get rate limit TTL');
    return 0;
  }
}

/**
 * Validate rate limit configuration
 * Used for property testing
 */
export function validateRateLimitConfig(): boolean {
  // API rate limit should be 100 requests per minute
  if (RATE_LIMIT_CONFIG.api.maxRequests !== 100) {
    return false;
  }
  if (RATE_LIMIT_CONFIG.api.windowMs !== 60 * 1000) {
    return false;
  }
  
  // Auth rate limit should be stricter
  if (RATE_LIMIT_CONFIG.auth.maxRequests >= RATE_LIMIT_CONFIG.api.maxRequests) {
    return false;
  }
  
  return true;
}

/**
 * Simulate rate limit check
 * Returns true if request should be allowed, false if rate limited
 */
export async function checkRateLimit(
  ip: string, 
  type: 'api' | 'auth' | 'report' = 'api'
): Promise<{
  allowed: boolean;
  currentCount: number;
  maxRequests: number;
  remaining: number;
  resetIn: number;
}> {
  const count = await getRequestCount(ip, type);
  const config = RATE_LIMIT_CONFIG[type];
  const ttl = await getRateLimitTTL(ip, type);
  
  return {
    allowed: count < config.maxRequests,
    currentCount: count,
    maxRequests: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - count),
    resetIn: ttl,
  };
}
