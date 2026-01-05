/**
 * Device Fingerprint Service
 * Requirements: 1.4
 * 
 * Note: Device fingerprint is generated on the client side (mobile app)
 * using device characteristics. This service handles validation and
 * storage of fingerprints on the backend.
 */

import crypto from 'crypto';
import pool from '../db/pool';
import { logger } from '../config/logger';
import { Citizen, BadgeType } from '../types';

// ============================================
// Fingerprint Service Interface
// ============================================

export interface IFingerprintService {
  validateFingerprint(fingerprint: string): boolean;
  hashFingerprint(fingerprint: string): string;
  getOrCreateCitizen(deviceId: string): Promise<Citizen>;
  updateCitizenActivity(deviceId: string): Promise<void>;
}

// ============================================
// Fingerprint Validation Rules
// ============================================

const FINGERPRINT_RULES = {
  minLength: 16,
  maxLength: 128,
  // Allow alphanumeric, hyphens, and underscores
  validPattern: /^[a-zA-Z0-9_-]+$/
};

// ============================================
// Fingerprint Service Implementation
// ============================================

class FingerprintService implements IFingerprintService {
  /**
   * Validate device fingerprint format
   * Requirements: 1.4
   */
  validateFingerprint(fingerprint: string): boolean {
    if (!fingerprint || typeof fingerprint !== 'string') {
      return false;
    }

    const trimmed = fingerprint.trim();

    if (trimmed.length < FINGERPRINT_RULES.minLength) {
      return false;
    }

    if (trimmed.length > FINGERPRINT_RULES.maxLength) {
      return false;
    }

    if (!FINGERPRINT_RULES.validPattern.test(trimmed)) {
      return false;
    }

    return true;
  }

  /**
   * Hash fingerprint for privacy in leaderboards
   * Uses SHA-256 with truncation for display
   */
  hashFingerprint(fingerprint: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(fingerprint)
      .digest('hex');
    
    // Return first 8 characters with prefix for display
    return `user_${hash.substring(0, 8)}***`;
  }

  /**
   * Get existing citizen or create new one
   * Requirements: 1.4
   */
  async getOrCreateCitizen(deviceId: string): Promise<Citizen> {
    const client = await pool.connect();

    try {
      // Try to get existing citizen
      const existingResult = await client.query(
        `SELECT 
          device_id, first_seen, last_active, total_points,
          reports_count, current_badge, city, area, streak_days, last_report_date
         FROM citizens 
         WHERE device_id = $1`,
        [deviceId]
      );

      if (existingResult.rows.length > 0) {
        return this.mapRowToCitizen(existingResult.rows[0]);
      }

      // Create new citizen
      const insertResult = await client.query(
        `INSERT INTO citizens (device_id, first_seen, last_active, current_badge)
         VALUES ($1, NOW(), NOW(), $2)
         RETURNING 
          device_id, first_seen, last_active, total_points,
          reports_count, current_badge, city, area, streak_days, last_report_date`,
        [deviceId, BadgeType.CLEANLINESS_ROOKIE]
      );

      logger.info({ deviceId }, 'New citizen created');
      return this.mapRowToCitizen(insertResult.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Update citizen's last activity timestamp
   */
  async updateCitizenActivity(deviceId: string): Promise<void> {
    await pool.query(
      `UPDATE citizens SET last_active = NOW() WHERE device_id = $1`,
      [deviceId]
    );
  }

  /**
   * Generate a server-side fingerprint component
   * This can be combined with client fingerprint for additional security
   */
  generateServerComponent(
    ip: string,
    userAgent: string,
    timestamp: number
  ): string {
    const data = `${ip}:${userAgent}:${timestamp}`;
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Map database row to Citizen object
   */
  private mapRowToCitizen(row: any): Citizen {
    return {
      deviceId: row.device_id,
      firstSeen: new Date(row.first_seen),
      lastActive: new Date(row.last_active),
      totalPoints: row.total_points || 0,
      reportsCount: row.reports_count || 0,
      currentBadge: row.current_badge as BadgeType,
      city: row.city || undefined,
      area: row.area || undefined,
      streakDays: row.streak_days || 0,
      lastReportDate: row.last_report_date ? new Date(row.last_report_date) : undefined
    };
  }
}

// Export singleton instance
export const fingerprintService = new FingerprintService();
export default fingerprintService;
