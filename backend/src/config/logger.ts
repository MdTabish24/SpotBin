import pino, { Logger } from 'pino';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

const isDevelopment = process.env.NODE_ENV !== 'production';
const logDir = process.env.LOG_DIR || 'logs';

// Ensure log directory exists in production
if (!isDevelopment && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create base logger configuration
const baseConfig: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    env: process.env.NODE_ENV || 'development',
    service: 'cleancity-backend',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
};

// Development: pretty print to console
// Production: JSON to stdout (for log aggregation) + file rotation
const transport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
        messageFormat: '{requestId} - {msg}',
      },
    }
  : undefined;

export const logger: Logger = pino({
  ...baseConfig,
  transport,
});

/**
 * Create a child logger with request context
 * Includes requestId for log correlation
 */
export const createRequestLogger = (req: Request): Logger => {
  return logger.child({
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
};

/**
 * Request logging middleware
 * Logs incoming requests and response times
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const reqLogger = createRequestLogger(req);

  // Log incoming request
  reqLogger.info({
    userAgent: req.get('user-agent'),
    contentLength: req.get('content-length'),
    deviceId: req.headers['x-device-id'],
  }, 'Incoming request');

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    };

    if (res.statusCode >= 500) {
      reqLogger.error(logData, 'Request completed with server error');
    } else if (res.statusCode >= 400) {
      reqLogger.warn(logData, 'Request completed with client error');
    } else {
      reqLogger.info(logData, 'Request completed');
    }
  });

  next();
};

export default logger;
