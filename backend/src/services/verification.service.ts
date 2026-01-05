/**
 * Verification Service - Worker Verification Flow
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import {
  Verification,
  ReportStatus,
  ApprovalStatus,
  GeoLocation,
  StartTaskDTO,
  CompleteTaskDTO,
  VERIFICATION_RULES
} from '../types';
import { calculateDistance } from '../utils/validation';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Verification Validation Functions
// ============================================

export interface ProximityValidationResult {
  isValid: boolean;
  distance: number;
  maxAllowed: number;
  error?: string;
}

/**
 * Validate worker proximity to report location
 * Property 23: Worker must be within 50 meters of report location
 */
export function validateWorkerProximity(
  workerLat: number,
  workerLng: number,
  reportLat: number,
  reportLng: number
): ProximityValidationResult {
  const distance = calculateDistance(workerLat, workerLng, reportLat, reportLng);
  const maxAllowed = VERIFICATION_RULES.maxDistanceFromReport;

  if (distance > maxAllowed) {
    return {
      isValid: false,
      distance,
      maxAllowed,
      error: `Worker must be within ${maxAllowed} meters of report location. Current distance: ${Math.round(distance)} meters`
    };
  }

  return {
    isValid: true,
    distance,
    maxAllowed
  };
}

export interface TimingValidationResult {
  isValid: boolean;
  timeBetweenMinutes: number;
  minRequired: number;
  maxAllowed: number;
  error?: string;
}

/**
 * Validate photo timing constraints
 * Property 24: Time between photos must be 2-240 minutes
 */
export function validatePhotoTiming(
  beforeTimestamp: Date,
  afterTimestamp: Date
): TimingValidationResult {
  const timeBetweenMs = afterTimestamp.getTime() - beforeTimestamp.getTime();
  const timeBetweenMinutes = timeBetweenMs / (1000 * 60);

  const minRequired = VERIFICATION_RULES.minTimeBetweenPhotos;
  const maxAllowed = VERIFICATION_RULES.maxTimeBetweenPhotos;

  if (timeBetweenMinutes < minRequired) {
    return {
      isValid: false,
      timeBetweenMinutes,
      minRequired,
      maxAllowed,
      error: `Time between photos must be at least ${minRequired} minutes. Current: ${timeBetweenMinutes.toFixed(1)} minutes`
    };
  }

  if (timeBetweenMinutes > maxAllowed) {
    return {
      isValid: false,
      timeBetweenMinutes,
      minRequired,
      maxAllowed,
      error: `Time between photos must not exceed ${maxAllowed} minutes (4 hours). Current: ${timeBetweenMinutes.toFixed(1)} minutes`
    };
  }

  return {
    isValid: true,
    timeBetweenMinutes,
    minRequired,
    maxAllowed
  };
}

/**
 * Calculate time spent on task in minutes
 */
export function calculateTimeSpent(startedAt: Date, completedAt: Date): number {
  const timeSpentMs = completedAt.getTime() - startedAt.getTime();
  return Math.round(timeSpentMs / (1000 * 60));
}

// ============================================
// Verification Service Interface
// ============================================

export interface IVerificationService {
  startTask(reportId: string, payload: StartTaskDTO, beforePhotoUrl: string): Promise<StartTaskResult>;
  completeTask(reportId: string, payload: CompleteTaskDTO, afterPhotoUrl: string): Promise<CompleteTaskResult>;
  getVerificationByReportId(reportId: string): Promise<Verification | null>;
  submitForApproval(verificationId: string): Promise<void>;
  approveVerification(verificationId: string): Promise<void>;
  rejectVerification(verificationId: string): Promise<void>;
}

export interface StartTaskResult {
  success: boolean;
  verificationId?: string;
  error?: string;
  distance?: number;
}

export interface CompleteTaskResult {
  success: boolean;
  verificationId?: string;
  timeSpent?: number;
  error?: string;
}

// ============================================
// Verification Service Implementation
// ============================================

class VerificationService implements IVerificationService {
  /**
   * Start a task - capture before photo
   * Requirements: 8.1, 8.2, 8.3
   * Property 23: Validate worker proximity (within 50m)
   * Property 25: Status changes to "in_progress"
   */
  async startTask(
    reportId: string,
    payload: StartTaskDTO,
    beforePhotoUrl: string
  ): Promise<StartTaskResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get report location
      const reportResult = await client.query(
        `SELECT latitude, longitude, status, worker_id FROM reports WHERE id = $1`,
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        return { success: false, error: 'Report not found' };
      }

      const report = reportResult.rows[0];

      // Verify worker is assigned to this report
      if (report.worker_id !== payload.workerId) {
        return { success: false, error: 'Worker is not assigned to this report' };
      }

      // Verify report is in correct status
      if (report.status !== ReportStatus.ASSIGNED) {
        return { success: false, error: `Cannot start task. Report status is ${report.status}, expected ${ReportStatus.ASSIGNED}` };
      }

      // Property 23: Validate worker proximity
      const proximityResult = validateWorkerProximity(
        payload.workerLat,
        payload.workerLng,
        parseFloat(report.latitude),
        parseFloat(report.longitude)
      );

      if (!proximityResult.isValid) {
        return {
          success: false,
          error: proximityResult.error,
          distance: proximityResult.distance
        };
      }

      // Create verification record
      const verificationId = uuidv4();
      await client.query(
        `INSERT INTO verifications (
          id, report_id, worker_id, before_photo_url, after_photo_url,
          started_at, completed_at, worker_lat, worker_lng, time_spent, approval_status
        ) VALUES ($1, $2, $3, $4, '', NOW(), NOW(), $5, $6, 0, $7)`,
        [
          verificationId,
          reportId,
          payload.workerId,
          beforePhotoUrl,
          payload.workerLat,
          payload.workerLng,
          ApprovalStatus.PENDING
        ]
      );

      // Property 25: Update report status to "in_progress"
      await client.query(
        `UPDATE reports SET status = $1, in_progress_at = NOW() WHERE id = $2`,
        [ReportStatus.IN_PROGRESS, reportId]
      );

      await client.query('COMMIT');

      logger.info({ reportId, verificationId, workerId: payload.workerId }, 'Task started');

      return {
        success: true,
        verificationId,
        distance: proximityResult.distance
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, reportId }, 'Failed to start task');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Complete a task - capture after photo
   * Requirements: 8.4, 8.5, 8.6, 8.7
   * Property 24: Validate timing constraints (2-240 minutes)
   * Property 25: Status changes to "verified"
   */
  async completeTask(
    reportId: string,
    payload: CompleteTaskDTO,
    afterPhotoUrl: string
  ): Promise<CompleteTaskResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get existing verification
      const verificationResult = await client.query(
        `SELECT id, worker_id, started_at FROM verifications WHERE report_id = $1`,
        [reportId]
      );

      if (verificationResult.rows.length === 0) {
        return { success: false, error: 'No verification found for this report. Start task first.' };
      }

      const verification = verificationResult.rows[0];

      // Verify worker matches
      if (verification.worker_id !== payload.workerId) {
        return { success: false, error: 'Worker mismatch. Only the worker who started can complete.' };
      }

      // Get report to verify status
      const reportResult = await client.query(
        `SELECT status FROM reports WHERE id = $1`,
        [reportId]
      );

      if (reportResult.rows[0].status !== ReportStatus.IN_PROGRESS) {
        return { success: false, error: `Cannot complete task. Report status is ${reportResult.rows[0].status}, expected ${ReportStatus.IN_PROGRESS}` };
      }

      const startedAt = new Date(verification.started_at);
      const completedAt = new Date();

      // Property 24: Validate photo timing
      const timingResult = validatePhotoTiming(startedAt, completedAt);

      if (!timingResult.isValid) {
        return { success: false, error: timingResult.error };
      }

      const timeSpent = calculateTimeSpent(startedAt, completedAt);

      // Update verification record
      await client.query(
        `UPDATE verifications 
         SET after_photo_url = $1, completed_at = NOW(), time_spent = $2
         WHERE id = $3`,
        [afterPhotoUrl, timeSpent, verification.id]
      );

      // Property 25: Update report status to "verified"
      await client.query(
        `UPDATE reports SET status = $1, verified_at = NOW() WHERE id = $2`,
        [ReportStatus.VERIFIED, reportId]
      );

      await client.query('COMMIT');

      logger.info({ reportId, verificationId: verification.id, timeSpent }, 'Task completed');

      return {
        success: true,
        verificationId: verification.id,
        timeSpent
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, reportId }, 'Failed to complete task');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get verification by report ID
   */
  async getVerificationByReportId(reportId: string): Promise<Verification | null> {
    const result = await pool.query(
      `SELECT * FROM verifications WHERE report_id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      reportId: row.report_id,
      workerId: row.worker_id,
      beforePhotoUrl: row.before_photo_url,
      afterPhotoUrl: row.after_photo_url,
      startedAt: new Date(row.started_at),
      completedAt: new Date(row.completed_at),
      workerLat: parseFloat(row.worker_lat),
      workerLng: parseFloat(row.worker_lng),
      timeSpent: row.time_spent,
      qualityScore: row.quality_score ? parseFloat(row.quality_score) : undefined,
      approvalStatus: row.approval_status as ApprovalStatus
    };
  }

  /**
   * Submit verification for admin approval
   */
  async submitForApproval(verificationId: string): Promise<void> {
    await pool.query(
      `UPDATE verifications SET approval_status = $1 WHERE id = $2`,
      [ApprovalStatus.PENDING, verificationId]
    );

    logger.info({ verificationId }, 'Verification submitted for approval');
  }

  /**
   * Approve verification - changes report to resolved
   */
  async approveVerification(verificationId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update verification status
      await client.query(
        `UPDATE verifications SET approval_status = $1 WHERE id = $2`,
        [ApprovalStatus.APPROVED, verificationId]
      );

      // Get report ID
      const verificationResult = await client.query(
        `SELECT report_id FROM verifications WHERE id = $1`,
        [verificationId]
      );

      if (verificationResult.rows.length > 0) {
        const reportId = verificationResult.rows[0].report_id;

        // Update report status to resolved
        await client.query(
          `UPDATE reports SET status = $1, resolved_at = NOW() WHERE id = $2`,
          [ReportStatus.RESOLVED, reportId]
        );
      }

      await client.query('COMMIT');

      logger.info({ verificationId }, 'Verification approved');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, verificationId }, 'Failed to approve verification');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reject verification - returns task to worker queue
   */
  async rejectVerification(verificationId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update verification status
      await client.query(
        `UPDATE verifications SET approval_status = $1 WHERE id = $2`,
        [ApprovalStatus.REJECTED, verificationId]
      );

      // Get report ID
      const verificationResult = await client.query(
        `SELECT report_id FROM verifications WHERE id = $1`,
        [verificationId]
      );

      if (verificationResult.rows.length > 0) {
        const reportId = verificationResult.rows[0].report_id;

        // Return report to assigned status
        await client.query(
          `UPDATE reports SET status = $1, verified_at = NULL WHERE id = $2`,
          [ReportStatus.ASSIGNED, reportId]
        );
      }

      await client.query('COMMIT');

      logger.info({ verificationId }, 'Verification rejected');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ error, verificationId }, 'Failed to reject verification');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const verificationService = new VerificationService();
export default verificationService;
