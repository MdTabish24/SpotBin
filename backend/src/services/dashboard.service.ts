/**
 * Dashboard Service - Admin Dashboard Statistics
 * Requirements: 9.5
 * Property 28: Dashboard metrics accuracy
 */

import pool from '../db/pool';
import redis from '../config/redis';
import { logger } from '../config/logger';
import {
  DashboardStats,
  ContributorSummary,
  AreaBreakdown,
  ReportStatus,
  Severity
} from '../types';

// ============================================
// Dashboard Service Interface
// ============================================

export interface IDashboardService {
  getDashboardStats(startDate?: Date, endDate?: Date): Promise<DashboardStats>;
  getTotalReports(startDate?: Date, endDate?: Date): Promise<number>;
  getOpenReports(): Promise<number>;
  getInProgressReports(): Promise<number>;
  getResolvedToday(): Promise<number>;
  getAverageResolutionTime(startDate?: Date, endDate?: Date): Promise<number>;
  getTopContributors(limit?: number): Promise<ContributorSummary[]>;
  getAreaWiseBreakdown(): Promise<AreaBreakdown[]>;
}

// ============================================
// Dashboard Service Implementation
// ============================================

class DashboardService implements IDashboardService {
  private readonly CACHE_TTL = 60; // 1 minute cache for dashboard stats
  private readonly CACHE_KEY_PREFIX = 'dashboard';

  /**
   * Get complete dashboard statistics
   * Property 28: Dashboard metrics accuracy
   * - totalReports = count of all reports
   * - openReports = count of reports with status "open"
   * - resolvedToday = count of reports resolved today
   * - avgResolutionTime = average time from creation to resolution
   */
  async getDashboardStats(startDate?: Date, endDate?: Date): Promise<DashboardStats> {
    const cacheKey = `${this.CACHE_KEY_PREFIX}:stats:${startDate?.toISOString() || 'all'}:${endDate?.toISOString() || 'all'}`;

    // Try cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'Dashboard stats cache hit');
        return JSON.parse(cached);
      }
    } catch (error) {
      logger.warn({ error }, 'Redis cache read failed for dashboard stats');
    }

    // Fetch all stats in parallel for performance
    const [
      totalReports,
      openReports,
      inProgressReports,
      resolvedToday,
      avgResolutionTime,
      topContributors,
      areaWiseBreakdown
    ] = await Promise.all([
      this.getTotalReports(startDate, endDate),
      this.getOpenReports(),
      this.getInProgressReports(),
      this.getResolvedToday(),
      this.getAverageResolutionTime(startDate, endDate),
      this.getTopContributors(10),
      this.getAreaWiseBreakdown()
    ]);

    const stats: DashboardStats = {
      totalReports,
      openReports,
      inProgressReports,
      resolvedToday,
      avgResolutionTime,
      topContributors,
      areaWiseBreakdown
    };

    // Cache the result
    try {
      await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(stats));
    } catch (error) {
      logger.warn({ error }, 'Redis cache write failed for dashboard stats');
    }

    logger.info({ stats: { totalReports, openReports, resolvedToday } }, 'Dashboard stats fetched');
    return stats;
  }

  /**
   * Get total reports count
   */
  async getTotalReports(startDate?: Date, endDate?: Date): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM reports';
    const params: any[] = [];
    const conditions: string[] = [];

    if (startDate) {
      conditions.push(`created_at >= $${params.length + 1}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`created_at <= $${params.length + 1}`);
      params.push(endDate);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get count of open reports
   */
  async getOpenReports(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM reports WHERE status = $1`,
      [ReportStatus.OPEN]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get count of in-progress reports (assigned + in_progress)
   */
  async getInProgressReports(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM reports WHERE status IN ($1, $2)`,
      [ReportStatus.ASSIGNED, ReportStatus.IN_PROGRESS]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get count of reports resolved today
   */
  async getResolvedToday(): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM reports 
       WHERE status = $1 
       AND resolved_at >= CURRENT_DATE`,
      [ReportStatus.RESOLVED]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get average resolution time in hours
   */
  async getAverageResolutionTime(startDate?: Date, endDate?: Date): Promise<number> {
    let query = `
      SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
      FROM reports 
      WHERE status = $1 AND resolved_at IS NOT NULL
    `;
    const params: any[] = [ReportStatus.RESOLVED];

    if (startDate) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    const result = await pool.query(query, params);
    const avgHours = result.rows[0].avg_hours;
    
    // Return 0 if no resolved reports, otherwise round to 2 decimal places
    return avgHours ? Math.round(parseFloat(avgHours) * 100) / 100 : 0;
  }

  /**
   * Get top contributors by points
   */
  async getTopContributors(limit: number = 10): Promise<ContributorSummary[]> {
    const result = await pool.query(
      `SELECT device_id, total_points, reports_count
       FROM citizens
       WHERE total_points > 0
       ORDER BY total_points DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      deviceId: this.hashDeviceId(row.device_id),
      points: row.total_points || 0,
      reportsCount: row.reports_count || 0
    }));
  }

  /**
   * Get area-wise breakdown of reports
   */
  async getAreaWiseBreakdown(): Promise<AreaBreakdown[]> {
    // Get area from citizen's area field or derive from location
    // For now, we'll use a simplified approach based on location clustering
    const result = await pool.query(`
      SELECT 
        COALESCE(c.area, 'Unknown') as area_name,
        COUNT(r.id) as total_reports,
        COUNT(CASE WHEN r.status = 'resolved' THEN 1 END) as resolved_reports
      FROM reports r
      LEFT JOIN citizens c ON r.device_id = c.device_id
      GROUP BY COALESCE(c.area, 'Unknown')
      ORDER BY total_reports DESC
      LIMIT 20
    `);

    return result.rows.map(row => {
      const total = parseInt(row.total_reports, 10);
      const resolved = parseInt(row.resolved_reports, 10);
      return {
        areaName: row.area_name,
        totalReports: total,
        resolvedPercentage: total > 0 ? Math.round((resolved / total) * 100) : 0
      };
    });
  }

  /**
   * Hash device ID for privacy
   */
  private hashDeviceId(deviceId: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(deviceId).digest('hex');
    return `user_${hash.substring(0, 8)}***`;
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();
export default dashboardService;
