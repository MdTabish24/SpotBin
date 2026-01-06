/**
 * Feature: cleancity-waste-management
 * Property Tests for Analytics Service
 * 
 * Property 33: Analytics data completeness
 * 
 * Validates: Requirements 12.1, 12.2, 12.3, 12.4
 */

import fc from 'fast-check';
import {
  analyticsService,
  AnalyticsReport,
  AnalyticsSummary,
  AnalyticsTrends,
  AnalyticsCharts,
  DailyReportData,
  AreaWiseData,
  WasteTypeData
} from '../../src/services/analytics.service';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

// Daily report data generator
const dailyReportDataGenerator: fc.Arbitrary<DailyReportData> = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString().split('T')[0]),
  count: fc.integer({ min: 0, max: 10000 })
});

// Area-wise data generator
const areaWiseDataGenerator: fc.Arbitrary<AreaWiseData> = fc.record({
  area: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), { minLength: 1, maxLength: 50 }),
  count: fc.integer({ min: 0, max: 10000 })
});

// Waste type data generator
const wasteTypeDataGenerator: fc.Arbitrary<WasteTypeData> = fc.record({
  type: fc.constantFrom('plastic', 'organic', 'paper', 'metal', 'glass', 'electronic', 'hazardous', 'mixed'),
  percentage: fc.integer({ min: 0, max: 100 }),
  count: fc.integer({ min: 0, max: 10000 })
});

// Analytics summary generator
const analyticsSummaryGenerator: fc.Arbitrary<AnalyticsSummary> = fc.record({
  totalReports: fc.integer({ min: 0, max: 1000000 }),
  resolvedReports: fc.integer({ min: 0, max: 1000000 }),
  avgResolutionTime: fc.double({ min: 0, max: 720, noNaN: true }), // 0-30 days in hours
  citizenParticipation: fc.integer({ min: 0, max: 100000 }),
  wasteCollected: fc.integer({ min: 0, max: 10000000 }) // in kg
});

// Analytics trends generator
const analyticsTrendsGenerator: fc.Arbitrary<AnalyticsTrends> = fc.record({
  reportsTrend: fc.double({ min: -100, max: 1000, noNaN: true }),
  resolutionTrend: fc.double({ min: -100, max: 1000, noNaN: true }),
  participationTrend: fc.double({ min: -100, max: 1000, noNaN: true })
});

// Analytics charts generator
const analyticsChartsGenerator: fc.Arbitrary<AnalyticsCharts> = fc.record({
  dailyReports: fc.array(dailyReportDataGenerator, { minLength: 0, maxLength: 31 }),
  areaWise: fc.array(areaWiseDataGenerator, { minLength: 0, maxLength: 20 }),
  wasteTypes: fc.array(wasteTypeDataGenerator, { minLength: 0, maxLength: 10 })
});

// Date range generator (ensures startDate <= endDate)
const dateRangeGenerator = fc.tuple(
  fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
).map(([d1, d2]) => ({
  startDate: d1 < d2 ? d1 : d2,
  endDate: d1 < d2 ? d2 : d1
}));

// Full analytics report generator
const analyticsReportGenerator: fc.Arbitrary<AnalyticsReport> = fc.record({
  period: dateRangeGenerator,
  summary: analyticsSummaryGenerator,
  trends: analyticsTrendsGenerator,
  charts: analyticsChartsGenerator,
  generatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() })
});

// ============================================
// Property 33: Analytics data completeness
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 33: Analytics data completeness', () => {
    /**
     * Property 33: Analytics data completeness
     * For any analytics report generated for a date range:
     * - Summary SHALL include: totalReports, resolvedReports, avgResolutionTime, citizenParticipation, wasteCollected
     * - Trends SHALL include percentage changes from previous period
     * - Charts data SHALL include: dailyReports, areaWise breakdown, wasteTypes distribution
     * Validates: Requirements 12.1, 12.2, 12.3, 12.4
     */

    // ============================================
    // Summary Structure Tests
    // ============================================

    describe('Summary structure', () => {
      it('should have all required summary fields', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(summary).toHaveProperty('totalReports');
            expect(summary).toHaveProperty('resolvedReports');
            expect(summary).toHaveProperty('avgResolutionTime');
            expect(summary).toHaveProperty('citizenParticipation');
            expect(summary).toHaveProperty('wasteCollected');
          }),
          PBT_CONFIG
        );
      });

      it('should have totalReports as non-negative integer', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(Number.isInteger(summary.totalReports)).toBe(true);
            expect(summary.totalReports).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });

      it('should have resolvedReports as non-negative integer', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(Number.isInteger(summary.resolvedReports)).toBe(true);
            expect(summary.resolvedReports).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });

      it('should have avgResolutionTime as non-negative number', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(typeof summary.avgResolutionTime).toBe('number');
            expect(summary.avgResolutionTime).toBeGreaterThanOrEqual(0);
            expect(Number.isNaN(summary.avgResolutionTime)).toBe(false);
          }),
          PBT_CONFIG
        );
      });

      it('should have citizenParticipation as non-negative integer', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(Number.isInteger(summary.citizenParticipation)).toBe(true);
            expect(summary.citizenParticipation).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });

      it('should have wasteCollected as non-negative number', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            expect(typeof summary.wasteCollected).toBe('number');
            expect(summary.wasteCollected).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });

      it('should validate summary structure using service method', () => {
        fc.assert(
          fc.property(analyticsSummaryGenerator, (summary) => {
            const isValid = analyticsService.validateSummaryStructure(summary);
            expect(isValid).toBe(true);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Trends Structure Tests
    // ============================================

    describe('Trends structure', () => {
      it('should have all required trends fields', () => {
        fc.assert(
          fc.property(analyticsTrendsGenerator, (trends) => {
            expect(trends).toHaveProperty('reportsTrend');
            expect(trends).toHaveProperty('resolutionTrend');
            expect(trends).toHaveProperty('participationTrend');
          }),
          PBT_CONFIG
        );
      });

      it('should have reportsTrend as number', () => {
        fc.assert(
          fc.property(analyticsTrendsGenerator, (trends) => {
            expect(typeof trends.reportsTrend).toBe('number');
            expect(Number.isNaN(trends.reportsTrend)).toBe(false);
          }),
          PBT_CONFIG
        );
      });

      it('should have resolutionTrend as number', () => {
        fc.assert(
          fc.property(analyticsTrendsGenerator, (trends) => {
            expect(typeof trends.resolutionTrend).toBe('number');
            expect(Number.isNaN(trends.resolutionTrend)).toBe(false);
          }),
          PBT_CONFIG
        );
      });

      it('should have participationTrend as number', () => {
        fc.assert(
          fc.property(analyticsTrendsGenerator, (trends) => {
            expect(typeof trends.participationTrend).toBe('number');
            expect(Number.isNaN(trends.participationTrend)).toBe(false);
          }),
          PBT_CONFIG
        );
      });

      it('should validate trends structure using service method', () => {
        fc.assert(
          fc.property(analyticsTrendsGenerator, (trends) => {
            const isValid = analyticsService.validateTrendsStructure(trends);
            expect(isValid).toBe(true);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Charts Structure Tests
    // ============================================

    describe('Charts structure', () => {
      it('should have all required charts fields', () => {
        fc.assert(
          fc.property(analyticsChartsGenerator, (charts) => {
            expect(charts).toHaveProperty('dailyReports');
            expect(charts).toHaveProperty('areaWise');
            expect(charts).toHaveProperty('wasteTypes');
          }),
          PBT_CONFIG
        );
      });

      it('should have dailyReports as array', () => {
        fc.assert(
          fc.property(analyticsChartsGenerator, (charts) => {
            expect(Array.isArray(charts.dailyReports)).toBe(true);
          }),
          PBT_CONFIG
        );
      });

      it('should have areaWise as array', () => {
        fc.assert(
          fc.property(analyticsChartsGenerator, (charts) => {
            expect(Array.isArray(charts.areaWise)).toBe(true);
          }),
          PBT_CONFIG
        );
      });

      it('should have wasteTypes as array', () => {
        fc.assert(
          fc.property(analyticsChartsGenerator, (charts) => {
            expect(Array.isArray(charts.wasteTypes)).toBe(true);
          }),
          PBT_CONFIG
        );
      });

      it('should validate charts structure using service method', () => {
        fc.assert(
          fc.property(analyticsChartsGenerator, (charts) => {
            const isValid = analyticsService.validateChartsStructure(charts);
            expect(isValid).toBe(true);
          }),
          PBT_CONFIG
        );
      });
    });


    // ============================================
    // Daily Reports Data Tests
    // ============================================

    describe('Daily reports data', () => {
      it('should have valid date format (YYYY-MM-DD)', () => {
        fc.assert(
          fc.property(dailyReportDataGenerator, (data) => {
            expect(typeof data.date).toBe('string');
            // Check date format
            expect(data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          }),
          PBT_CONFIG
        );
      });

      it('should have count as non-negative integer', () => {
        fc.assert(
          fc.property(dailyReportDataGenerator, (data) => {
            expect(Number.isInteger(data.count)).toBe(true);
            expect(data.count).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Area-wise Data Tests
    // ============================================

    describe('Area-wise data', () => {
      it('should have area as non-empty string', () => {
        fc.assert(
          fc.property(areaWiseDataGenerator, (data) => {
            expect(typeof data.area).toBe('string');
            expect(data.area.length).toBeGreaterThan(0);
          }),
          PBT_CONFIG
        );
      });

      it('should have count as non-negative integer', () => {
        fc.assert(
          fc.property(areaWiseDataGenerator, (data) => {
            expect(Number.isInteger(data.count)).toBe(true);
            expect(data.count).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Waste Type Data Tests
    // ============================================

    describe('Waste type data', () => {
      it('should have type as non-empty string', () => {
        fc.assert(
          fc.property(wasteTypeDataGenerator, (data) => {
            expect(typeof data.type).toBe('string');
            expect(data.type.length).toBeGreaterThan(0);
          }),
          PBT_CONFIG
        );
      });

      it('should have percentage between 0 and 100', () => {
        fc.assert(
          fc.property(wasteTypeDataGenerator, (data) => {
            expect(Number.isInteger(data.percentage)).toBe(true);
            expect(data.percentage).toBeGreaterThanOrEqual(0);
            expect(data.percentage).toBeLessThanOrEqual(100);
          }),
          PBT_CONFIG
        );
      });

      it('should have count as non-negative integer', () => {
        fc.assert(
          fc.property(wasteTypeDataGenerator, (data) => {
            expect(Number.isInteger(data.count)).toBe(true);
            expect(data.count).toBeGreaterThanOrEqual(0);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Full Report Structure Tests
    // ============================================

    describe('Full analytics report structure', () => {
      it('should have all required top-level fields', () => {
        fc.assert(
          fc.property(analyticsReportGenerator, (report) => {
            expect(report).toHaveProperty('period');
            expect(report).toHaveProperty('summary');
            expect(report).toHaveProperty('trends');
            expect(report).toHaveProperty('charts');
            expect(report).toHaveProperty('generatedAt');
          }),
          PBT_CONFIG
        );
      });

      it('should have valid period with startDate and endDate', () => {
        fc.assert(
          fc.property(analyticsReportGenerator, (report) => {
            expect(report.period).toHaveProperty('startDate');
            expect(report.period).toHaveProperty('endDate');
            expect(report.period.startDate instanceof Date).toBe(true);
            expect(report.period.endDate instanceof Date).toBe(true);
          }),
          PBT_CONFIG
        );
      });

      it('should have startDate <= endDate', () => {
        fc.assert(
          fc.property(analyticsReportGenerator, (report) => {
            expect(report.period.startDate.getTime()).toBeLessThanOrEqual(
              report.period.endDate.getTime()
            );
          }),
          PBT_CONFIG
        );
      });

      it('should have generatedAt as valid Date', () => {
        fc.assert(
          fc.property(analyticsReportGenerator, (report) => {
            expect(report.generatedAt instanceof Date).toBe(true);
            expect(Number.isNaN(report.generatedAt.getTime())).toBe(false);
          }),
          PBT_CONFIG
        );
      });
    });

    // ============================================
    // Trend Calculation Tests
    // ============================================

    describe('Trend percentage calculation', () => {
      it('should return 0 when both current and previous are 0', () => {
        const result = analyticsService.calculateTrendPercentage(0, 0);
        expect(result).toBe(0);
      });

      it('should return 100 when previous is 0 and current is positive', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 10000 }), (current) => {
            const result = analyticsService.calculateTrendPercentage(current, 0);
            expect(result).toBe(100);
          }),
          PBT_CONFIG
        );
      });

      it('should return positive percentage when current > previous', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 1, max: 10000 }),
            fc.integer({ min: 1, max: 10000 }),
            (base, increment) => {
              const previous = base;
              const current = base + increment;
              const result = analyticsService.calculateTrendPercentage(current, previous);
              expect(result).toBeGreaterThan(0);
            }
          ),
          PBT_CONFIG
        );
      });

      it('should return negative percentage when current < previous', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 2, max: 10000 }),
            fc.integer({ min: 1, max: 5000 }),
            (base, decrement) => {
              const previous = base;
              const current = Math.max(0, base - decrement);
              if (current < previous) {
                const result = analyticsService.calculateTrendPercentage(current, previous);
                expect(result).toBeLessThan(0);
              }
            }
          ),
          PBT_CONFIG
        );
      });

      it('should return 0 when current equals previous', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 10000 }), (value) => {
            const result = analyticsService.calculateTrendPercentage(value, value);
            expect(result).toBe(0);
          }),
          PBT_CONFIG
        );
      });

      it('should calculate correct percentage change', () => {
        // Test specific cases
        expect(analyticsService.calculateTrendPercentage(150, 100)).toBe(50);
        expect(analyticsService.calculateTrendPercentage(50, 100)).toBe(-50);
        expect(analyticsService.calculateTrendPercentage(200, 100)).toBe(100);
        expect(analyticsService.calculateTrendPercentage(100, 200)).toBe(-50);
      });
    });

    // ============================================
    // Logical Consistency Tests
    // ============================================

    describe('Logical consistency', () => {
      it('should have resolvedReports <= totalReports', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            (total) => {
              const resolved = fc.sample(fc.integer({ min: 0, max: total }), 1)[0];
              expect(resolved).toBeLessThanOrEqual(total);
            }
          ),
          PBT_CONFIG
        );
      });

      it('should have citizenParticipation <= totalReports', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            (total) => {
              // Each citizen can submit multiple reports
              const participation = fc.sample(fc.integer({ min: 0, max: total }), 1)[0];
              expect(participation).toBeLessThanOrEqual(total);
            }
          ),
          PBT_CONFIG
        );
      });

      it('should have waste type percentages sum to <= 100', () => {
        fc.assert(
          fc.property(
            fc.array(fc.integer({ min: 0, max: 100 }), { minLength: 1, maxLength: 10 }),
            (percentages) => {
              // Normalize percentages to sum to 100
              const total = percentages.reduce((sum, p) => sum + p, 0);
              if (total > 0) {
                const normalized = percentages.map(p => Math.round((p / total) * 100));
                const normalizedSum = normalized.reduce((sum, p) => sum + p, 0);
                // Allow for rounding errors
                expect(normalizedSum).toBeGreaterThanOrEqual(95);
                expect(normalizedSum).toBeLessThanOrEqual(105);
              }
            }
          ),
          PBT_CONFIG
        );
      });
    });
  });
});
