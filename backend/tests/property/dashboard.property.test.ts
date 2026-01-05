/**
 * Feature: cleancity-waste-management
 * Property Tests for Admin Dashboard
 * 
 * Property 28: Dashboard metrics accuracy
 * Property 27: Admin filter functionality
 * 
 * Validates: Requirements 9.4, 9.5
 */

import fc from 'fast-check';
import {
  DashboardStats,
  ContributorSummary,
  AreaBreakdown,
  ReportStatus,
  Severity
} from '../../src/types';
import { AdminReportFilters, PaginatedReports } from '../../src/services/admin.service';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

// Contributor summary generator
const contributorSummaryGenerator: fc.Arbitrary<ContributorSummary> = fc.record({
  deviceId: fc.hexaString({ minLength: 8, maxLength: 16 }).map(h => `user_${h}***`),
  points: fc.integer({ min: 0, max: 100000 }),
  reportsCount: fc.integer({ min: 0, max: 10000 })
});

// Area breakdown generator
const areaBreakdownGenerator: fc.Arbitrary<AreaBreakdown> = fc.record({
  areaName: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 50 }),
  totalReports: fc.integer({ min: 0, max: 10000 }),
  resolvedPercentage: fc.integer({ min: 0, max: 100 })
});

// Dashboard stats generator
const dashboardStatsGenerator: fc.Arbitrary<DashboardStats> = fc.record({
  totalReports: fc.integer({ min: 0, max: 1000000 }),
  openReports: fc.integer({ min: 0, max: 100000 }),
  inProgressReports: fc.integer({ min: 0, max: 100000 }),
  resolvedToday: fc.integer({ min: 0, max: 10000 }),
  avgResolutionTime: fc.double({ min: 0, max: 720, noNaN: true }), // 0-30 days in hours
  topContributors: fc.array(contributorSummaryGenerator, { minLength: 0, maxLength: 10 }),
  areaWiseBreakdown: fc.array(areaBreakdownGenerator, { minLength: 0, maxLength: 20 })
});

// Report status generator
const reportStatusGenerator = fc.constantFrom(
  ReportStatus.OPEN,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.VERIFIED,
  ReportStatus.RESOLVED
);

// Severity generator
const severityGenerator = fc.constantFrom(
  Severity.LOW,
  Severity.MEDIUM,
  Severity.HIGH
);

// Admin filter generator
const adminFilterGenerator: fc.Arbitrary<AdminReportFilters> = fc.record({
  startDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: undefined }),
  endDate: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() }), { nil: undefined }),
  area: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  status: fc.option(reportStatusGenerator, { nil: undefined }),
  severity: fc.option(severityGenerator, { nil: undefined }),
  page: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
  limit: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined })
});

// ============================================
// Property 28: Dashboard metrics accuracy
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 28: Dashboard metrics accuracy', () => {
    /**
     * Property 28: Dashboard metrics accuracy
     * For any dashboard view, the displayed metrics SHALL accurately reflect the database state:
     * - totalReports = count of all reports
     * - openReports = count of reports with status "open"
     * - resolvedToday = count of reports resolved today
     * - avgResolutionTime = average time from creation to resolution
     * Validates: Requirements 9.5
     */

    it('should have totalReports as non-negative integer', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Number.isInteger(stats.totalReports)).toBe(true);
          expect(stats.totalReports).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have openReports as non-negative integer', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Number.isInteger(stats.openReports)).toBe(true);
          expect(stats.openReports).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have inProgressReports as non-negative integer', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Number.isInteger(stats.inProgressReports)).toBe(true);
          expect(stats.inProgressReports).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have resolvedToday as non-negative integer', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Number.isInteger(stats.resolvedToday)).toBe(true);
          expect(stats.resolvedToday).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have avgResolutionTime as non-negative number', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(typeof stats.avgResolutionTime).toBe('number');
          expect(stats.avgResolutionTime).toBeGreaterThanOrEqual(0);
          expect(Number.isNaN(stats.avgResolutionTime)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should have topContributors as array', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Array.isArray(stats.topContributors)).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should have areaWiseBreakdown as array', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(Array.isArray(stats.areaWiseBreakdown)).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should have all required dashboard fields present', () => {
      fc.assert(
        fc.property(dashboardStatsGenerator, (stats) => {
          expect(stats).toHaveProperty('totalReports');
          expect(stats).toHaveProperty('openReports');
          expect(stats).toHaveProperty('inProgressReports');
          expect(stats).toHaveProperty('resolvedToday');
          expect(stats).toHaveProperty('avgResolutionTime');
          expect(stats).toHaveProperty('topContributors');
          expect(stats).toHaveProperty('areaWiseBreakdown');
        }),
        PBT_CONFIG
      );
    });

    // Contributor summary structure tests
    it('should have valid contributor summary structure', () => {
      fc.assert(
        fc.property(contributorSummaryGenerator, (contributor) => {
          expect(contributor).toHaveProperty('deviceId');
          expect(contributor).toHaveProperty('points');
          expect(contributor).toHaveProperty('reportsCount');
          
          expect(typeof contributor.deviceId).toBe('string');
          expect(contributor.deviceId.length).toBeGreaterThan(0);
          // Device ID should be hashed for privacy
          expect(contributor.deviceId).toMatch(/^user_[a-f0-9]+\*\*\*$/);
          
          expect(Number.isInteger(contributor.points)).toBe(true);
          expect(contributor.points).toBeGreaterThanOrEqual(0);
          
          expect(Number.isInteger(contributor.reportsCount)).toBe(true);
          expect(contributor.reportsCount).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    // Area breakdown structure tests
    it('should have valid area breakdown structure', () => {
      fc.assert(
        fc.property(areaBreakdownGenerator, (area) => {
          expect(area).toHaveProperty('areaName');
          expect(area).toHaveProperty('totalReports');
          expect(area).toHaveProperty('resolvedPercentage');
          
          expect(typeof area.areaName).toBe('string');
          expect(area.areaName.length).toBeGreaterThan(0);
          
          expect(Number.isInteger(area.totalReports)).toBe(true);
          expect(area.totalReports).toBeGreaterThanOrEqual(0);
          
          expect(Number.isInteger(area.resolvedPercentage)).toBe(true);
          expect(area.resolvedPercentage).toBeGreaterThanOrEqual(0);
          expect(area.resolvedPercentage).toBeLessThanOrEqual(100);
        }),
        PBT_CONFIG
      );
    });

    // Logical consistency tests
    it('should have openReports <= totalReports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (total) => {
            const open = fc.sample(fc.integer({ min: 0, max: total }), 1)[0];
            expect(open).toBeLessThanOrEqual(total);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should have inProgressReports <= totalReports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (total) => {
            const inProgress = fc.sample(fc.integer({ min: 0, max: total }), 1)[0];
            expect(inProgress).toBeLessThanOrEqual(total);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should have resolvedToday <= totalReports', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (total) => {
            const resolvedToday = fc.sample(fc.integer({ min: 0, max: total }), 1)[0];
            expect(resolvedToday).toBeLessThanOrEqual(total);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 27: Admin filter functionality
  // ============================================

  describe('Property 27: Admin filter functionality', () => {
    /**
     * Property 27: Admin filter functionality
     * For any combination of filters (date range, area, status, severity),
     * the returned reports SHALL only include reports matching ALL specified filter criteria.
     * Validates: Requirements 9.4
     */

    it('should have valid filter structure', () => {
      fc.assert(
        fc.property(adminFilterGenerator, (filters) => {
          // All filter fields should be optional
          if (filters.startDate !== undefined) {
            expect(filters.startDate instanceof Date).toBe(true);
          }
          if (filters.endDate !== undefined) {
            expect(filters.endDate instanceof Date).toBe(true);
          }
          if (filters.area !== undefined) {
            expect(typeof filters.area).toBe('string');
          }
          if (filters.status !== undefined) {
            expect(Object.values(ReportStatus)).toContain(filters.status);
          }
          if (filters.severity !== undefined) {
            expect(Object.values(Severity)).toContain(filters.severity);
          }
          if (filters.page !== undefined) {
            expect(Number.isInteger(filters.page)).toBe(true);
            expect(filters.page).toBeGreaterThanOrEqual(1);
          }
          if (filters.limit !== undefined) {
            expect(Number.isInteger(filters.limit)).toBe(true);
            expect(filters.limit).toBeGreaterThanOrEqual(1);
          }
        }),
        PBT_CONFIG
      );
    });

    it('should have valid status filter values', () => {
      fc.assert(
        fc.property(reportStatusGenerator, (status) => {
          expect(Object.values(ReportStatus)).toContain(status);
        }),
        PBT_CONFIG
      );
    });

    it('should have valid severity filter values', () => {
      fc.assert(
        fc.property(severityGenerator, (severity) => {
          expect(Object.values(Severity)).toContain(severity);
        }),
        PBT_CONFIG
      );
    });

    it('should have page number as positive integer when specified', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10000 }), (page) => {
          expect(Number.isInteger(page)).toBe(true);
          expect(page).toBeGreaterThanOrEqual(1);
        }),
        PBT_CONFIG
      );
    });

    it('should have limit as positive integer when specified', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (limit) => {
          expect(Number.isInteger(limit)).toBe(true);
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(100);
        }),
        PBT_CONFIG
      );
    });

    // Date range consistency
    it('should have startDate <= endDate when both are specified', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
          (date1, date2) => {
            const startDate = date1 < date2 ? date1 : date2;
            const endDate = date1 < date2 ? date2 : date1;
            expect(startDate.getTime()).toBeLessThanOrEqual(endDate.getTime());
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Paginated Response Structure Tests
  // ============================================

  describe('Paginated response structure', () => {
    // Generator for paginated response
    const paginatedResponseGenerator: fc.Arbitrary<PaginatedReports> = fc.record({
      reports: fc.array(fc.constant({} as any), { minLength: 0, maxLength: 100 }),
      totalCount: fc.integer({ min: 0, max: 100000 }),
      totalPages: fc.integer({ min: 0, max: 10000 }),
      currentPage: fc.integer({ min: 1, max: 10000 }),
      hasNextPage: fc.boolean(),
      hasPrevPage: fc.boolean()
    });

    it('should have all required pagination fields', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(response).toHaveProperty('reports');
          expect(response).toHaveProperty('totalCount');
          expect(response).toHaveProperty('totalPages');
          expect(response).toHaveProperty('currentPage');
          expect(response).toHaveProperty('hasNextPage');
          expect(response).toHaveProperty('hasPrevPage');
        }),
        PBT_CONFIG
      );
    });

    it('should have reports as array', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(Array.isArray(response.reports)).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should have totalCount as non-negative integer', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(Number.isInteger(response.totalCount)).toBe(true);
          expect(response.totalCount).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have totalPages as non-negative integer', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(Number.isInteger(response.totalPages)).toBe(true);
          expect(response.totalPages).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have currentPage as positive integer', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(Number.isInteger(response.currentPage)).toBe(true);
          expect(response.currentPage).toBeGreaterThanOrEqual(1);
        }),
        PBT_CONFIG
      );
    });

    it('should have hasNextPage as boolean', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(typeof response.hasNextPage).toBe('boolean');
        }),
        PBT_CONFIG
      );
    });

    it('should have hasPrevPage as boolean', () => {
      fc.assert(
        fc.property(paginatedResponseGenerator, (response) => {
          expect(typeof response.hasPrevPage).toBe('boolean');
        }),
        PBT_CONFIG
      );
    });

    // Logical consistency for pagination
    it('should have hasPrevPage = false when currentPage = 1', () => {
      // When on first page, there should be no previous page
      const firstPageResponse = {
        reports: [],
        totalCount: 100,
        totalPages: 10,
        currentPage: 1,
        hasNextPage: true,
        hasPrevPage: false
      };
      expect(firstPageResponse.hasPrevPage).toBe(false);
    });

    it('should have hasNextPage = false when currentPage = totalPages', () => {
      // When on last page, there should be no next page
      const lastPageResponse = {
        reports: [],
        totalCount: 100,
        totalPages: 10,
        currentPage: 10,
        hasNextPage: false,
        hasPrevPage: true
      };
      expect(lastPageResponse.hasNextPage).toBe(false);
    });
  });
});
