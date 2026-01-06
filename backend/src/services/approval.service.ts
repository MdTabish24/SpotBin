/**
 * Approval Service - Admin Approval Workflow
 * Requirements: 10.1, 10.2, 10.3, 10.4
 * Property 29: Approval workflow correctness
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import {
  ApprovalStatus,
  ReportStatus,
  Severity,
  PointReason
} from '../types';
import { pointsService } from './points.service';

// ============================================
// Approval Service Types
// ============================================

export interface ApprovalResult {
  success: boolean;
  reportId?: string;
  verificationId?: string;
  pointsAwarded?: number;
  newStatus?: ReportStatus;
  error?: string;
}

export interface PendingVerification {
  id: string;
  reportId: string;
  workerId: string;
  workerName: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  startedAt: Date;
  completedAt: Date;
  timeSpent: number;
  reportPhotoUrl: string;
  reportLocation: {
    lat: number;
    lng: number;
  };
  reportSeverity: Severity | null;
  reportDescription: string | null;
  reportCreatedAt: Date;
  deviceId: string;
}

export interface ApprovalStats {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  avgApprovalTime: number; // hours
}

// ============================================
// Approval Service Interface
// ============================================

export interface IApprovalService {
  approveVerification(verificationId: string, adminId?: string): Promise<ApprovalResult>;
  rejectVerification(verificationId: string, reason?: string, adminId?: string): Promise<ApprovalResult>;
  getPendingVerifications(limit?: number, offset?: number): Promise<PendingVerification[]>;
  getVerificationById(verificationId: string): Promise<PendingVerification | null>;
  getApprovalStats(): Promise<ApprovalStats>;
}

// ============================================
// Approval Service Implementation
// ============================================

class ApprovalService implements IApprovalService {
  /**
   * Approve a verification
   * Property 29: Approved verifications SHALL:
   * - Change report status to "resolved"
   * - Credit points to citizen
   * - Trigger notification (handled by notification service)
   * Requirements: 10.1, 10.2, 10.4
   */
  async approveVerification(
    verificationId: string,
    adminId?: string
  ): Promise<ApprovalResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get verification details
      const verificationResult = await client.query(
        `SELECT v.id, v.report_id, v.worker_id, v.approval_status,
                r.device_id, r.severity, r.status as report_status
         FROM verifications v
         JOIN reports r ON v.report_id = r.id
         WHERE v.id = $1`,
        [verificationId]
      );

      if (verificationResult.rows.length === 0) {
        return { success: false, error: 'Verification not found' };
      }

      const verification = verificationResult.rows[0];

      // Check if already processed
      if (verification.approval_status === ApprovalStatus.APPROVED) {
        return { success: false, error: 'Verification already approved' };
      }

      if (verification.approval_status === ApprovalStatus.REJECTED) {
        return { success: false, error: 'Verification was rejected. Cannot approve.' };
      }

      // Check report is in verified status
      if (verification.report_status !== ReportStatus.VERIFIED) {
        return {
          success: false,
          error: `Report status is ${verification.report_status}, expected ${ReportStatus.VERIFIED}`
        };
      }

      // Update verification status to approved
      await client.query(
        `UPDATE verifications SET approval_status = $1 WHERE id = $2`,
        [ApprovalStatus.APPROVED, verificationId]
      );

      // Update report status to resolved
      await client.query(
        `UPDATE reports SET status = $1, resolved_at = NOW() WHERE id = $2`,
        [ReportStatus.RESOLVED, verification.report_id]
      );

      await client.query('COMMIT');

      // Award points to citizen (outside transaction for isolation)
      let pointsAwarded = 0;
      try {
        pointsAwarded = await pointsService.awardPoints(
          verification.device_id,
          verification.report_id,
          PointReason.REPORT_VERIFIED,
          verification.severity as Severity | undefined
        );
      } catch (pointsError) {
        logger.error({ pointsError, verificationId }, 'Failed to award points, but approval succeeded');
      }

      logger.info({
        verificationId,
        reportId: verification.report_id,
        deviceId: verification.device_id,
        pointsAwarded,
        adminId
      }, 'Verification approved');

      return {
        success: true,
        reportId: verification.report_id,
        verificationId,
        pointsAwarded,
        newStatus: ReportStatus.RESOLVED
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, verificationId }, 'Failed to approve verification');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject a verification
   * Property 29: Rejected verifications SHALL return task to worker queue with status "assigned"
   * Requirements: 10.3
   */
  async rejectVerification(
    verificationId: string,
    reason?: string,
    adminId?: string
  ): Promise<ApprovalResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get verification details
      const verificationResult = await client.query(
        `SELECT v.id, v.report_id, v.worker_id, v.approval_status,
                r.status as report_status
         FROM verifications v
         JOIN reports r ON v.report_id = r.id
         WHERE v.id = $1`,
        [verificationId]
      );

      if (verificationResult.rows.length === 0) {
        return { success: false, error: 'Verification not found' };
      }

      const verification = verificationResult.rows[0];

      // Check if already processed
      if (verification.approval_status === ApprovalStatus.APPROVED) {
        return { success: false, error: 'Verification already approved. Cannot reject.' };
      }

      if (verification.approval_status === ApprovalStatus.REJECTED) {
        return { success: false, error: 'Verification already rejected' };
      }

      // Update verification status to rejected
      await client.query(
        `UPDATE verifications SET approval_status = $1 WHERE id = $2`,
        [ApprovalStatus.REJECTED, verificationId]
      );

      // Return report to assigned status (back to worker queue)
      await client.query(
        `UPDATE reports 
         SET status = $1, verified_at = NULL, in_progress_at = NULL
         WHERE id = $2`,
        [ReportStatus.ASSIGNED, verification.report_id]
      );

      await client.query('COMMIT');

      logger.info({
        verificationId,
        reportId: verification.report_id,
        reason,
        adminId
      }, 'Verification rejected');

      return {
        success: true,
        reportId: verification.report_id,
        verificationId,
        newStatus: ReportStatus.ASSIGNED
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, verificationId }, 'Failed to reject verification');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pending verifications for admin review
   * Requirements: 10.1
   */
  async getPendingVerifications(
    limit: number = 50,
    offset: number = 0
  ): Promise<PendingVerification[]> {
    const result = await pool.query(
      `SELECT 
        v.id, v.report_id, v.worker_id, v.before_photo_url, v.after_photo_url,
        v.started_at, v.completed_at, v.time_spent,
        r.photo_url as report_photo_url, r.latitude, r.longitude,
        r.severity, r.description, r.created_at as report_created_at, r.device_id,
        w.name as worker_name
       FROM verifications v
       JOIN reports r ON v.report_id = r.id
       JOIN workers w ON v.worker_id = w.id
       WHERE v.approval_status = $1
       ORDER BY v.completed_at ASC
       LIMIT $2 OFFSET $3`,
      [ApprovalStatus.PENDING, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      reportId: row.report_id,
      workerId: row.worker_id,
      workerName: row.worker_name,
      beforePhotoUrl: row.before_photo_url,
      afterPhotoUrl: row.after_photo_url,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      timeSpent: row.time_spent,
      reportPhotoUrl: row.report_photo_url,
      reportLocation: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude)
      },
      reportSeverity: row.severity as Severity | null,
      reportDescription: row.description,
      reportCreatedAt: new Date(row.report_created_at),
      deviceId: row.device_id
    }));
  }

  /**
   * Get a single verification by ID
   */
  async getVerificationById(verificationId: string): Promise<PendingVerification | null> {
    const result = await pool.query(
      `SELECT 
        v.id, v.report_id, v.worker_id, v.before_photo_url, v.after_photo_url,
        v.started_at, v.completed_at, v.time_spent,
        r.photo_url as report_photo_url, r.latitude, r.longitude,
        r.severity, r.description, r.created_at as report_created_at, r.device_id,
        w.name as worker_name
       FROM verifications v
       JOIN reports r ON v.report_id = r.id
       JOIN workers w ON v.worker_id = w.id
       WHERE v.id = $1`,
      [verificationId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      reportId: row.report_id,
      workerId: row.worker_id,
      workerName: row.worker_name,
      beforePhotoUrl: row.before_photo_url,
      afterPhotoUrl: row.after_photo_url,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      timeSpent: row.time_spent,
      reportPhotoUrl: row.report_photo_url,
      reportLocation: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude)
      },
      reportSeverity: row.severity as Severity | null,
      reportDescription: row.description,
      reportCreatedAt: new Date(row.report_created_at),
      deviceId: row.device_id
    };
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(): Promise<ApprovalStats> {
    const [pendingResult, approvedTodayResult, rejectedTodayResult, avgTimeResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count FROM verifications WHERE approval_status = $1`,
        [ApprovalStatus.PENDING]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM verifications 
         WHERE approval_status = $1 
         AND completed_at >= CURRENT_DATE`,
        [ApprovalStatus.APPROVED]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM verifications 
         WHERE approval_status = $1 
         AND completed_at >= CURRENT_DATE`,
        [ApprovalStatus.REJECTED]
      ),
      pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (r.resolved_at - v.completed_at)) / 3600) as avg_hours
         FROM verifications v
         JOIN reports r ON v.report_id = r.id
         WHERE v.approval_status = $1 AND r.resolved_at IS NOT NULL`,
        [ApprovalStatus.APPROVED]
      )
    ]);

    return {
      pendingCount: parseInt(pendingResult.rows[0].count, 10),
      approvedToday: parseInt(approvedTodayResult.rows[0].count, 10),
      rejectedToday: parseInt(rejectedTodayResult.rows[0].count, 10),
      avgApprovalTime: parseFloat(avgTimeResult.rows[0].avg_hours) || 0
    };
  }
}

// Export singleton instance
export const approvalService = new ApprovalService();
export default approvalService;
