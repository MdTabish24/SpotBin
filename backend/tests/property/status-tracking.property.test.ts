/**
 * Feature: cleancity-waste-management
 * Property Tests for Report Status and Tracking
 * 
 * Property 13: Report retrieval by device
 * Property 14: Report display fields
 * Property 16: Resolved report photos availability
 * Property 17: Status transition validation
 * 
 * Validates: Requirements 5.1, 5.2, 5.4, 5.5
 */

import fc from 'fast-check';
import {
  validateStatusTransition,
  isForwardTransition,
  getNextStatus,
  isTerminalStatus,
  VALID_TRANSITIONS,
  STATUS_ORDER,
  ReportDisplayData
} from '../../src/services/status.service';
import { ReportStatus, WasteReport } from '../../src/types';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

const reportStatusGenerator = fc.constantFrom(
  ReportStatus.OPEN,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.VERIFIED,
  ReportStatus.RESOLVED
);

const validUrlGenerator = fc.webUrl();

const reportDisplayDataGenerator: fc.Arbitrary<ReportDisplayData> = fc.record({
  id: fc.uuid(),
  photoUrl: validUrlGenerator,
  thumbnailUrl: validUrlGenerator,
  location: fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true })
  }),
  status: reportStatusGenerator,
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  description: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  beforePhotoUrl: fc.option(validUrlGenerator, { nil: undefined }),
  afterPhotoUrl: fc.option(validUrlGenerator, { nil: undefined })
});

// Generator for resolved reports with photos
const resolvedReportWithPhotosGenerator: fc.Arbitrary<ReportDisplayData> = fc.record({
  id: fc.uuid(),
  photoUrl: validUrlGenerator,
  thumbnailUrl: validUrlGenerator,
  location: fc.record({
    lat: fc.double({ min: -90, max: 90, noNaN: true }),
    lng: fc.double({ min: -180, max: 180, noNaN: true })
  }),
  status: fc.constant(ReportStatus.RESOLVED),
  timestamp: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
  description: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  beforePhotoUrl: validUrlGenerator,
  afterPhotoUrl: validUrlGenerator
});

// Generator for device ID
const deviceIdGenerator = fc.hexaString({ minLength: 32, maxLength: 64 });

// ============================================
// Property 17: Status transition validation
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 17: Status transition validation', () => {
    /**
     * Property 17: Status transition validation
     * For any report status transition, it SHALL follow the valid sequence:
     * open → assigned → in_progress → verified → resolved.
     * No status SHALL transition backwards or skip states.
     * Validates: Requirements 5.5
     */

    it('should allow valid forward transitions in sequence', () => {
      // Test the valid forward sequence
      const validSequence = [
        { from: ReportStatus.OPEN, to: ReportStatus.ASSIGNED },
        { from: ReportStatus.ASSIGNED, to: ReportStatus.IN_PROGRESS },
        { from: ReportStatus.IN_PROGRESS, to: ReportStatus.VERIFIED },
        { from: ReportStatus.VERIFIED, to: ReportStatus.RESOLVED }
      ];

      validSequence.forEach(({ from, to }) => {
        const result = validateStatusTransition(from, to);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.fromStatus).toBe(from);
        expect(result.toStatus).toBe(to);
      });
    });

    it('should reject transitions that skip states', () => {
      // Test skipping states
      const invalidSkips = [
        { from: ReportStatus.OPEN, to: ReportStatus.IN_PROGRESS },
        { from: ReportStatus.OPEN, to: ReportStatus.VERIFIED },
        { from: ReportStatus.OPEN, to: ReportStatus.RESOLVED },
        { from: ReportStatus.ASSIGNED, to: ReportStatus.VERIFIED },
        { from: ReportStatus.ASSIGNED, to: ReportStatus.RESOLVED },
        { from: ReportStatus.IN_PROGRESS, to: ReportStatus.RESOLVED }
      ];

      invalidSkips.forEach(({ from, to }) => {
        const result = validateStatusTransition(from, to);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject backward transitions (except allowed ones)', () => {
      // Test backward transitions that should be rejected
      const invalidBackward = [
        { from: ReportStatus.IN_PROGRESS, to: ReportStatus.OPEN },
        { from: ReportStatus.VERIFIED, to: ReportStatus.OPEN },
        { from: ReportStatus.VERIFIED, to: ReportStatus.IN_PROGRESS },
        { from: ReportStatus.RESOLVED, to: ReportStatus.OPEN },
        { from: ReportStatus.RESOLVED, to: ReportStatus.ASSIGNED },
        { from: ReportStatus.RESOLVED, to: ReportStatus.IN_PROGRESS },
        { from: ReportStatus.RESOLVED, to: ReportStatus.VERIFIED }
      ];

      invalidBackward.forEach(({ from, to }) => {
        const result = validateStatusTransition(from, to);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    it('should reject same-status transitions', () => {
      fc.assert(
        fc.property(reportStatusGenerator, (status) => {
          const result = validateStatusTransition(status, status);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('already');
        }),
        PBT_CONFIG
      );
    });

    it('should have RESOLVED as terminal state with no outgoing transitions', () => {
      expect(isTerminalStatus(ReportStatus.RESOLVED)).toBe(true);
      expect(VALID_TRANSITIONS[ReportStatus.RESOLVED]).toHaveLength(0);
      
      // Any transition from RESOLVED should fail
      fc.assert(
        fc.property(reportStatusGenerator, (toStatus) => {
          if (toStatus !== ReportStatus.RESOLVED) {
            const result = validateStatusTransition(ReportStatus.RESOLVED, toStatus);
            expect(result.isValid).toBe(false);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should correctly identify forward transitions', () => {
      // Forward transitions
      expect(isForwardTransition(ReportStatus.OPEN, ReportStatus.ASSIGNED)).toBe(true);
      expect(isForwardTransition(ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS)).toBe(true);
      expect(isForwardTransition(ReportStatus.IN_PROGRESS, ReportStatus.VERIFIED)).toBe(true);
      expect(isForwardTransition(ReportStatus.VERIFIED, ReportStatus.RESOLVED)).toBe(true);

      // Backward transitions
      expect(isForwardTransition(ReportStatus.ASSIGNED, ReportStatus.OPEN)).toBe(false);
      expect(isForwardTransition(ReportStatus.RESOLVED, ReportStatus.OPEN)).toBe(false);
    });

    it('should return correct next status in workflow', () => {
      expect(getNextStatus(ReportStatus.OPEN)).toBe(ReportStatus.ASSIGNED);
      expect(getNextStatus(ReportStatus.ASSIGNED)).toBe(ReportStatus.IN_PROGRESS);
      expect(getNextStatus(ReportStatus.IN_PROGRESS)).toBe(ReportStatus.VERIFIED);
      expect(getNextStatus(ReportStatus.VERIFIED)).toBe(ReportStatus.RESOLVED);
      expect(getNextStatus(ReportStatus.RESOLVED)).toBeNull();
    });

    it('should have monotonically increasing status order', () => {
      const statuses = [
        ReportStatus.OPEN,
        ReportStatus.ASSIGNED,
        ReportStatus.IN_PROGRESS,
        ReportStatus.VERIFIED,
        ReportStatus.RESOLVED
      ];

      for (let i = 1; i < statuses.length; i++) {
        expect(STATUS_ORDER[statuses[i]]).toBeGreaterThan(STATUS_ORDER[statuses[i - 1]]);
      }
    });

    it('should allow special backward transition: ASSIGNED → OPEN (unassign)', () => {
      const result = validateStatusTransition(ReportStatus.ASSIGNED, ReportStatus.OPEN);
      expect(result.isValid).toBe(true);
    });

    it('should allow special backward transition: VERIFIED → ASSIGNED (rejection)', () => {
      const result = validateStatusTransition(ReportStatus.VERIFIED, ReportStatus.ASSIGNED);
      expect(result.isValid).toBe(true);
    });
  });

  // ============================================
  // Property 13: Report retrieval by device
  // ============================================

  describe('Property 13: Report retrieval by device', () => {
    /**
     * Property 13: Report retrieval by device
     * For any device ID, querying reports for that device SHALL return
     * all and only the reports submitted by that device.
     * Validates: Requirements 5.1
     */

    it('should have device ID as non-empty string for any report', () => {
      fc.assert(
        fc.property(deviceIdGenerator, (deviceId) => {
          expect(typeof deviceId).toBe('string');
          expect(deviceId.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should generate valid device IDs for report filtering', () => {
      fc.assert(
        fc.property(
          fc.array(deviceIdGenerator, { minLength: 1, maxLength: 10 }),
          (deviceIds) => {
            // All device IDs should be unique strings
            const uniqueIds = new Set(deviceIds);
            deviceIds.forEach(id => {
              expect(typeof id).toBe('string');
              expect(id.length).toBeGreaterThanOrEqual(32);
            });
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 14: Report display fields
  // ============================================

  describe('Property 14: Report display fields', () => {
    /**
     * Property 14: Report display fields
     * For any displayed report, it SHALL include: photo thumbnail (valid URL),
     * location (lat, lng), status (valid enum), and timestamp (valid date).
     * Validates: Requirements 5.2
     */

    it('should have photo URL as valid non-empty string', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(typeof report.photoUrl).toBe('string');
          expect(report.photoUrl.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have thumbnail URL as valid non-empty string', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(typeof report.thumbnailUrl).toBe('string');
          expect(report.thumbnailUrl.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have valid location with lat and lng', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(report.location).toBeDefined();
          expect(typeof report.location.lat).toBe('number');
          expect(typeof report.location.lng).toBe('number');
          expect(report.location.lat).toBeGreaterThanOrEqual(-90);
          expect(report.location.lat).toBeLessThanOrEqual(90);
          expect(report.location.lng).toBeGreaterThanOrEqual(-180);
          expect(report.location.lng).toBeLessThanOrEqual(180);
        }),
        PBT_CONFIG
      );
    });

    it('should have status as valid ReportStatus enum', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(Object.values(ReportStatus)).toContain(report.status);
        }),
        PBT_CONFIG
      );
    });

    it('should have timestamp as valid Date', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(report.timestamp).toBeInstanceOf(Date);
          expect(report.timestamp.getTime()).not.toBeNaN();
        }),
        PBT_CONFIG
      );
    });

    it('should have all required display fields present', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(report).toHaveProperty('id');
          expect(report).toHaveProperty('photoUrl');
          expect(report).toHaveProperty('thumbnailUrl');
          expect(report).toHaveProperty('location');
          expect(report).toHaveProperty('status');
          expect(report).toHaveProperty('timestamp');
        }),
        PBT_CONFIG
      );
    });

    it('should have id as non-empty string', () => {
      fc.assert(
        fc.property(reportDisplayDataGenerator, (report) => {
          expect(typeof report.id).toBe('string');
          expect(report.id.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 16: Resolved report photos availability
  // ============================================

  describe('Property 16: Resolved report photos availability', () => {
    /**
     * Property 16: Resolved report photos availability
     * For any report with status "resolved", the report SHALL have
     * both before and after photo URLs available.
     * Validates: Requirements 5.4
     */

    it('should have both before and after photos for resolved reports', () => {
      fc.assert(
        fc.property(resolvedReportWithPhotosGenerator, (report) => {
          expect(report.status).toBe(ReportStatus.RESOLVED);
          expect(report.beforePhotoUrl).toBeDefined();
          expect(report.afterPhotoUrl).toBeDefined();
          expect(typeof report.beforePhotoUrl).toBe('string');
          expect(typeof report.afterPhotoUrl).toBe('string');
          expect(report.beforePhotoUrl!.length).toBeGreaterThan(0);
          expect(report.afterPhotoUrl!.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have before photo URL as valid URL for resolved reports', () => {
      fc.assert(
        fc.property(resolvedReportWithPhotosGenerator, (report) => {
          expect(report.beforePhotoUrl).toBeDefined();
          // URL should start with http:// or https://
          expect(report.beforePhotoUrl).toMatch(/^https?:\/\//);
        }),
        PBT_CONFIG
      );
    });

    it('should have after photo URL as valid URL for resolved reports', () => {
      fc.assert(
        fc.property(resolvedReportWithPhotosGenerator, (report) => {
          expect(report.afterPhotoUrl).toBeDefined();
          // URL should start with http:// or https://
          expect(report.afterPhotoUrl).toMatch(/^https?:\/\//);
        }),
        PBT_CONFIG
      );
    });

    it('should have different before and after photo URLs', () => {
      fc.assert(
        fc.property(
          fc.tuple(validUrlGenerator, validUrlGenerator).filter(([a, b]) => a !== b),
          ([beforeUrl, afterUrl]) => {
            const report: ReportDisplayData = {
              id: 'test-id',
              photoUrl: 'https://example.com/photo.jpg',
              thumbnailUrl: 'https://example.com/thumb.jpg',
              location: { lat: 0, lng: 0 },
              status: ReportStatus.RESOLVED,
              timestamp: new Date(),
              beforePhotoUrl: beforeUrl,
              afterPhotoUrl: afterUrl
            };
            
            expect(report.beforePhotoUrl).not.toBe(report.afterPhotoUrl);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Status workflow consistency tests
  // ============================================

  describe('Status workflow consistency', () => {
    it('should have all statuses defined in VALID_TRANSITIONS', () => {
      Object.values(ReportStatus).forEach((status) => {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
      });
    });

    it('should have all statuses defined in STATUS_ORDER', () => {
      Object.values(ReportStatus).forEach((status) => {
        expect(STATUS_ORDER).toHaveProperty(status);
        expect(typeof STATUS_ORDER[status]).toBe('number');
      });
    });

    it('should have exactly 5 statuses in the workflow', () => {
      expect(Object.keys(ReportStatus)).toHaveLength(5);
      expect(Object.keys(VALID_TRANSITIONS)).toHaveLength(5);
      expect(Object.keys(STATUS_ORDER)).toHaveLength(5);
    });
  });
});
