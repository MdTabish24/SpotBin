/**
 * Feature: cleancity-waste-management
 * Property Tests for Validation Utilities
 * 
 * Property 1: Photo timestamp validation
 * Property 2: GPS coordinates captured with photo
 * Property 4: Description length validation
 * 
 * Validates: Requirements 1.3, 1.5, 1.6, 2.4
 */

import fc from 'fast-check';
import {
  validateGpsCoordinates,
  validateGeoLocation,
  validateDescription,
  validatePhotoTimestamp,
  calculateDistance,
  calculateDistanceBetweenLocations,
  isWithinRadius,
  validateDeviceFingerprint,
  validateReportInput
} from '../../src/utils/validation';
import { GeoLocation, RATE_LIMIT_CONFIG } from '../../src/types';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

const validLatitudeGenerator = fc.double({ min: -90, max: 90, noNaN: true });
const validLongitudeGenerator = fc.double({ min: -180, max: 180, noNaN: true });
const validAccuracyGenerator = fc.double({ min: 0, max: 1000, noNaN: true });

const invalidLatitudeGenerator = fc.oneof(
  fc.double({ min: -1000, max: -90.001, noNaN: true }),
  fc.double({ min: 90.001, max: 1000, noNaN: true }),
  fc.constant(NaN)
);

const invalidLongitudeGenerator = fc.oneof(
  fc.double({ min: -1000, max: -180.001, noNaN: true }),
  fc.double({ min: 180.001, max: 1000, noNaN: true }),
  fc.constant(NaN)
);

const validGeoLocationGenerator: fc.Arbitrary<GeoLocation> = fc.record({
  lat: validLatitudeGenerator,
  lng: validLongitudeGenerator,
  accuracy: validAccuracyGenerator
});

const validDescriptionGenerator = fc.string({ maxLength: 50 });
// Generate non-whitespace strings longer than 50 chars
const invalidDescriptionGenerator = fc.stringOf(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p'),
  { minLength: 51, maxLength: 200 }
);

// Generate timestamps within last 4 minutes (with 1 minute buffer for test execution)
const validTimestampGenerator = fc.integer({ min: 0, max: 4 * 60 * 1000 }).map(
  (msAgo) => new Date(Date.now() - msAgo)
);

// Generate timestamps older than 6 minutes (with 1 minute buffer)
const staleTimestampGenerator = fc.integer({ min: 6 * 60 * 1000, max: 24 * 60 * 60 * 1000 }).map(
  (msAgo) => new Date(Date.now() - msAgo)
);

const validDeviceFingerprintGenerator = fc.hexaString({ minLength: 32, maxLength: 64 });

// ============================================
// Property 1: Photo timestamp validation
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 1: Photo timestamp validation', () => {
    /**
     * Property 1: Photo timestamp validation
     * For any photo submitted to the system, if the photo timestamp is older than 5 minutes
     * from the current time, the system SHALL reject the report with an appropriate error.
     * Validates: Requirements 1.5, 2.4
     */
    it('should accept photos taken within the last 5 minutes', () => {
      fc.assert(
        fc.property(validTimestampGenerator, (timestamp) => {
          const result = validatePhotoTimestamp(timestamp);
          expect(result.isValid).toBe(true);
          expect(result.error).toBeUndefined();
          if (result.ageInMinutes !== undefined) {
            expect(result.ageInMinutes).toBeLessThanOrEqual(RATE_LIMIT_CONFIG.maxPhotoAgeMinutes);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should reject photos older than 5 minutes', () => {
      fc.assert(
        fc.property(staleTimestampGenerator, (timestamp) => {
          const result = validatePhotoTimestamp(timestamp);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('5 minutes');
          if (result.ageInMinutes !== undefined) {
            expect(result.ageInMinutes).toBeGreaterThan(RATE_LIMIT_CONFIG.maxPhotoAgeMinutes);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should reject future timestamps', () => {
      const futureTimestampGenerator = fc.date({
        min: new Date(Date.now() + 1000),
        max: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      fc.assert(
        fc.property(futureTimestampGenerator, (timestamp) => {
          const result = validatePhotoTimestamp(timestamp);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('future');
        }),
        PBT_CONFIG
      );
    });

    it('should handle string timestamps correctly', () => {
      // Use fresh timestamps for each test run
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 * 60 * 1000 }),
          (msAgo) => {
            const timestamp = new Date(Date.now() - msAgo);
            const isoString = timestamp.toISOString();
            const result = validatePhotoTimestamp(isoString);
            expect(result.isValid).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should handle numeric timestamps correctly', () => {
      // Use fresh timestamps for each test run
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 4 * 60 * 1000 }),
          (msAgo) => {
            const numericTimestamp = Date.now() - msAgo;
            const result = validatePhotoTimestamp(numericTimestamp);
            expect(result.isValid).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 2: GPS coordinates captured with photo
  // ============================================

  describe('Property 2: GPS coordinates captured with photo', () => {
    /**
     * Property 2: GPS coordinates captured with photo
     * For any successfully created report, the report SHALL contain valid GPS coordinates
     * (latitude between -90 and 90, longitude between -180 and 180) with accuracy metadata.
     * Validates: Requirements 1.3
     */
    it('should accept valid GPS coordinates', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          validAccuracyGenerator,
          (lat, lng, accuracy) => {
            const result = validateGpsCoordinates(lat, lng, accuracy);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject latitude outside -90 to 90 range', () => {
      fc.assert(
        fc.property(
          invalidLatitudeGenerator,
          validLongitudeGenerator,
          (lat, lng) => {
            const result = validateGpsCoordinates(lat, lng);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject longitude outside -180 to 180 range', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          invalidLongitudeGenerator,
          (lat, lng) => {
            const result = validateGpsCoordinates(lat, lng);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject negative accuracy', () => {
      const negativeAccuracyGenerator = fc.double({ min: -1000, max: -0.001, noNaN: true });

      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          negativeAccuracyGenerator,
          (lat, lng, accuracy) => {
            const result = validateGpsCoordinates(lat, lng, accuracy);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Accuracy'))).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should validate GeoLocation objects correctly', () => {
      fc.assert(
        fc.property(validGeoLocationGenerator, (location) => {
          const result = validateGeoLocation(location);
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 4: Description length validation
  // ============================================

  describe('Property 4: Description length validation', () => {
    /**
     * Property 4: Description length validation
     * For any report with a description, the description length SHALL NOT exceed 50 characters.
     * Descriptions longer than 50 characters SHALL be rejected or truncated.
     * Validates: Requirements 1.6
     */
    it('should accept descriptions up to 50 characters', () => {
      fc.assert(
        fc.property(validDescriptionGenerator, (description) => {
          const result = validateDescription(description);
          expect(result.isValid).toBe(true);
          if (result.sanitized !== undefined) {
            expect(result.sanitized.length).toBeLessThanOrEqual(50);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should reject descriptions longer than 50 characters', () => {
      fc.assert(
        fc.property(invalidDescriptionGenerator, (description) => {
          const result = validateDescription(description);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('50');
          // Should provide truncated version
          if (result.sanitized !== undefined) {
            expect(result.sanitized.length).toBeLessThanOrEqual(50);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should accept undefined/null descriptions (optional field)', () => {
      expect(validateDescription(undefined).isValid).toBe(true);
      expect(validateDescription(null).isValid).toBe(true);
    });

    it('should trim whitespace from descriptions', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 40 }),
          (description) => {
            const paddedDescription = `  ${description}  `;
            const result = validateDescription(paddedDescription);
            if (result.sanitized !== undefined) {
              expect(result.sanitized).toBe(description.trim());
            }
            return true;
          }
        ),
        PBT_CONFIG
      );
    });

    it('should treat whitespace-only descriptions as empty', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 1, maxLength: 20 }),
          (whitespace) => {
            const result = validateDescription(whitespace);
            expect(result.isValid).toBe(true);
            expect(result.sanitized).toBeUndefined();
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Distance Calculation Tests
  // ============================================

  describe('Distance calculation (Haversine formula)', () => {
    it('should return 0 for same coordinates', () => {
      fc.assert(
        fc.property(validLatitudeGenerator, validLongitudeGenerator, (lat, lng) => {
          const distance = calculateDistance(lat, lng, lat, lng);
          expect(distance).toBeCloseTo(0, 5);
        }),
        PBT_CONFIG
      );
    });

    it('should return positive distance for different coordinates', () => {
      fc.assert(
        fc.property(
          validGeoLocationGenerator,
          validGeoLocationGenerator,
          (loc1, loc2) => {
            const distance = calculateDistanceBetweenLocations(loc1, loc2);
            expect(distance).toBeGreaterThanOrEqual(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should be symmetric (distance A to B equals B to A)', () => {
      fc.assert(
        fc.property(
          validGeoLocationGenerator,
          validGeoLocationGenerator,
          (loc1, loc2) => {
            const distanceAB = calculateDistanceBetweenLocations(loc1, loc2);
            const distanceBA = calculateDistanceBetweenLocations(loc2, loc1);
            expect(distanceAB).toBeCloseTo(distanceBA, 5);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should correctly identify points within radius', () => {
      // Generate two close points
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          fc.double({ min: 0.00001, max: 0.0001, noNaN: true }), // Small offset
          (lat, lng, offset) => {
            const loc1: GeoLocation = { lat, lng, accuracy: 10 };
            const loc2: GeoLocation = { lat: lat + offset, lng: lng + offset, accuracy: 10 };
            
            const distance = calculateDistanceBetweenLocations(loc1, loc2);
            const largeRadius = distance + 100; // Radius larger than distance
            
            expect(isWithinRadius(loc1, loc2, largeRadius)).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Device Fingerprint Validation
  // ============================================

  describe('Device fingerprint validation', () => {
    it('should accept valid device fingerprints', () => {
      fc.assert(
        fc.property(validDeviceFingerprintGenerator, (fingerprint) => {
          const result = validateDeviceFingerprint(fingerprint);
          expect(result.isValid).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should reject empty fingerprints', () => {
      expect(validateDeviceFingerprint('')).toEqual({
        isValid: false,
        error: 'Device fingerprint cannot be empty'
      });
    });

    it('should reject undefined/null fingerprints', () => {
      expect(validateDeviceFingerprint(undefined).isValid).toBe(false);
      expect(validateDeviceFingerprint(null).isValid).toBe(false);
    });

    it('should reject fingerprints that are too short', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
            { minLength: 1, maxLength: 15 }
          ),
          (shortFingerprint) => {
            const result = validateDeviceFingerprint(shortFingerprint);
            expect(result.isValid).toBe(false);
            // Error could be "empty" or "at least" depending on trimmed length
            expect(result.error).toBeDefined();
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Combined Report Validation
  // ============================================

  describe('Combined report validation', () => {
    it('should validate complete valid report input', () => {
      fc.assert(
        fc.property(
          validLatitudeGenerator,
          validLongitudeGenerator,
          validAccuracyGenerator,
          validDescriptionGenerator,
          fc.integer({ min: 0, max: 4 * 60 * 1000 }), // msAgo for fresh timestamp
          validDeviceFingerprintGenerator,
          (lat, lng, accuracy, description, msAgo, deviceId) => {
            const timestamp = new Date(Date.now() - msAgo);
            const result = validateReportInput({
              lat,
              lng,
              accuracy,
              description,
              timestamp,
              deviceId
            });
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should collect all validation errors', () => {
      // Invalid everything
      const result = validateReportInput({
        lat: 999, // Invalid
        lng: 999, // Invalid
        accuracy: -1, // Invalid
        description: 'a'.repeat(100), // Too long
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // Too old
        deviceId: '' // Empty
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
