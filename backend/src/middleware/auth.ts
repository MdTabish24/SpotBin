/**
 * Authentication Middleware - JWT validation for protected routes
 * Requirements: 15.2
 */

import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken, JwtPayload } from '../services/auth.service';
import { ApiError } from '../types';
import { logger } from '../config/logger';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      workerId?: string;
      adminId?: string;
    }
  }
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support "Bearer <token>" format
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also support raw token
  return authHeader;
}

/**
 * JWT Authentication middleware
 * Validates JWT token and attaches user info to request
 */
export function authenticateJwt(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    const error: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid token.'
      }
    };
    res.status(401).json(error);
    return;
  }

  const decoded = verifyJwtToken(token);

  if (!decoded) {
    const error: ApiError = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token. Please login again.'
      }
    };
    res.status(401).json(error);
    return;
  }

  // Attach user info to request
  req.user = decoded;
  
  if (decoded.role === 'worker') {
    req.workerId = decoded.sub;
  } else if (decoded.role === 'admin') {
    req.adminId = decoded.sub;
  }

  next();
}

/**
 * Worker-only authentication middleware
 * Ensures the authenticated user is a worker
 */
export function authenticateWorker(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  authenticateJwt(req, res, () => {
    if (!req.user || req.user.role !== 'worker') {
      const error: ApiError = {
        error: {
          code: 'FORBIDDEN',
          message: 'Worker access required.'
        }
      };
      res.status(403).json(error);
      return;
    }
    next();
  });
}

/**
 * Admin-only authentication middleware
 * Ensures the authenticated user is an admin
 */
export function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  authenticateJwt(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      const error: ApiError = {
        error: {
          code: 'FORBIDDEN',
          message: 'Admin access required.'
        }
      };
      res.status(403).json(error);
      return;
    }
    next();
  });
}

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (token) {
    const decoded = verifyJwtToken(token);
    if (decoded) {
      req.user = decoded;
      if (decoded.role === 'worker') {
        req.workerId = decoded.sub;
      } else if (decoded.role === 'admin') {
        req.adminId = decoded.sub;
      }
    }
  }

  next();
}

export default {
  authenticateJwt,
  authenticateWorker,
  authenticateAdmin,
  optionalAuth
};
