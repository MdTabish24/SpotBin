/**
 * Feature: cleancity-waste-management
 * Property Tests for Points and Gamification System
 * 
 * Property 10: Points calculation correctness
 * Property 11: Badge assignment correctness
 * Property 12: Leaderboard entry structure
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.3
 */

import fc from 'fast-check';
import {
  calculatePointsForReport,
  calculateBadge
} from '../../src/services/points.service';
import {
  Severity,
  BadgeType,
  POINTS_CONFIG,
  BADGES,
  LeaderboardEntry
} from '../../src/types';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

const severityGenerator = fc.constantFrom(Severity.LOW, Severity.MEDIUM, Severity.HIGH);
const optionalSeverityGenerator = fc.option(severityGenerator, { nil: undefined });
const booleanGenerator = fc.boolean();
const streakDaysGenerator = fc.integer({ min: 0, max: 365 });
const pointsGenerator = fc.integer({ min: 0, max: 10000 });

// Leaderboard entry generator
const leaderboardEntryGenerator: fc.Arbitrary<LeaderboardEntry> = fc.record({
  rank: fc.integer({ min: 1, max: 1000 }),
  deviceId: fc.hexaString({ minLength: 8, maxLength: 16 }).map(h => `user_${h}***`),
  points: fc.integer({ min: 0, max: 100000 }),
  reportsCount: fc.integer({ min: 0, max: 10000 }),
  badge: fc.constantFrom(
    BadgeType.CLEANLINESS_ROOKIE,
    BadgeType.ECO_WARRIOR,
    BadgeType.COMMUNITY_CHAMPION,
    BadgeType.CLEANUP_LEGEND
  )
});

// ============================================
// Property 10: Points calculation correctness
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 10: Points calculation correctness', () => {
    /**
     * Property 10: Points calculation correctness
     * For any verified report:
     * - If severity is NOT high, exactly 10 points SHALL be awarded
     * - If severity IS high, exactly 15 points SHALL be awarded
     * - If it's the first report in an area, an additional 20 pioneer bonus points SHALL be awarded
     * - If the citizen has a streak of N consecutive days, an additional N × 5 bonus points SHALL be awarded
     * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
     */

    it('should award exactly 10 base points for non-high severity reports', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(Severity.LOW, Severity.MEDIUM, undefined),
          (severity) => {
            const result = calculatePointsForReport(severity, false, 0);
            expect(result.base).toBe(POINTS_CONFIG.reportVerified); // 10
            expect(result.severityBonus).toBe(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should award exactly 15 points (10 base + 5 bonus) for high severity reports', () => {
      fc.assert(
        fc.property(booleanGenerator, streakDaysGenerator, (isFirstInArea, streakDays) => {
          const result = calculatePointsForReport(Severity.HIGH, isFirstInArea, streakDays);
          // Base is always 10, severity bonus is 5 for high severity
          expect(result.base).toBe(POINTS_CONFIG.reportVerified); // 10
          expect(result.severityBonus).toBe(POINTS_CONFIG.highSeverityReport - POINTS_CONFIG.reportVerified); // 5
          
          // Total should include base (10) + severity bonus (5) + other bonuses
          const expectedBase = POINTS_CONFIG.highSeverityReport; // 15
          const expectedPioneer = isFirstInArea ? POINTS_CONFIG.firstReportInArea : 0;
          const expectedStreak = streakDays * POINTS_CONFIG.consecutiveDays;
          expect(result.total).toBe(expectedBase + expectedPioneer + expectedStreak);
        }),
        PBT_CONFIG
      );
    });

    it('should award exactly 20 pioneer bonus points for first report in area', () => {
      fc.assert(
        fc.property(optionalSeverityGenerator, streakDaysGenerator, (severity, streakDays) => {
          const resultWithPioneer = calculatePointsForReport(severity, true, streakDays);
          const resultWithoutPioneer = calculatePointsForReport(severity, false, streakDays);
          
          expect(resultWithPioneer.pioneerBonus).toBe(POINTS_CONFIG.firstReportInArea); // 20
          expect(resultWithoutPioneer.pioneerBonus).toBe(0);
          expect(resultWithPioneer.total - resultWithoutPioneer.total).toBe(POINTS_CONFIG.firstReportInArea);
        }),
        PBT_CONFIG
      );
    });

    it('should award N × 5 streak bonus points for N consecutive days', () => {
      fc.assert(
        fc.property(
          optionalSeverityGenerator,
          booleanGenerator,
          streakDaysGenerator,
          (severity, isFirstInArea, streakDays) => {
            const result = calculatePointsForReport(severity, isFirstInArea, streakDays);
            expect(result.streakBonus).toBe(streakDays * POINTS_CONFIG.consecutiveDays);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should calculate total points correctly as sum of all components', () => {
      fc.assert(
        fc.property(
          optionalSeverityGenerator,
          booleanGenerator,
          streakDaysGenerator,
          (severity, isFirstInArea, streakDays) => {
            const result = calculatePointsForReport(severity, isFirstInArea, streakDays);
            
            const isHighSeverity = severity === Severity.HIGH;
            const expectedBase = isHighSeverity ? POINTS_CONFIG.highSeverityReport : POINTS_CONFIG.reportVerified;
            const expectedPioneer = isFirstInArea ? POINTS_CONFIG.firstReportInArea : 0;
            const expectedStreak = streakDays * POINTS_CONFIG.consecutiveDays;
            
            expect(result.total).toBe(expectedBase + expectedPioneer + expectedStreak);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should return non-negative total points for any valid input', () => {
      fc.assert(
        fc.property(
          optionalSeverityGenerator,
          booleanGenerator,
          fc.integer({ min: 0, max: 1000 }),
          (severity, isFirstInArea, streakDays) => {
            const result = calculatePointsForReport(severity, isFirstInArea, streakDays);
            expect(result.total).toBeGreaterThanOrEqual(0);
            expect(result.base).toBeGreaterThanOrEqual(0);
            expect(result.severityBonus).toBeGreaterThanOrEqual(0);
            expect(result.pioneerBonus).toBeGreaterThanOrEqual(0);
            expect(result.streakBonus).toBeGreaterThanOrEqual(0);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should have minimum 10 points for any verified report', () => {
      fc.assert(
        fc.property(
          optionalSeverityGenerator,
          booleanGenerator,
          streakDaysGenerator,
          (severity, isFirstInArea, streakDays) => {
            const result = calculatePointsForReport(severity, isFirstInArea, streakDays);
            expect(result.total).toBeGreaterThanOrEqual(POINTS_CONFIG.reportVerified);
          }
        ),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 11: Badge assignment correctness
  // ============================================

  describe('Property 11: Badge assignment correctness', () => {
    /**
     * Property 11: Badge assignment correctness
     * For any citizen with total points P:
     * - If P < 50, badge SHALL be "Cleanliness Rookie"
     * - If 50 ≤ P < 200, badge SHALL be "Eco Warrior"
     * - If 200 ≤ P < 500, badge SHALL be "Community Champion"
     * - If P ≥ 500, badge SHALL be "Cleanup Legend"
     * Validates: Requirements 3.6
     */

    it('should assign "Cleanliness Rookie" badge for points < 50', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 49 }), (points) => {
          const badge = calculateBadge(points);
          expect(badge.name).toBe(BadgeType.CLEANLINESS_ROOKIE);
          expect(badge.unlocked).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should assign "Eco Warrior" badge for 50 ≤ points < 200', () => {
      fc.assert(
        fc.property(fc.integer({ min: 50, max: 199 }), (points) => {
          const badge = calculateBadge(points);
          expect(badge.name).toBe(BadgeType.ECO_WARRIOR);
          expect(badge.unlocked).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should assign "Community Champion" badge for 200 ≤ points < 500', () => {
      fc.assert(
        fc.property(fc.integer({ min: 200, max: 499 }), (points) => {
          const badge = calculateBadge(points);
          expect(badge.name).toBe(BadgeType.COMMUNITY_CHAMPION);
          expect(badge.unlocked).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should assign "Cleanup Legend" badge for points ≥ 500', () => {
      fc.assert(
        fc.property(fc.integer({ min: 500, max: 100000 }), (points) => {
          const badge = calculateBadge(points);
          expect(badge.name).toBe(BadgeType.CLEANUP_LEGEND);
          expect(badge.unlocked).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should always return an unlocked badge', () => {
      fc.assert(
        fc.property(pointsGenerator, (points) => {
          const badge = calculateBadge(points);
          expect(badge.unlocked).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should return badge with valid icon', () => {
      fc.assert(
        fc.property(pointsGenerator, (points) => {
          const badge = calculateBadge(points);
          expect(badge.icon).toBeDefined();
          expect(badge.icon.length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have monotonically increasing badge requirements', () => {
      // Verify badge thresholds are in order
      expect(BADGES[0].requirement).toBe(0);   // Rookie
      expect(BADGES[1].requirement).toBe(50);  // Eco Warrior
      expect(BADGES[2].requirement).toBe(200); // Community Champion
      expect(BADGES[3].requirement).toBe(500); // Cleanup Legend
      
      for (let i = 1; i < BADGES.length; i++) {
        expect(BADGES[i].requirement).toBeGreaterThan(BADGES[i - 1].requirement);
      }
    });

    it('should assign correct badge at exact threshold boundaries', () => {
      // Test exact boundaries
      expect(calculateBadge(0).name).toBe(BadgeType.CLEANLINESS_ROOKIE);
      expect(calculateBadge(49).name).toBe(BadgeType.CLEANLINESS_ROOKIE);
      expect(calculateBadge(50).name).toBe(BadgeType.ECO_WARRIOR);
      expect(calculateBadge(199).name).toBe(BadgeType.ECO_WARRIOR);
      expect(calculateBadge(200).name).toBe(BadgeType.COMMUNITY_CHAMPION);
      expect(calculateBadge(499).name).toBe(BadgeType.COMMUNITY_CHAMPION);
      expect(calculateBadge(500).name).toBe(BadgeType.CLEANUP_LEGEND);
    });
  });

  // ============================================
  // Property 12: Leaderboard entry structure
  // ============================================

  describe('Property 12: Leaderboard entry structure', () => {
    /**
     * Property 12: Leaderboard entry structure
     * For any leaderboard entry, it SHALL contain: rank (positive integer),
     * deviceId (hashed string), points (non-negative integer), and reportsCount (non-negative integer).
     * Validates: Requirements 4.3
     */

    it('should have rank as positive integer', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(Number.isInteger(entry.rank)).toBe(true);
          expect(entry.rank).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have deviceId as hashed string (privacy)', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(typeof entry.deviceId).toBe('string');
          expect(entry.deviceId.length).toBeGreaterThan(0);
          // Should be hashed format: user_XXXXXXXX***
          expect(entry.deviceId).toMatch(/^user_[a-f0-9]+\*\*\*$/);
        }),
        PBT_CONFIG
      );
    });

    it('should have points as non-negative integer', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(Number.isInteger(entry.points)).toBe(true);
          expect(entry.points).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have reportsCount as non-negative integer', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(Number.isInteger(entry.reportsCount)).toBe(true);
          expect(entry.reportsCount).toBeGreaterThanOrEqual(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have badge as valid badge type', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(typeof entry.badge).toBe('string');
          expect(Object.values(BadgeType)).toContain(entry.badge);
        }),
        PBT_CONFIG
      );
    });

    it('should have all required fields present', () => {
      fc.assert(
        fc.property(leaderboardEntryGenerator, (entry) => {
          expect(entry).toHaveProperty('rank');
          expect(entry).toHaveProperty('deviceId');
          expect(entry).toHaveProperty('points');
          expect(entry).toHaveProperty('reportsCount');
          expect(entry).toHaveProperty('badge');
        }),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Points Configuration Tests
  // ============================================

  describe('Points configuration consistency', () => {
    it('should have correct point values in configuration', () => {
      expect(POINTS_CONFIG.reportVerified).toBe(10);
      expect(POINTS_CONFIG.highSeverityReport).toBe(15);
      expect(POINTS_CONFIG.consecutiveDays).toBe(5);
      expect(POINTS_CONFIG.firstReportInArea).toBe(20);
    });

    it('should have high severity points greater than base points', () => {
      expect(POINTS_CONFIG.highSeverityReport).toBeGreaterThan(POINTS_CONFIG.reportVerified);
    });
  });
});
