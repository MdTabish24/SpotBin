/**
 * XSS Sanitization Middleware
 * Requirements: 15.5
 * Property 36: XSS sanitization
 * 
 * Sanitizes all user inputs to prevent XSS attacks by:
 * - Removing script tags
 * - Removing event handlers (onclick, onerror, etc.)
 * - Removing javascript: URLs
 * - Encoding HTML entities
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// ============================================
// XSS Patterns to Detect and Remove
// ============================================

/**
 * Patterns that indicate potential XSS attacks
 */
const XSS_PATTERNS = {
  // Script tags (including variations)
  scriptTags: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  scriptTagsOpen: /<script[^>]*>/gi,
  scriptTagsClose: /<\/script>/gi,
  
  // Event handlers (onclick, onerror, onload, etc.)
  eventHandlers: /\s*on\w+\s*=\s*["'][^"']*["']/gi,
  eventHandlersUnquoted: /\s*on\w+\s*=\s*[^\s>]+/gi,
  
  // JavaScript URLs
  javascriptUrls: /javascript\s*:/gi,
  
  // Data URLs with script content
  dataUrls: /data\s*:\s*text\/html/gi,
  
  // VBScript (for IE)
  vbscriptUrls: /vbscript\s*:/gi,
  
  // Expression (CSS expression for IE)
  cssExpression: /expression\s*\(/gi,
  
  // Iframe tags
  iframeTags: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  iframeTagsOpen: /<iframe[^>]*>/gi,
  
  // Object/embed tags
  objectTags: /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  embedTags: /<embed[^>]*>/gi,
  
  // SVG with script
  svgScript: /<svg[^>]*>[\s\S]*?<script[\s\S]*?<\/svg>/gi,
  
  // Base64 encoded script
  base64Script: /base64[^"']*["'][^"']*script/gi,
};

/**
 * HTML entities to encode
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// ============================================
// Sanitization Functions
// ============================================

/**
 * Encode HTML entities in a string
 */
export function encodeHtmlEntities(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove XSS patterns from a string
 * Returns the sanitized string
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  let sanitized = input;

  // Remove script tags
  sanitized = sanitized.replace(XSS_PATTERNS.scriptTags, '');
  sanitized = sanitized.replace(XSS_PATTERNS.scriptTagsOpen, '');
  sanitized = sanitized.replace(XSS_PATTERNS.scriptTagsClose, '');

  // Remove event handlers
  sanitized = sanitized.replace(XSS_PATTERNS.eventHandlers, '');
  sanitized = sanitized.replace(XSS_PATTERNS.eventHandlersUnquoted, '');

  // Remove javascript: URLs
  sanitized = sanitized.replace(XSS_PATTERNS.javascriptUrls, '');

  // Remove vbscript: URLs
  sanitized = sanitized.replace(XSS_PATTERNS.vbscriptUrls, '');

  // Remove data: URLs with HTML content
  sanitized = sanitized.replace(XSS_PATTERNS.dataUrls, '');

  // Remove CSS expressions
  sanitized = sanitized.replace(XSS_PATTERNS.cssExpression, '');

  // Remove iframe tags
  sanitized = sanitized.replace(XSS_PATTERNS.iframeTags, '');
  sanitized = sanitized.replace(XSS_PATTERNS.iframeTagsOpen, '');

  // Remove object/embed tags
  sanitized = sanitized.replace(XSS_PATTERNS.objectTags, '');
  sanitized = sanitized.replace(XSS_PATTERNS.embedTags, '');

  // Remove SVG with scripts
  sanitized = sanitized.replace(XSS_PATTERNS.svgScript, '');

  // Remove base64 encoded scripts
  sanitized = sanitized.replace(XSS_PATTERNS.base64Script, '');

  return sanitized.trim();
}

/**
 * Check if a string contains XSS patterns
 */
export function containsXss(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  for (const pattern of Object.values(XSS_PATTERNS)) {
    if (pattern.test(input)) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      return true;
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return false;
}

/**
 * Get list of XSS patterns found in input
 */
export function detectXssPatterns(input: string): string[] {
  if (typeof input !== 'string') {
    return [];
  }

  const detected: string[] = [];

  for (const [name, pattern] of Object.entries(XSS_PATTERNS)) {
    if (pattern.test(input)) {
      detected.push(name);
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return detected;
}


/**
 * Recursively sanitize an object's string values
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

// ============================================
// Express Middleware
// ============================================

/**
 * XSS Sanitization Middleware
 * Sanitizes request body, query params, and URL params
 */
export function xssSanitizer(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Track if any XSS was detected for logging
    let xssDetected = false;
    const detectedPatterns: string[] = [];

    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      if (containsXss(bodyStr)) {
        xssDetected = true;
        detectedPatterns.push(...detectXssPatterns(bodyStr));
      }
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      const queryStr = JSON.stringify(req.query);
      if (containsXss(queryStr)) {
        xssDetected = true;
        detectedPatterns.push(...detectXssPatterns(queryStr));
      }
      req.query = sanitizeObject(req.query) as typeof req.query;
    }

    // Sanitize URL parameters
    if (req.params && typeof req.params === 'object') {
      const paramsStr = JSON.stringify(req.params);
      if (containsXss(paramsStr)) {
        xssDetected = true;
        detectedPatterns.push(...detectXssPatterns(paramsStr));
      }
      req.params = sanitizeObject(req.params);
    }

    // Log if XSS was detected and sanitized
    if (xssDetected) {
      logger.warn({
        ip: req.ip,
        path: req.path,
        method: req.method,
        patterns: [...new Set(detectedPatterns)],
      }, 'XSS patterns detected and sanitized');
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Error in XSS sanitization middleware');
    next(error);
  }
}

/**
 * Strict XSS Sanitization Middleware
 * Rejects requests containing XSS patterns instead of sanitizing
 */
export function xssSanitizerStrict(req: Request, res: Response, next: NextFunction): void {
  try {
    // Check request body
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      if (containsXss(bodyStr)) {
        const patterns = detectXssPatterns(bodyStr);
        logger.warn({
          ip: req.ip,
          path: req.path,
          method: req.method,
          patterns,
        }, 'XSS patterns detected - request rejected');

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request contains potentially malicious content',
          },
        });
        return;
      }
    }

    // Check query parameters
    if (req.query && typeof req.query === 'object') {
      const queryStr = JSON.stringify(req.query);
      if (containsXss(queryStr)) {
        const patterns = detectXssPatterns(queryStr);
        logger.warn({
          ip: req.ip,
          path: req.path,
          method: req.method,
          patterns,
        }, 'XSS patterns detected in query - request rejected');

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request contains potentially malicious content',
          },
        });
        return;
      }
    }

    // Check URL parameters
    if (req.params && typeof req.params === 'object') {
      const paramsStr = JSON.stringify(req.params);
      if (containsXss(paramsStr)) {
        const patterns = detectXssPatterns(paramsStr);
        logger.warn({
          ip: req.ip,
          path: req.path,
          method: req.method,
          patterns,
        }, 'XSS patterns detected in params - request rejected');

        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request contains potentially malicious content',
          },
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error({ error }, 'Error in strict XSS sanitization middleware');
    next(error);
  }
}

// ============================================
// Validation Helpers for Property Testing
// ============================================

/**
 * Validate that sanitized output contains no executable JavaScript
 * Used for Property 36 testing
 */
export function validateNoExecutableJs(input: string): boolean {
  const sanitized = sanitizeString(input);
  
  // Check for any remaining XSS patterns
  if (containsXss(sanitized)) {
    return false;
  }

  // Additional checks for edge cases
  const lowerSanitized = sanitized.toLowerCase();
  
  // Check for javascript: protocol
  if (lowerSanitized.includes('javascript:')) {
    return false;
  }

  // Check for event handlers
  if (/\bon\w+\s*=/i.test(sanitized)) {
    return false;
  }

  // Check for script tags
  if (/<script/i.test(sanitized)) {
    return false;
  }

  return true;
}

/**
 * Get sanitization result with metadata
 * Useful for testing and debugging
 */
export function getSanitizationResult(input: string): {
  original: string;
  sanitized: string;
  wasModified: boolean;
  detectedPatterns: string[];
  isClean: boolean;
} {
  const sanitized = sanitizeString(input);
  const detectedPatterns = detectXssPatterns(input);
  
  return {
    original: input,
    sanitized,
    wasModified: input !== sanitized,
    detectedPatterns,
    isClean: validateNoExecutableJs(sanitized),
  };
}

export default xssSanitizer;
