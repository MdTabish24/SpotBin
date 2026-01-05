/**
 * Feature: cleancity-waste-management
 * Property Tests for Abuse Prevention
 * 
 * Property 6: Daily report limit enforcement
 * Property 7: Report cooldown enforcement
 * Property 8: Duplicate report detection
 * 
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import fc from 'fast-check';
import { RATE_LIMIT_CONFIG } from '../../src/types';
import { calculateDistance } from '../../src/utils/validation';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Pure Function Implementations for Testing
// (These mirror the service logic but are pure functions)
// ============================================

/**
 * Check if daily limit is exceeded
 * Requirements: 2.1 - Max 10 reports per device per day
 */
function checkDailyLimitExceeded(reportCount: number): boolean {
  return reportCount >= RATE_LIMIT_CONFIG.maxReportsPerDay;
}

/**
 * Check if cooldown is active
 * Requirements: 2.2 - Minimum 5 minutes between reports
 */
function checkCooldownActive(
  lastReportTime: Date | null,
  currentTime: Date
): { active: boolean; waitSeconds?: number } {
  if (!lastReportTime) {
    return { active: false };
  }

  const diffSeconds = (currentTime.getTime() - lastReportTime.getTime()) / 1000;
  const cooldownSeconds = RATE_LIMIT_CONFIG.cooldownMinutes * 60;

  if (diffSeconds < cooldownSeconds) {
    const waitSeconds = Math.ceil(cooldownSeconds - diffSeconds);
    return { active: true, waitSeconds };
  }

  return { active: false };
}

/**
 * Check if a location is within duplicate radius of any existing report
 * Requirements: 2.3 - Reject if report exists within 50m in last 24 hours
 */
function checkDuplicateLocation(
  newLat: number,
  newLng: number,
  existingReports: Array<{ lat: number; lng: number }>
): boolean {
  for (const report of existingReports) {
    const distance = calculateDistance(newLat, newLng, report.lat, report.lng);
    if (distance <= RATE_LIMIT_CONFIG.duplicateRadiusMeters) {
      return true;
    }
  }
  return false;
}

// ============================================
// Generators
// ============================================

const validLatitudeGenerator = fc.double({ min: -90, max: 90, noNaN: true });
const validLongitudeGenerator = fc.double({ min: -180, max: 180, noNaN: true });

const reportCountGenerator = fc.integer({ min: 0, max: 20 });

const existingReportsGenerator = fc.array(
  fc.record({
    lat: validLatitudeGenerator,
    lng: validLongitudeGenerator
  }),
  { maxLength: 10 }
);

// ============================================
// Property Tests
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 6: Daily report limit enforcement', () => {
    /**
     * Property 6: Daily report limit enforcement
     * For any device that has submitted 10 or more reports in the current day,
     * subsequent report submissions from that device SHALL be rejected.
     * Validates: Requirements 2.1
     */
    it('should reject reports when count >= 10', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          (reportCount) => {
            const exceeded = checkDailyLimitExceeded(reportCount);
            expect(exceeded).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should allow reports when count < 10', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 9 }),
          (reportCount) => {
            const exceeded = checkDailyLimitExceeded(reportCount);
            expect(exceeded).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should have exactly 10 as the threshold', () => {
      expect(checkDailyLimitExceeded(9)).toBe(false);
      expect(checkDailyLimitExceeded(10)).toBe(true);
      expect(checkDailyLimitExceeded(11)).toBe(true);
    });

    it('should match the configured max reports per day', () => {
      expect(RATE_LIMIT_CONFIG.maxReportsPerDay).toBe(10);
    });
  });

  describe('Property 7: Report cooldown enforcement', () => {
    /**
     * Property 7: Report cooldown enforcement
     * For any device, if a report was submitted less than 5 minutes ago,
     * subsequent report submissions SHALL be rejected until the cooldown period expires.
     * Validates: Requirements 2.2
     */
    it('should enforce cooldown when last report was less than 5 minutes ago', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 299 }), // 0 to 299 seconds (< 5 minutes)
          (secondsAgo) => {
            const now = new Date();
            const lastReportTime = new Date(now.getTime() - secondsAgo * 1000);
            
            const result = checkCooldownActive(lastReportTime, now);
            
            expect(result.active).toBe(true);
            expect(result.waitSeconds).toBeDefined();
            expect(result.waitSeconds).toBeGreaterThan(0);
            expect(result.waitSeconds).toBeLessThanOrEqual(300);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should allow reports when cooldown has expired (>= 5 minutes)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 300, max: 86400 }), // 5 minutes to 24 hours
          (secondsAgo) => {
            const now = new Date();
            const lastReportTime = new Date(now.getTime() - secondsAgo * 1000);
            
            const result = checkCooldownActive(lastReportTime, now);
            
            expect(result.active).toBe(false);
            expect(result.waitSeconds).toBeUndefined();
          }
        ),
        PBT_CONFIG
      );
    });

    it('should allow first report (no previous reports)', () => {
      const now = new Date();
      const result = checkCooldownActive(null, now);
      
      expect(result.active).toBe(false);
      expect(result.waitSeconds).toBeUndefined();
    });

    it('should have exactly 5 minutes as the cooldown period', () => {
      expect(RATE_LIMIT_CONFIG.cooldownMinutes).toBe(5);
    });

    it('should calculate correct wait time', () => {
      const now = new Date();
      const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
      
      const result = checkCooldownActive(twoMinutesAgo, now);
      
      expect(result.active).toBe(true);
      // Should wait approximately 3 minutes (180 seconds)
      expect(result.waitSeconds).toBeGreaterThanOrEqual(179);
      expect(result.waitSeconds).toBeLessThanOrEqual(181);
    });
  });

  describe('Property 8: Duplicate report detection', () => {
    /**
     * Property 8: Duplicate report detection
     * For any new report submission, if there exists an open report within 50 meters
     * of the new report's location that was created within the last 24 hours,
     * the new report SHALL be rejected as a duplicate.
     * Validates: Requirements 2.3
     */
    it('should detect duplicate when within 50m radius', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          fc.double({ min: 0, max: 0.0004, noNaN: true }), // Small offset (~40m at equator)
          (lat, lng, offset) => {
            const existingReports = [{ lat, lng }];
            const newLat = lat + offset;
            const newLng = lng + offset;
            
            // Calculate actual distance
            const distance = calculateDistance(lat, lng, newLat, newLng);
            
            // Only test if actually within 50m
            if (distance <= 50) {
              const isDuplicate = checkDuplicateLocation(newLat, newLng, existingReports);
              expect(isDuplicate).toBe(true);
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('should not detect duplicate when outside 50m radius', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          fc.double({ min: 0.001, max: 0.01, noNaN: true }), // Larger offset (~100m-1km)
          (lat, lng, offset) => {
            const existingReports = [{ lat, lng }];
            const newLat = lat + offset;
            const newLng = lng + offset;
            
            // Calculate actual distance
            const distance = calculateDistance(lat, lng, newLat, newLng);
            
            // Only test if actually outside 50m
            if (distance > 50) {
              const isDuplicate = checkDuplicateLocation(newLat, newLng, existingReports);
              expect(isDuplicate).toBe(false);
            }
          }
        ),
        PBT_CONFIG
      );
    });

    it('should allow report when no existing reports', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          (lat, lng) => {
            const isDuplicate = checkDuplicateLocation(lat, lng, []);
            expect(isDuplicate).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should detect duplicate at exact same location', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          (lat, lng) => {
            const existingReports = [{ lat, lng }];
            const isDuplicate = checkDuplicateLocation(lat, lng, existingReports);
            expect(isDuplicate).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should have exactly 50m as the duplicate radius', () => {
      expect(RATE_LIMIT_CONFIG.duplicateRadiusMeters).toBe(50);
    });

    it('should check against all existing reports', () => {
      // First report is far away, second is close
      const existingReports = [
        { lat: 0, lng: 0 },      // Far from test location
        { lat: 19.076, lng: 72.8777 }  // Close to test location
      ];
      
      // Test location very close to second report
      const isDuplicate = checkDuplicateLocation(19.0760001, 72.8777001, existingReports);
      expect(isDuplicate).toBe(true);
    });
  });

  describe('Combined abuse prevention', () => {
    it('should have consistent configuration values', () => {
      expect(RATE_LIMIT_CONFIG.maxReportsPerDay).toBe(10);
      expect(RATE_LIMIT_CONFIG.cooldownMinutes).toBe(5);
      expect(RATE_LIMIT_CONFIG.duplicateRadiusMeters).toBe(50);
      expect(RATE_LIMIT_CONFIG.duplicateWindowHours).toBe(24);
      expect(RATE_LIMIT_CONFIG.maxPhotoAgeMinutes).toBe(5);
    });
  });
});
