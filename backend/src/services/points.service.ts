/**
 * Points Service - Gamification and Points Management
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

import pool from '../db/pool';
import redis from '../config/redis';
import { logger } from '../config/logger';
import {
  Badge,
  BadgeType,
  BADGES,
  LeaderboardEntry,
  PointReason,
  POINTS_CONFIG,
  Severity,
  UserStats
} from '../types';

// ============================================
// Points Service Interface
// ============================================

export interface IPointsService {
  awardPoints(deviceId: string, reportId: string, reason: PointReason, severity?: Severity): Promise<number>;
  getUserStats(deviceId: string): Promise<UserStats>;
  getLeaderboard(scope: 'city' | 'area', areaName?: string, limit?: number): Promise<LeaderboardEntry[]>;
  calculateBadge(points: number): Badge;
  checkStreak(deviceId: string): Promise<number>;
  calculatePointsForReport(severity: Severity | undefined, isFirstInArea: boolean, streakDays: number): PointsBreakdown;
}

export interface PointsBreakdown {
  base: number;
  severityBonus: number;
  pioneerBonus: number;
  streakBonus: number;
  total: number;
}

// ============================================
// Points Calculation Logic
// ============================================

/**
 * Calculate points for a verified report
 * Property 10: Points calculation correctness
 */
export function calculatePointsForReport(
  severity: Severity | undefined,
  isFirstInArea: boolean,
  streakDays: number
): PointsBreakdown {
  // Base points: 10 for normal, 15 for high severity
  const isHighSeverity = severity === Severity.HIGH;
  const base = isHighSeverity ? POINTS_CONFIG.highSeverityReport : POINTS_CONFIG.reportVerified;
  
  // Severity bonus is included in base (15 vs 10)
  const severityBonus = isHighSeverity ? (POINTS_CONFIG.highSeverityReport - POINTS_CONFIG.reportVerified) : 0;
  
  // Pioneer bonus: 20 points for first report in area
  const pioneerBonus = isFirstInArea ? POINTS_CONFIG.firstReportInArea : 0;
  
  // Streak bonus: N × 5 points for N consecutive days
  const streakBonus = streakDays * POINTS_CONFIG.consecutiveDays;
  
  // Total = base + pioneer + streak (severity already in base)
  const total = base + pioneerBonus + streakBonus;
  
  return {
    base: POINTS_CONFIG.reportVerified, // Always show base as 10
    severityBonus,
    pioneerBonus,
    streakBonus,
    total
  };
}

/**
 * Calculate badge based on total points
 * Property 11: Badge assignment correctness
 */
export function calculateBadge(points: number): Badge {
  // Badge thresholds (from highest to lowest)
  // P >= 500: Cleanup Legend
  // 200 <= P < 500: Community Champion
  // 50 <= P < 200: Eco Warrior
  // P < 50: Cleanliness Rookie
  
  if (points >= 500) {
    return { ...BADGES[3], unlocked: true }; // Cleanup Legend
  } else if (points >= 200) {
    return { ...BADGES[2], unlocked: true }; // Community Champion
  } else if (points >= 50) {
    return { ...BADGES[1], unlocked: true }; // Eco Warrior
  } else {
    return { ...BADGES[0], unlocked: true }; // Cleanliness Rookie
  }
}

// ============================================
// Points Service Implementation
// ============================================

class PointsService implements IPointsService {
  private readonly LEADERBOARD_CACHE_TTL = 300; // 5 minutes
  private readonly LEADERBOARD_CACHE_KEY = 'leaderboard';

  calculatePointsForReport = calculatePointsForReport;
  calculateBadge = calculateBadge;

  /**
   * Award points to a citizen for a verified report
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
   */
  async awardPoints(
    deviceId: string,
    reportId: string,
    reason: PointReason,
    severity?: Severity
  ): Promise<number> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get citizen's current streak
      const streakDays = await this.checkStreak(deviceId);
      
      // Check if this is the first report in the area
      const isFirstInArea = await this.isFirstReportInArea(deviceId, reportId);
      
      // Calculate points
      const breakdown = calculatePointsForReport(severity, isFirstInArea, streakDays);
      
      // Record points in history
      await client.query(
        `INSERT INTO points_history (device_id, report_id, points, reason)
         VALUES ($1, $2, $3, $4)`,
        [deviceId, reportId, breakdown.total, reason]
      );

      // Update citizen's total points
      const updateResult = await client.query(
        `UPDATE citizens 
         SET total_points = total_points + $1,
             current_badge = $2,
             last_active = NOW()
         WHERE device_id = $3
         RETURNING total_points`,
        [breakdown.total, calculateBadge(breakdown.total).name, deviceId]
      );

      // Update report with points awarded
      await client.query(
        `UPDATE reports SET points_awarded = $1 WHERE id = $2`,
        [breakdown.total, reportId]
      );

      await client.query('COMMIT');

      // Invalidate leaderboard cache
      await this.invalidateLeaderboardCache();

      logger.info({ deviceId, reportId, points: breakdown.total, breakdown }, 'Points awarded');
      
      return breakdown.total;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, deviceId, reportId }, 'Failed to award points');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(deviceId: string): Promise<UserStats> {
    const result = await pool.query(
      `SELECT 
        total_points, reports_count, current_badge, 
        streak_days, city, area
       FROM citizens 
       WHERE device_id = $1`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      // Return default stats for new user
      return {
        totalPoints: 0,
        currentBadge: BADGES[0],
        rank: 0,
        cityRank: 0,
        areaRank: 0,
        reportsCount: 0,
        streakDays: 0
      };
    }

    const citizen = result.rows[0];
    const totalPoints = citizen.total_points || 0;

    // Get ranks
    const [cityRank, areaRank] = await Promise.all([
      this.getCityRank(deviceId),
      citizen.area ? this.getAreaRank(deviceId, citizen.area) : Promise.resolve(0)
    ]);

    return {
      totalPoints,
      currentBadge: calculateBadge(totalPoints),
      rank: cityRank,
      cityRank,
      areaRank,
      reportsCount: citizen.reports_count || 0,
      streakDays: citizen.streak_days || 0
    };
  }

  /**
   * Get leaderboard
   * Requirements: 4.1, 4.2, 4.3, 4.4
   */
  async getLeaderboard(
    scope: 'city' | 'area',
    areaName?: string,
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `${this.LEADERBOARD_CACHE_KEY}:${scope}:${areaName || 'all'}:${limit}`;
    
    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn({ error }, 'Redis cache read failed');
    }

    // Build query based on scope
    let query: string;
    let params: any[];

    if (scope === 'area' && areaName) {
      query = `
        SELECT 
          device_id, total_points, reports_count, current_badge,
          ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM citizens
        WHERE area = $1
        ORDER BY total_points DESC
        LIMIT $2
      `;
      params = [areaName, limit];
    } else {
      query = `
        SELECT 
          device_id, total_points, reports_count, current_badge,
          ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM citizens
        ORDER BY total_points DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await pool.query(query, params);

    const leaderboard: LeaderboardEntry[] = result.rows.map((row) => ({
      rank: parseInt(row.rank, 10),
      deviceId: this.hashDeviceId(row.device_id),
      points: row.total_points || 0,
      reportsCount: row.reports_count || 0,
      badge: row.current_badge || BadgeType.CLEANLINESS_ROOKIE
    }));

    // Cache the result
    try {
      await redis.setex(cacheKey, this.LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboard));
    } catch (error) {
      logger.warn({ error }, 'Redis cache write failed');
    }

    return leaderboard;
  }

  /**
   * Check and update streak for a citizen
   * Requirements: 3.3
   */
  async checkStreak(deviceId: string): Promise<number> {
    const result = await pool.query(
      `SELECT streak_days, last_report_date FROM citizens WHERE device_id = $1`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    const { streak_days, last_report_date } = result.rows[0];
    
    if (!last_report_date) {
      return 0;
    }

    const lastDate = new Date(last_report_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, return current streak
      return streak_days || 0;
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      const newStreak = (streak_days || 0) + 1;
      await pool.query(
        `UPDATE citizens SET streak_days = $1, last_report_date = CURRENT_DATE WHERE device_id = $2`,
        [newStreak, deviceId]
      );
      return newStreak;
    } else {
      // Streak broken, reset to 1
      await pool.query(
        `UPDATE citizens SET streak_days = 1, last_report_date = CURRENT_DATE WHERE device_id = $1`,
        [deviceId]
      );
      return 1;
    }
  }

  /**
   * Check if this is the first report in the area
   * Requirements: 3.4
   */
  private async isFirstReportInArea(deviceId: string, reportId: string): Promise<boolean> {
    // Get the report's area (based on location)
    const reportResult = await pool.query(
      `SELECT latitude, longitude FROM reports WHERE id = $1`,
      [reportId]
    );

    if (reportResult.rows.length === 0) {
      return false;
    }

    // Check if there are any other verified reports within 500m radius
    const { latitude, longitude } = reportResult.rows[0];
    
    const existingResult = await pool.query(
      `SELECT COUNT(*) as count FROM reports 
       WHERE id != $1 
       AND status = 'resolved'
       AND (
         6371000 * acos(
           cos(radians($2)) * cos(radians(latitude)) * 
           cos(radians(longitude) - radians($3)) + 
           sin(radians($2)) * sin(radians(latitude))
         )
       ) < 500`,
      [reportId, latitude, longitude]
    );

    return parseInt(existingResult.rows[0].count, 10) === 0;
  }

  /**
   * Get city-wide rank for a citizen
   */
  private async getCityRank(deviceId: string): Promise<number> {
    const result = await pool.query(
      `SELECT rank FROM (
        SELECT device_id, ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM citizens
      ) ranked WHERE device_id = $1`,
      [deviceId]
    );

    return result.rows.length > 0 ? parseInt(result.rows[0].rank, 10) : 0;
  }

  /**
   * Get area-specific rank for a citizen
   */
  private async getAreaRank(deviceId: string, area: string): Promise<number> {
    const result = await pool.query(
      `SELECT rank FROM (
        SELECT device_id, ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
        FROM citizens WHERE area = $1
      ) ranked WHERE device_id = $2`,
      [area, deviceId]
    );

    return result.rows.length > 0 ? parseInt(result.rows[0].rank, 10) : 0;
  }

  /**
   * Hash device ID for privacy in leaderboards
   * Requirements: 4.3
   */
  private hashDeviceId(deviceId: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(deviceId).digest('hex');
    return `user_${hash.substring(0, 8)}***`;
  }

  /**
   * Invalidate leaderboard cache
   */
  private async invalidateLeaderboardCache(): Promise<void> {
    try {
      const keys = await redis.keys(`${this.LEADERBOARD_CACHE_KEY}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.warn({ error }, 'Failed to invalidate leaderboard cache');
    }
  }
}

// Export singleton instance
export const pointsService = new PointsService();
export default pointsService;
