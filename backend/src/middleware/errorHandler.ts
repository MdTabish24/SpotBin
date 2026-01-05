import { Request, Response, NextFunction } from 'express';
import { logger, createRequestLogger } from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  field?: string;
  retryAfter?: number;
  isOperational?: boolean;
}

/**
 * Central error handling middleware
 * Logs errors with request context and returns consistent error responses
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';
  const isOperational = err.isOperational ?? statusCode < 500;

  // Create request-scoped logger for correlation
  const reqLogger = createRequestLogger(req);

  // Log error with full context
  const errorContext = {
    statusCode,
    code,
    isOperational,
    stack: err.stack,
    field: err.field,
    body: statusCode >= 500 ? undefined : req.body, // Don't log body for server errors
    query: req.query,
    params: req.params,
  };

  if (statusCode >= 500) {
    // Server errors - log as error with full stack trace
    reqLogger.error(errorContext, `Server error: ${message}`);
  } else if (statusCode >= 400) {
    // Client errors - log as warning
    reqLogger.warn(errorContext, `Client error: ${message}`);
  }

  // Send response
  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.field && { field: err.field }),
      ...(err.retryAfter && { retryAfter: err.retryAfter }),
      requestId: req.requestId, // Include for client-side debugging
    },
  });
};

export class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  field?: string;
  retryAfter?: number;
  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    field?: string,
    retryAfter?: number
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
    this.retryAfter = retryAfter;
    this.isOperational = true; // Operational errors are expected errors
    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined error types
export const ValidationError = (message: string, field?: string): AppError =>
  new AppError(message, 400, 'VALIDATION_ERROR', field);

export const UnauthorizedError = (message: string = 'Unauthorized'): AppError =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const ForbiddenError = (message: string = 'Forbidden'): AppError =>
  new AppError(message, 403, 'FORBIDDEN');

export const NotFoundError = (message: string = 'Not found'): AppError =>
  new AppError(message, 404, 'NOT_FOUND');

export const DuplicateError = (message: string): AppError =>
  new AppError(message, 409, 'DUPLICATE_REPORT');

export const RateLimitError = (retryAfter: number): AppError =>
  new AppError('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', undefined, retryAfter);

export const CooldownError = (retryAfter: number): AppError =>
  new AppError(`Please wait ${Math.ceil(retryAfter / 60)} minutes before submitting`, 429, 'COOLDOWN_ACTIVE', undefined, retryAfter);

export const DailyLimitError = (): AppError =>
  new AppError('Maximum 10 reports per day reached', 429, 'DAILY_LIMIT_REACHED');

export const StalePhotoError = (): AppError =>
  new AppError('Photo must be taken within the last 5 minutes', 400, 'STALE_PHOTO');

export const ProximityError = (): AppError =>
  new AppError('Must be within 50 meters of report location', 400, 'PROXIMITY_ERROR');

export const TimingError = (): AppError =>
  new AppError('Time between photos must be 2-240 minutes', 400, 'TIMING_ERROR');
