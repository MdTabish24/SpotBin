/**
 * Abuse Prevention Service
 * Requirements: 2.1, 2.2, 2.3
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import { SpamCheckResult, RATE_LIMIT_CONFIG } from '../types';
import { calculateDistance } from '../utils/validation';

// ============================================
// Abuse Prevention Service Interface
// ============================================

export interface IAbusePreventionService {
  checkSpam(deviceId: string, lat: number, lng: number): Promise<SpamCheckResult>;
  checkDailyLimit(deviceId: string): Promise<{ exceeded: boolean; count: number }>;
  checkCooldown(deviceId: string): Promise<{ active: boolean; waitSeconds?: number }>;
  checkDuplicate(lat: number, lng: number): Promise<boolean>;
}

// ============================================
// Abuse Prevention Service Implementation
// ============================================

class AbusePreventionService implements IAbusePreventionService {
  /**
   * Comprehensive spam check combining all abuse prevention rules
   * Requirements: 2.1, 2.2, 2.3
   */
  async checkSpam(
    deviceId: string,
    lat: number,
    lng: number
  ): Promise<SpamCheckResult> {
    // Check daily limit first (most common rejection)
    const dailyCheck = await this.checkDailyLimit(deviceId);
    if (dailyCheck.exceeded) {
      logger.info({ deviceId, count: dailyCheck.count }, 'Daily limit exceeded');
      return {
        isSpam: true,
        reason: 'daily_limit',
        retryAfter: this.getSecondsUntilMidnight()
      };
    }

    // Check cooldown period
    const cooldownCheck = await this.checkCooldown(deviceId);
    if (cooldownCheck.active) {
      logger.info({ deviceId, waitSeconds: cooldownCheck.waitSeconds }, 'Cooldown active');
      return {
        isSpam: true,
        reason: 'cooldown',
        retryAfter: cooldownCheck.waitSeconds
      };
    }

    // Check for duplicate reports
    const isDuplicate = await this.checkDuplicate(lat, lng);
    if (isDuplicate) {
      logger.info({ deviceId, lat, lng }, 'Duplicate report detected');
      return {
        isSpam: true,
        reason: 'duplicate'
      };
    }

    return { isSpam: false };
  }

  /**
   * Check if device has exceeded daily report limit
   * Requirements: 2.1 - Max 10 reports per device per day
   */
  async checkDailyLimit(deviceId: string): Promise<{ exceeded: boolean; count: number }> {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM reports 
       WHERE device_id = $1 
         AND created_at >= CURRENT_DATE`,
      [deviceId]
    );

    const count = parseInt(result.rows[0].count, 10);
    const exceeded = count >= RATE_LIMIT_CONFIG.maxReportsPerDay;

    return { exceeded, count };
  }

  /**
   * Check if cooldown period is active
   * Requirements: 2.2 - Minimum 5 minutes between reports
   */
  async checkCooldown(deviceId: string): Promise<{ active: boolean; waitSeconds?: number }> {
    const result = await pool.query(
      `SELECT created_at 
       FROM reports 
       WHERE device_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return { active: false };
    }

    const lastReportTime = new Date(result.rows[0].created_at);
    const now = new Date();
    const diffSeconds = (now.getTime() - lastReportTime.getTime()) / 1000;
    const cooldownSeconds = RATE_LIMIT_CONFIG.cooldownMinutes * 60;

    if (diffSeconds < cooldownSeconds) {
      const waitSeconds = Math.ceil(cooldownSeconds - diffSeconds);
      return { active: true, waitSeconds };
    }

    return { active: false };
  }

  /**
   * Check for duplicate reports within radius
   * Requirements: 2.3 - Reject if report exists within 50m in last 24 hours
   */
  async checkDuplicate(lat: number, lng: number): Promise<boolean> {
    // Get all open reports from last 24 hours
    const result = await pool.query(
      `SELECT latitude, longitude 
       FROM reports 
       WHERE status = 'open' 
         AND created_at > NOW() - INTERVAL '24 hours'`
    );

    // Check distance to each report using Haversine formula
    for (const row of result.rows) {
      const reportLat = parseFloat(row.latitude);
      const reportLng = parseFloat(row.longitude);
      
      const distance = calculateDistance(lat, lng, reportLat, reportLng);

      if (distance <= RATE_LIMIT_CONFIG.duplicateRadiusMeters) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get seconds until midnight (for daily limit reset)
   */
  private getSecondsUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
  }
}

// Export singleton instance
export const abusePreventionService = new AbusePreventionService();
export default abusePreventionService;
