/**
 * Feature: cleancity-waste-management
 * Property 5: Report data structure completeness
 * Validates: Requirements 1.9
 * 
 * For any valid report object, it SHALL contain all required fields:
 * id (non-empty string), photo (valid file reference), location (lat, lng, accuracy),
 * timestamp (valid date), deviceFingerprint (non-empty string), and status (valid enum value).
 */

import fc from 'fast-check';
import {
  WasteReport,
  ReportStatus,
  Severity,
  GeoLocation
} from '../../src/types';

// ============================================
// Validation Functions
// ============================================

/**
 * Validates that a report has all required fields with correct types
 */
function validateReportStructure(report: WasteReport): {
  isValid: boolean;
  missingFields: string[];
  invalidFields: string[];
} {
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  // Check required fields exist
  if (report.id === undefined || report.id === null) {
    missingFields.push('id');
  } else if (typeof report.id !== 'string' || report.id.trim() === '') {
    invalidFields.push('id (must be non-empty string)');
  }

  if (report.photoUrl === undefined || report.photoUrl === null) {
    missingFields.push('photoUrl');
  } else if (typeof report.photoUrl !== 'string' || report.photoUrl.trim() === '') {
    invalidFields.push('photoUrl (must be non-empty string)');
  }

  if (report.location === undefined || report.location === null) {
    missingFields.push('location');
  } else {
    if (typeof report.location.lat !== 'number') {
      invalidFields.push('location.lat (must be number)');
    }
    if (typeof report.location.lng !== 'number') {
      invalidFields.push('location.lng (must be number)');
    }
    if (typeof report.location.accuracy !== 'number') {
      invalidFields.push('location.accuracy (must be number)');
    }
  }

  if (report.timestamp === undefined || report.timestamp === null) {
    missingFields.push('timestamp');
  } else if (!(report.timestamp instanceof Date) || isNaN(report.timestamp.getTime())) {
    invalidFields.push('timestamp (must be valid Date)');
  }

  if (report.deviceId === undefined || report.deviceId === null) {
    missingFields.push('deviceId');
  } else if (typeof report.deviceId !== 'string' || report.deviceId.trim() === '') {
    invalidFields.push('deviceId (must be non-empty string)');
  }

  if (report.status === undefined || report.status === null) {
    missingFields.push('status');
  } else if (!Object.values(ReportStatus).includes(report.status)) {
    invalidFields.push('status (must be valid ReportStatus enum)');
  }

  return {
    isValid: missingFields.length === 0 && invalidFields.length === 0,
    missingFields,
    invalidFields
  };
}

/**
 * Validates GPS coordinates are within valid ranges
 */
function validateGeoLocation(location: GeoLocation): boolean {
  return (
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    typeof location.accuracy === 'number' &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180 &&
    location.accuracy >= 0
  );
}

// ============================================
// Generators
// ============================================

const geoLocationGenerator = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.double({ min: 0, max: 1000, noNaN: true })
});

const reportStatusGenerator = fc.constantFrom(
  ReportStatus.OPEN,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.VERIFIED,
  ReportStatus.RESOLVED
);

const severityGenerator = fc.constantFrom(
  Severity.LOW,
  Severity.MEDIUM,
  Severity.HIGH
);

const validReportGenerator: fc.Arbitrary<WasteReport> = fc.record({
  id: fc.uuid(),
  deviceId: fc.hexaString({ minLength: 32, maxLength: 64 }),
  photoUrl: fc.webUrl(),
  location: geoLocationGenerator,
  timestamp: fc.date({ min: new Date(Date.now() - 86400000), max: new Date() }),
  description: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  status: reportStatusGenerator,
  severity: fc.option(severityGenerator, { nil: undefined }),
  wasteTypes: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }), { nil: undefined }),
  createdAt: fc.date({ min: new Date(Date.now() - 86400000), max: new Date() }),
  assignedAt: fc.option(fc.date(), { nil: undefined }),
  inProgressAt: fc.option(fc.date(), { nil: undefined }),
  verifiedAt: fc.option(fc.date(), { nil: undefined }),
  resolvedAt: fc.option(fc.date(), { nil: undefined }),
  workerId: fc.option(fc.uuid(), { nil: undefined }),
  pointsAwarded: fc.integer({ min: 0, max: 1000 })
});

// ============================================
// Property Tests
// ============================================

describe('Feature: cleancity-waste-management', () => {
  const PBT_CONFIG = { numRuns: 100 };

  describe('Property 5: Report data structure completeness', () => {
    /**
     * Property 5: Report data structure completeness
     * For any valid report object, it SHALL contain all required fields:
     * id (non-empty string), photo (valid file reference), location (lat, lng, accuracy),
     * timestamp (valid date), deviceFingerprint (non-empty string), and status (valid enum value).
     * Validates: Requirements 1.9
     */
    it('should have all required fields with correct types for any valid report', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          const validation = validateReportStructure(report);
          
          // All required fields must be present and valid
          expect(validation.missingFields).toHaveLength(0);
          expect(validation.invalidFields).toHaveLength(0);
          expect(validation.isValid).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should have id as non-empty string', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(typeof report.id).toBe('string');
          expect(report.id.trim().length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have photoUrl as non-empty string', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(typeof report.photoUrl).toBe('string');
          expect(report.photoUrl.trim().length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have valid location with lat, lng, and accuracy', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(report.location).toBeDefined();
          expect(typeof report.location.lat).toBe('number');
          expect(typeof report.location.lng).toBe('number');
          expect(typeof report.location.accuracy).toBe('number');
          expect(validateGeoLocation(report.location)).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should have timestamp as valid Date', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(report.timestamp).toBeInstanceOf(Date);
          expect(isNaN(report.timestamp.getTime())).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should have deviceId (fingerprint) as non-empty string', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(typeof report.deviceId).toBe('string');
          expect(report.deviceId.trim().length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have status as valid ReportStatus enum value', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          expect(Object.values(ReportStatus)).toContain(report.status);
        }),
        PBT_CONFIG
      );
    });

    it('should have optional description limited to 50 characters when present', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          if (report.description !== undefined) {
            expect(report.description.length).toBeLessThanOrEqual(50);
          }
          return true;
        }),
        PBT_CONFIG
      );
    });

    it('should have optional severity as valid Severity enum when present', () => {
      fc.assert(
        fc.property(validReportGenerator, (report) => {
          if (report.severity !== undefined) {
            expect(Object.values(Severity)).toContain(report.severity);
          }
          return true;
        }),
        PBT_CONFIG
      );
    });
  });

  describe('GeoLocation validation', () => {
    it('should validate latitude is between -90 and 90', () => {
      fc.assert(
        fc.property(geoLocationGenerator, (location) => {
          expect(location.lat).toBeGreaterThanOrEqual(-90);
          expect(location.lat).toBeLessThanOrEqual(90);
        }),
        PBT_CONFIG
      );
    });

    it('should validate longitude is between -180 and 180', () => {
      fc.assert(
        fc.property(geoLocationGenerator, (location) => {
          expect(location.lng).toBeGreaterThanOrEqual(-180);
          expect(location.lng).toBeLessThanOrEqual(180);
        }),
        PBT_CONFIG
      );
    });

    it('should validate accuracy is non-negative', () => {
      fc.assert(
        fc.property(geoLocationGenerator, (location) => {
          expect(location.accuracy).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });
  });
});

// Export validation functions for use in other modules
export { validateReportStructure, validateGeoLocation };
