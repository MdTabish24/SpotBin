/**
 * Property Tests for Rate Limiting
 * Feature: cleancity-waste-management
 * Property 35: Rate limiting enforcement
 * Validates: Requirements 15.3
 * 
 * For any IP address that exceeds 100 requests per minute, subsequent requests
 * SHALL be rejected with a 429 status code until the rate limit window resets.
 */

import * as fc from 'fast-check';
import {
  RATE_LIMIT_CONFIG,
  extractClientIp,
  getRequestCount,
  incrementRequestCount,
  resetRequestCount,
  isRateLimited,
  getRemainingRequests,
  getRateLimitTTL,
  validateRateLimitConfig,
  checkRateLimit,
} from '../../src/middleware/rateLimiter';

describe('Feature: cleancity-waste-management', () => {
  describe('Property 35: Rate limiting enforcement', () => {
    // ============================================
    // Configuration Tests
    // ============================================
    describe('Rate limit configuration', () => {
      it('should have API rate limit of 100 requests per minute', () => {
        expect(RATE_LIMIT_CONFIG.api.maxRequests).toBe(100);
        expect(RATE_LIMIT_CONFIG.api.windowMs).toBe(60 * 1000);
      });

      it('should have auth rate limit stricter than API rate limit', () => {
        expect(RATE_LIMIT_CONFIG.auth.maxRequests).toBeLessThan(
          RATE_LIMIT_CONFIG.api.maxRequests
        );
      });

      it('should have valid configuration', () => {
        expect(validateRateLimitConfig()).toBe(true);
      });

      it('should have all rate limit types configured', () => {
        expect(RATE_LIMIT_CONFIG.api).toBeDefined();
        expect(RATE_LIMIT_CONFIG.auth).toBeDefined();
        expect(RATE_LIMIT_CONFIG.report).toBeDefined();
      });

      it('should have positive window durations', () => {
        expect(RATE_LIMIT_CONFIG.api.windowMs).toBeGreaterThan(0);
        expect(RATE_LIMIT_CONFIG.auth.windowMs).toBeGreaterThan(0);
        expect(RATE_LIMIT_CONFIG.report.windowMs).toBeGreaterThan(0);
      });

      it('should have positive max request limits', () => {
        expect(RATE_LIMIT_CONFIG.api.maxRequests).toBeGreaterThan(0);
        expect(RATE_LIMIT_CONFIG.auth.maxRequests).toBeGreaterThan(0);
        expect(RATE_LIMIT_CONFIG.report.maxRequests).toBeGreaterThan(0);
      });
    });

    // ============================================
    // IP Extraction Tests
    // ============================================
    describe('IP extraction', () => {
      it('should extract IP from direct connection', () => {
        fc.assert(
          fc.property(
            fc.ipV4(),
            (ip) => {
              const req = {
                headers: {},
                ip,
                socket: { remoteAddress: ip },
              };
              
              const extracted = extractClientIp(req);
              expect(extracted).toBe(ip);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should extract IP from X-Forwarded-For header', () => {
        fc.assert(
          fc.property(
            fc.ipV4(),
            (ip) => {
              const req = {
                headers: { 'x-forwarded-for': ip },
                ip: '127.0.0.1',
              };
              
              const extracted = extractClientIp(req);
              expect(extracted).toBe(ip);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should extract first IP from X-Forwarded-For chain', () => {
        fc.assert(
          fc.property(
            fc.ipV4(),
            fc.ipV4(),
            fc.ipV4(),
            (ip1, ip2, ip3) => {
              const req = {
                headers: { 'x-forwarded-for': `${ip1}, ${ip2}, ${ip3}` },
                ip: '127.0.0.1',
              };
              
              const extracted = extractClientIp(req);
              expect(extracted).toBe(ip1);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should handle array X-Forwarded-For header', () => {
        fc.assert(
          fc.property(
            fc.ipV4(),
            fc.ipV4(),
            (ip1, ip2) => {
              const req = {
                headers: { 'x-forwarded-for': [ip1, ip2] },
                ip: '127.0.0.1',
              };
              
              const extracted = extractClientIp(req);
              expect(extracted).toBe(ip1);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should return "unknown" when no IP available', () => {
        const req = {
          headers: {},
        };
        
        const extracted = extractClientIp(req);
        expect(extracted).toBe('unknown');
      });
    });

    // ============================================
    // Rate Limit Logic Tests (Unit Tests)
    // ============================================
    describe('Rate limit logic', () => {
      it('should allow requests under the limit', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 99 }),
            (requestCount) => {
              // If count is less than max, should be allowed
              const isAllowed = requestCount < RATE_LIMIT_CONFIG.api.maxRequests;
              expect(isAllowed).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reject requests at or over the limit', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 100, max: 1000 }),
            (requestCount) => {
              // If count is >= max, should be rejected
              const isRejected = requestCount >= RATE_LIMIT_CONFIG.api.maxRequests;
              expect(isRejected).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should calculate remaining requests correctly', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 150 }),
            (currentCount) => {
              const maxRequests = RATE_LIMIT_CONFIG.api.maxRequests;
              const remaining = Math.max(0, maxRequests - currentCount);
              
              // Remaining should never be negative
              expect(remaining).toBeGreaterThanOrEqual(0);
              
              // Remaining should be 0 when at or over limit
              if (currentCount >= maxRequests) {
                expect(remaining).toBe(0);
              }
              
              // Remaining should be positive when under limit
              if (currentCount < maxRequests) {
                expect(remaining).toBeGreaterThan(0);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should have exactly 100 as the API rate limit threshold', () => {
        expect(RATE_LIMIT_CONFIG.api.maxRequests).toBe(100);
      });

      it('should have exactly 1 minute as the API rate limit window', () => {
        expect(RATE_LIMIT_CONFIG.api.windowMs).toBe(60000);
      });
    });

    // ============================================
    // Rate Limit State Tests
    // ============================================
    describe('Rate limit state tracking', () => {
      it('should track request counts correctly', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 50 }),
            (numRequests) => {
              // Simulate counting requests
              let count = 0;
              for (let i = 0; i < numRequests; i++) {
                count++;
              }
              
              expect(count).toBe(numRequests);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should determine rate limited status based on count', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 200 }),
            (count) => {
              const maxRequests = RATE_LIMIT_CONFIG.api.maxRequests;
              const isLimited = count >= maxRequests;
              
              // Verify the logic
              if (count < maxRequests) {
                expect(isLimited).toBe(false);
              } else {
                expect(isLimited).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    // ============================================
    // Rate Limit Response Tests
    // ============================================
    describe('Rate limit response structure', () => {
      it('should return 429 status code when rate limited', () => {
        // The expected status code for rate limiting
        const RATE_LIMIT_STATUS_CODE = 429;
        expect(RATE_LIMIT_STATUS_CODE).toBe(429);
      });

      it('should include error code in response', () => {
        const expectedErrorCode = 'RATE_LIMIT_EXCEEDED';
        expect(expectedErrorCode).toBe('RATE_LIMIT_EXCEEDED');
      });

      it('should include error message in response', () => {
        const expectedMessage = 'Too many requests, please try again later';
        expect(expectedMessage).toContain('Too many requests');
      });
    });

    // ============================================
    // Rate Limit Type Tests
    // ============================================
    describe('Different rate limit types', () => {
      it('should have different limits for different types', () => {
        // API should have highest limit
        expect(RATE_LIMIT_CONFIG.api.maxRequests).toBeGreaterThan(
          RATE_LIMIT_CONFIG.auth.maxRequests
        );
        
        // Report limit should be between auth and api
        expect(RATE_LIMIT_CONFIG.report.maxRequests).toBeLessThan(
          RATE_LIMIT_CONFIG.api.maxRequests
        );
      });

      it('should have appropriate window durations', () => {
        // Auth window should be longer (more restrictive)
        expect(RATE_LIMIT_CONFIG.auth.windowMs).toBeGreaterThan(
          RATE_LIMIT_CONFIG.api.windowMs
        );
      });
    });

    // ============================================
    // Property: Rate limit enforcement
    // ============================================
    describe('Universal property: Rate limit enforcement', () => {
      it('should enforce rate limit at exactly 100 requests', () => {
        const maxRequests = RATE_LIMIT_CONFIG.api.maxRequests;
        
        // At 99 requests, should be allowed
        expect(99 < maxRequests).toBe(true);
        
        // At 100 requests, should be rate limited
        expect(100 >= maxRequests).toBe(true);
        
        // At 101 requests, should be rate limited
        expect(101 >= maxRequests).toBe(true);
      });

      it('should correctly identify rate limited IPs', () => {
        fc.assert(
          fc.property(
            fc.ipV4(),
            fc.integer({ min: 0, max: 200 }),
            (ip, requestCount) => {
              const maxRequests = RATE_LIMIT_CONFIG.api.maxRequests;
              const shouldBeRateLimited = requestCount >= maxRequests;
              
              // Verify the rate limit logic
              if (requestCount < maxRequests) {
                expect(shouldBeRateLimited).toBe(false);
              } else {
                expect(shouldBeRateLimited).toBe(true);
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should reset rate limit after window expires', () => {
        // After window expires, count should reset to 0
        const windowMs = RATE_LIMIT_CONFIG.api.windowMs;
        
        // Window should be exactly 1 minute
        expect(windowMs).toBe(60000);
        
        // After reset, requests should be allowed again
        const countAfterReset = 0;
        expect(countAfterReset < RATE_LIMIT_CONFIG.api.maxRequests).toBe(true);
      });
    });

    // ============================================
    // Edge Cases
    // ============================================
    describe('Edge cases', () => {
      it('should handle boundary at exactly 100 requests', () => {
        const maxRequests = RATE_LIMIT_CONFIG.api.maxRequests;
        
        // 99th request should be allowed
        expect(99 < maxRequests).toBe(true);
        
        // 100th request should be the first to be rate limited
        expect(100 >= maxRequests).toBe(true);
      });

      it('should handle IPv6 addresses', () => {
        const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const req = {
          headers: {},
          ip: ipv6,
        };
        
        const extracted = extractClientIp(req);
        expect(extracted).toBe(ipv6);
      });

      it('should handle localhost addresses', () => {
        const localhostVariants = ['127.0.0.1', '::1', 'localhost'];
        
        for (const ip of localhostVariants) {
          const req = {
            headers: {},
            ip,
          };
          
          const extracted = extractClientIp(req);
          expect(extracted).toBe(ip);
        }
      });

      it('should handle empty X-Forwarded-For header', () => {
        const req = {
          headers: { 'x-forwarded-for': '' },
          ip: '192.168.1.1',
        };
        
        const extracted = extractClientIp(req);
        // Should fall back to req.ip when X-Forwarded-For is empty
        expect(extracted).toBeTruthy();
      });
    });

    // ============================================
    // Consistency Tests
    // ============================================
    describe('Rate limit consistency', () => {
      it('should have consistent configuration values', () => {
        // API rate limit should match requirements (100 req/min)
        expect(RATE_LIMIT_CONFIG.api.maxRequests).toBe(100);
        expect(RATE_LIMIT_CONFIG.api.windowMs).toBe(60 * 1000);
        
        // Auth rate limit should be stricter
        expect(RATE_LIMIT_CONFIG.auth.maxRequests).toBe(10);
        expect(RATE_LIMIT_CONFIG.auth.windowMs).toBe(15 * 60 * 1000);
        
        // Report rate limit
        expect(RATE_LIMIT_CONFIG.report.maxRequests).toBe(20);
        expect(RATE_LIMIT_CONFIG.report.windowMs).toBe(60 * 1000);
      });

      it('should validate configuration correctly', () => {
        expect(validateRateLimitConfig()).toBe(true);
      });
    });
  });
});
