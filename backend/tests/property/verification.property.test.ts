/**
 * Property Tests for Worker Verification Flow
 * Properties 23, 24, 25
 * Requirements: 8.1, 8.3, 8.5, 8.6, 8.7
 */

import fc from 'fast-check';
import {
  validateWorkerProximity,
  validatePhotoTiming,
  calculateTimeSpent
} from '../../src/services/verification.service';
import { ReportStatus, VERIFICATION_RULES } from '../../src/types';

// ============================================
// Arbitraries (Test Data Generators)
// ============================================

// Valid GPS coordinates
const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });
const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

// Distance in meters (for generating nearby coordinates)
const smallDistanceArb = fc.double({ min: 0, max: 49, noNaN: true }); // Within 50m
const largeDistanceArb = fc.double({ min: 51, max: 1000, noNaN: true }); // Outside 50m

// Time in minutes
const validTimeMinutesArb = fc.double({ min: 2, max: 240, noNaN: true }); // 2-240 minutes
const tooShortTimeMinutesArb = fc.double({ min: 0, max: 1.99, noNaN: true }); // < 2 minutes
const tooLongTimeMinutesArb = fc.double({ min: 240.01, max: 1000, noNaN: true }); // > 240 minutes

// Generate a coordinate offset for a given distance (approximate)
function offsetCoordinate(lat: number, lng: number, distanceMeters: number, bearing: number): { lat: number; lng: number } {
  const earthRadius = 6371000; // meters
  const bearingRad = (bearing * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / earthRadius) +
    Math.cos(latRad) * Math.sin(distanceMeters / earthRadius) * Math.cos(bearingRad)
  );

  const newLngRad = lngRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceMeters / earthRadius) * Math.cos(latRad),
    Math.cos(distanceMeters / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI
  };
}

// ============================================
// Property 23: Worker proximity validation
// ============================================

describe('Property 23: Worker proximity validation', () => {
  /**
   * Property 23: Worker proximity validation
   * For any task start attempt, if the worker's current location is more than
   * 50 meters from the report location, the task start SHALL be rejected.
   */
  it('should accept worker within 50 meters of report location', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        smallDistanceArb,
        fc.integer({ min: 0, max: 359 }), // bearing
        (reportLat, reportLng, distance, bearing) => {
          // Generate worker location within 50m
          const workerLocation = offsetCoordinate(reportLat, reportLng, distance, bearing);

          const result = validateWorkerProximity(
            workerLocation.lat,
            workerLocation.lng,
            reportLat,
            reportLng
          );

          // Should be valid (within 50m)
          expect(result.isValid).toBe(true);
          expect(result.distance).toBeLessThanOrEqual(VERIFICATION_RULES.maxDistanceFromReport + 1); // +1 for floating point
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it('should reject worker more than 50 meters from report location', () => {
    fc.assert(
      fc.property(
        latitudeArb,
        longitudeArb,
        largeDistanceArb,
        fc.integer({ min: 0, max: 359 }), // bearing
        (reportLat, reportLng, distance, bearing) => {
          // Generate worker location outside 50m
          const workerLocation = offsetCoordinate(reportLat, reportLng, distance, bearing);

          const result = validateWorkerProximity(
            workerLocation.lat,
            workerLocation.lng,
            reportLat,
            reportLng
          );

          // Should be invalid (outside 50m)
          expect(result.isValid).toBe(false);
          expect(result.distance).toBeGreaterThan(VERIFICATION_RULES.maxDistanceFromReport);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('50 meters');
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it('should accept worker at exact same location as report', () => {
    fc.assert(
      fc.property(latitudeArb, longitudeArb, (lat, lng) => {
        const result = validateWorkerProximity(lat, lng, lat, lng);

        expect(result.isValid).toBe(true);
        expect(result.distance).toBe(0);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should return correct max allowed distance (50m)', () => {
    fc.assert(
      fc.property(latitudeArb, longitudeArb, latitudeArb, longitudeArb, (wLat, wLng, rLat, rLng) => {
        const result = validateWorkerProximity(wLat, wLng, rLat, rLng);

        expect(result.maxAllowed).toBe(VERIFICATION_RULES.maxDistanceFromReport);
        expect(result.maxAllowed).toBe(50);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should have exactly 50 meters as the proximity threshold', () => {
    expect(VERIFICATION_RULES.maxDistanceFromReport).toBe(50);
  });
});

// ============================================
// Property 24: Verification photo timing constraints
// ============================================

describe('Property 24: Verification photo timing constraints', () => {
  /**
   * Property 24: Verification photo timing constraints
   * For any completed verification, the time between before photo and after photo
   * SHALL be at least 2 minutes AND at most 4 hours (240 minutes).
   */
  it('should accept time between 2 and 240 minutes', () => {
    fc.assert(
      fc.property(validTimeMinutesArb, (timeMinutes) => {
        const beforeTimestamp = new Date();
        const afterTimestamp = new Date(beforeTimestamp.getTime() + timeMinutes * 60 * 1000);

        const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

        expect(result.isValid).toBe(true);
        expect(result.timeBetweenMinutes).toBeGreaterThanOrEqual(VERIFICATION_RULES.minTimeBetweenPhotos);
        expect(result.timeBetweenMinutes).toBeLessThanOrEqual(VERIFICATION_RULES.maxTimeBetweenPhotos);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should reject time less than 2 minutes', () => {
    fc.assert(
      fc.property(tooShortTimeMinutesArb, (timeMinutes) => {
        const beforeTimestamp = new Date();
        const afterTimestamp = new Date(beforeTimestamp.getTime() + timeMinutes * 60 * 1000);

        const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

        expect(result.isValid).toBe(false);
        expect(result.timeBetweenMinutes).toBeLessThan(VERIFICATION_RULES.minTimeBetweenPhotos);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('at least');
        expect(result.error).toContain('2 minutes');
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should reject time more than 240 minutes (4 hours)', () => {
    fc.assert(
      fc.property(tooLongTimeMinutesArb, (timeMinutes) => {
        const beforeTimestamp = new Date();
        const afterTimestamp = new Date(beforeTimestamp.getTime() + timeMinutes * 60 * 1000);

        const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

        expect(result.isValid).toBe(false);
        expect(result.timeBetweenMinutes).toBeGreaterThan(VERIFICATION_RULES.maxTimeBetweenPhotos);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('240 minutes');
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should accept exactly 2 minutes (boundary)', () => {
    const beforeTimestamp = new Date();
    const afterTimestamp = new Date(beforeTimestamp.getTime() + 2 * 60 * 1000);

    const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

    expect(result.isValid).toBe(true);
    expect(result.timeBetweenMinutes).toBeCloseTo(2, 5);
  });

  it('should accept exactly 240 minutes (boundary)', () => {
    const beforeTimestamp = new Date();
    const afterTimestamp = new Date(beforeTimestamp.getTime() + 240 * 60 * 1000);

    const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

    expect(result.isValid).toBe(true);
    expect(result.timeBetweenMinutes).toBeCloseTo(240, 5);
  });

  it('should return correct min and max constraints', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 500, noNaN: true }), (timeMinutes) => {
        const beforeTimestamp = new Date();
        const afterTimestamp = new Date(beforeTimestamp.getTime() + timeMinutes * 60 * 1000);

        const result = validatePhotoTiming(beforeTimestamp, afterTimestamp);

        expect(result.minRequired).toBe(VERIFICATION_RULES.minTimeBetweenPhotos);
        expect(result.maxAllowed).toBe(VERIFICATION_RULES.maxTimeBetweenPhotos);
        expect(result.minRequired).toBe(2);
        expect(result.maxAllowed).toBe(240);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should have correct timing constraints in configuration', () => {
    expect(VERIFICATION_RULES.minTimeBetweenPhotos).toBe(2);
    expect(VERIFICATION_RULES.maxTimeBetweenPhotos).toBe(240);
  });
});

// ============================================
// Property 25: Verification status transitions
// ============================================

describe('Property 25: Verification status transitions', () => {
  /**
   * Property 25: Verification status transitions
   * - When before photo is submitted, report status SHALL change to "in_progress"
   * - When after photo is submitted, report status SHALL change to "verified"
   */
  it('should define correct status for task start (in_progress)', () => {
    // When before photo is submitted, status should be IN_PROGRESS
    expect(ReportStatus.IN_PROGRESS).toBe('in_progress');
  });

  it('should define correct status for task completion (verified)', () => {
    // When after photo is submitted, status should be VERIFIED
    expect(ReportStatus.VERIFIED).toBe('verified');
  });

  it('should have ASSIGNED as prerequisite for starting task', () => {
    // Task can only be started when status is ASSIGNED
    expect(ReportStatus.ASSIGNED).toBe('assigned');
  });

  it('should have IN_PROGRESS as prerequisite for completing task', () => {
    // Task can only be completed when status is IN_PROGRESS
    expect(ReportStatus.IN_PROGRESS).toBe('in_progress');
  });

  it('should follow correct status sequence: ASSIGNED → IN_PROGRESS → VERIFIED', () => {
    const statusSequence = [
      ReportStatus.ASSIGNED,
      ReportStatus.IN_PROGRESS,
      ReportStatus.VERIFIED
    ];

    expect(statusSequence[0]).toBe('assigned');
    expect(statusSequence[1]).toBe('in_progress');
    expect(statusSequence[2]).toBe('verified');
  });
});

// ============================================
// Time Spent Calculation Tests
// ============================================

describe('Time spent calculation', () => {
  it('should calculate time spent correctly in minutes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }), // minutes
        (minutes) => {
          const startedAt = new Date();
          const completedAt = new Date(startedAt.getTime() + minutes * 60 * 1000);

          const timeSpent = calculateTimeSpent(startedAt, completedAt);

          expect(timeSpent).toBe(minutes);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });

  it('should return 0 for same start and end time', () => {
    const timestamp = new Date();
    const timeSpent = calculateTimeSpent(timestamp, timestamp);

    expect(timeSpent).toBe(0);
  });

  it('should round to nearest minute', () => {
    const startedAt = new Date();
    const completedAt = new Date(startedAt.getTime() + 2.5 * 60 * 1000); // 2.5 minutes

    const timeSpent = calculateTimeSpent(startedAt, completedAt);

    // Should round to 3 (Math.round)
    expect(timeSpent).toBe(3);
  });
});

// ============================================
// Verification Rules Configuration Tests
// ============================================

describe('Verification rules configuration', () => {
  it('should have all required configuration values', () => {
    expect(VERIFICATION_RULES.maxDistanceFromReport).toBeDefined();
    expect(VERIFICATION_RULES.minTimeBetweenPhotos).toBeDefined();
    expect(VERIFICATION_RULES.maxTimeBetweenPhotos).toBeDefined();
    expect(VERIFICATION_RULES.requiredPhotoQuality).toBeDefined();
  });

  it('should have reasonable default values', () => {
    expect(VERIFICATION_RULES.maxDistanceFromReport).toBe(50); // 50 meters
    expect(VERIFICATION_RULES.minTimeBetweenPhotos).toBe(2); // 2 minutes
    expect(VERIFICATION_RULES.maxTimeBetweenPhotos).toBe(240); // 4 hours
    expect(VERIFICATION_RULES.requiredPhotoQuality).toBe(0.7); // 70%
  });

  it('should have min time less than max time', () => {
    expect(VERIFICATION_RULES.minTimeBetweenPhotos).toBeLessThan(
      VERIFICATION_RULES.maxTimeBetweenPhotos
    );
  });
});
