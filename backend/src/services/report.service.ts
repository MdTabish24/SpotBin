/**
 * Report Service - CRUD operations for waste reports
 * Requirements: 1.7, 5.1, 2.1, 2.2, 2.3
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import {
  WasteReport,
  ReportStatus,
  Severity,
  CreateReportDTO,
  ReportSubmissionResponse,
  GeoLocation,
  RATE_LIMIT_CONFIG
} from '../types';
import { calculateDistance } from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Report Service Interface
// ============================================

export interface IReportService {
  createReport(report: CreateReportDTO, photoUrl: string): Promise<ReportSubmissionResponse>;
  getReportsByDevice(deviceId: string): Promise<WasteReport[]>;
  getReportById(reportId: string): Promise<WasteReport | null>;
  updateReportStatus(reportId: string, status: ReportStatus, workerId?: string): Promise<void>;
  checkDuplicate(lat: number, lng: number): Promise<boolean>;
  validateReportCooldown(deviceId: string): Promise<{ canSubmit: boolean; waitMinutes?: number }>;
  getDailyReportCount(deviceId: string): Promise<number>;
}

// ============================================
// Report Service Implementation
// ============================================

class ReportService implements IReportService {
  /**
   * Create a new waste report
   * Requirements: 1.7
   */
  async createReport(
    report: CreateReportDTO,
    photoUrl: string
  ): Promise<ReportSubmissionResponse> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Ensure citizen exists (upsert)
      await client.query(
        `INSERT INTO citizens (device_id, first_seen, last_active)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (device_id) 
         DO UPDATE SET last_active = NOW()`,
        [report.deviceId]
      );

      // Create the report
      const reportId = uuidv4();
      const result = await client.query(
        `INSERT INTO reports (
          id, device_id, photo_url, latitude, longitude, 
          location_accuracy, description, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, status, created_at`,
        [
          reportId,
          report.deviceId,
          photoUrl,
          report.lat,
          report.lng,
          report.accuracy,
          report.description || null,
          ReportStatus.OPEN
        ]
      );

      // Update citizen's report count
      await client.query(
        `UPDATE citizens 
         SET reports_count = reports_count + 1,
             last_report_date = CURRENT_DATE
         WHERE device_id = $1`,
        [report.deviceId]
      );

      await client.query('COMMIT');

      logger.info({ reportId, deviceId: report.deviceId }, 'Report created successfully');

      return {
        reportId: result.rows[0].id,
        message: 'Report submitted successfully!',
        estimatedCleanupTime: 'Within 24 hours',
        status: ReportStatus.OPEN
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, deviceId: report.deviceId }, 'Failed to create report');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all reports by device ID
   * Requirements: 5.1
   */
  async getReportsByDevice(deviceId: string): Promise<WasteReport[]> {
    const result = await pool.query(
      `SELECT 
        r.id, r.device_id, r.photo_url, r.latitude, r.longitude,
        r.location_accuracy, r.description, r.status, r.severity,
        r.waste_types, r.created_at, r.assigned_at, r.in_progress_at,
        r.verified_at, r.resolved_at, r.worker_id, r.points_awarded,
        v.before_photo_url, v.after_photo_url
       FROM reports r
       LEFT JOIN verifications v ON r.id = v.report_id AND v.approval_status = 'approved'
       WHERE r.device_id = $1
       ORDER BY r.created_at DESC`,
      [deviceId]
    );

    return result.rows.map(this.mapRowToReport);
  }

  /**
   * Get a single report by ID
   */
  async getReportById(reportId: string): Promise<WasteReport | null> {
    const result = await pool.query(
      `SELECT 
        r.id, r.device_id, r.photo_url, r.latitude, r.longitude,
        r.location_accuracy, r.description, r.status, r.severity,
        r.waste_types, r.created_at, r.assigned_at, r.in_progress_at,
        r.verified_at, r.resolved_at, r.worker_id, r.points_awarded,
        v.before_photo_url, v.after_photo_url
       FROM reports r
       LEFT JOIN verifications v ON r.id = v.report_id AND v.approval_status = 'approved'
       WHERE r.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToReport(result.rows[0]);
  }

  /**
   * Update report status
   * Requirements: 5.5
   */
  async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    workerId?: string
  ): Promise<void> {
    const timestampField = this.getTimestampFieldForStatus(status);
    
    let query = `UPDATE reports SET status = $1`;
    const params: (string | null)[] = [status];
    let paramIndex = 2;

    if (timestampField) {
      query += `, ${timestampField} = NOW()`;
    }

    if (workerId && status === ReportStatus.ASSIGNED) {
      query += `, worker_id = $${paramIndex}`;
      params.push(workerId);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(reportId);

    await pool.query(query, params);
    
    logger.info({ reportId, status, workerId }, 'Report status updated');
  }

  /**
   * Check for duplicate reports within 50m radius in last 24 hours
   * Requirements: 2.3
   */
  async checkDuplicate(lat: number, lng: number): Promise<boolean> {
    // Get all open reports from last 24 hours
    const result = await pool.query(
      `SELECT latitude, longitude 
       FROM reports 
       WHERE status = 'open' 
         AND created_at > NOW() - INTERVAL '24 hours'`
    );

    // Check distance to each report
    for (const row of result.rows) {
      const distance = calculateDistance(
        lat,
        lng,
        parseFloat(row.latitude),
        parseFloat(row.longitude)
      );

      if (distance <= RATE_LIMIT_CONFIG.duplicateRadiusMeters) {
        logger.info({ lat, lng, distance }, 'Duplicate report detected');
        return true;
      }
    }

    return false;
  }

  /**
   * Validate cooldown period between reports
   * Requirements: 2.2
   */
  async validateReportCooldown(
    deviceId: string
  ): Promise<{ canSubmit: boolean; waitMinutes?: number }> {
    const result = await pool.query(
      `SELECT created_at 
       FROM reports 
       WHERE device_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [deviceId]
    );

    if (result.rows.length === 0) {
      return { canSubmit: true };
    }

    const lastReportTime = new Date(result.rows[0].created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastReportTime.getTime()) / (1000 * 60);

    if (diffMinutes < RATE_LIMIT_CONFIG.cooldownMinutes) {
      const waitMinutes = Math.ceil(RATE_LIMIT_CONFIG.cooldownMinutes - diffMinutes);
      return { canSubmit: false, waitMinutes };
    }

    return { canSubmit: true };
  }

  /**
   * Get daily report count for a device
   * Requirements: 2.1
   */
  async getDailyReportCount(deviceId: string): Promise<number> {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM reports 
       WHERE device_id = $1 
         AND created_at >= CURRENT_DATE`,
      [deviceId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  // ============================================
  // Helper Methods
  // ============================================

  private mapRowToReport(row: any): WasteReport {
    return {
      id: row.id,
      deviceId: row.device_id,
      photoUrl: row.photo_url,
      location: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        accuracy: row.location_accuracy ? parseFloat(row.location_accuracy) : 0
      },
      timestamp: new Date(row.created_at),
      description: row.description || undefined,
      status: row.status as ReportStatus,
      severity: row.severity as Severity | undefined,
      wasteTypes: row.waste_types || undefined,
      createdAt: new Date(row.created_at),
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : undefined,
      inProgressAt: row.in_progress_at ? new Date(row.in_progress_at) : undefined,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      workerId: row.worker_id || undefined,
      pointsAwarded: row.points_awarded || 0,
      // Include before/after photos if available
      ...(row.before_photo_url && row.after_photo_url && {
        beforeAfterPhotos: {
          before: row.before_photo_url,
          after: row.after_photo_url
        }
      })
    };
  }

  private getTimestampFieldForStatus(status: ReportStatus): string | null {
    switch (status) {
      case ReportStatus.ASSIGNED:
        return 'assigned_at';
      case ReportStatus.IN_PROGRESS:
        return 'in_progress_at';
      case ReportStatus.VERIFIED:
        return 'verified_at';
      case ReportStatus.RESOLVED:
        return 'resolved_at';
      default:
        return null;
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();
export default reportService;
