/**
 * Status Service - Report Status Transitions and Tracking
 * Requirements: 5.5, 5.1, 5.2, 5.4
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import { ReportStatus, WasteReport } from '../types';

// ============================================
// Status Transition Rules
// ============================================

/**
 * Valid status transitions map
 * Property 17: Status transition validation
 * Sequence: open → assigned → in_progress → verified → resolved
 */
export const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  [ReportStatus.OPEN]: [ReportStatus.ASSIGNED],
  [ReportStatus.ASSIGNED]: [ReportStatus.IN_PROGRESS, ReportStatus.OPEN], // Can return to open if unassigned
  [ReportStatus.IN_PROGRESS]: [ReportStatus.VERIFIED],
  [ReportStatus.VERIFIED]: [ReportStatus.RESOLVED, ReportStatus.ASSIGNED], // Can reject back to assigned
  [ReportStatus.RESOLVED]: [] // Terminal state
};

/**
 * Status order for comparison (lower = earlier in workflow)
 */
export const STATUS_ORDER: Record<ReportStatus, number> = {
  [ReportStatus.OPEN]: 0,
  [ReportStatus.ASSIGNED]: 1,
  [ReportStatus.IN_PROGRESS]: 2,
  [ReportStatus.VERIFIED]: 3,
  [ReportStatus.RESOLVED]: 4
};

// ============================================
// Status Transition Validation
// ============================================

export interface StatusTransitionResult {
  isValid: boolean;
  error?: string;
  fromStatus: ReportStatus;
  toStatus: ReportStatus;
}

/**
 * Validate if a status transition is allowed
 * Property 17: Status transition validation
 */
export function validateStatusTransition(
  currentStatus: ReportStatus,
  newStatus: ReportStatus
): StatusTransitionResult {
  const result: StatusTransitionResult = {
    isValid: false,
    fromStatus: currentStatus,
    toStatus: newStatus
  };

  // Same status is not a valid transition
  if (currentStatus === newStatus) {
    result.error = `Status is already ${currentStatus}`;
    return result;
  }

  // Check if transition is in valid transitions map
  const allowedTransitions = VALID_TRANSITIONS[currentStatus];
  
  if (!allowedTransitions || allowedTransitions.length === 0) {
    result.error = `No transitions allowed from ${currentStatus} (terminal state)`;
    return result;
  }

  if (!allowedTransitions.includes(newStatus)) {
    result.error = `Invalid transition from ${currentStatus} to ${newStatus}. Allowed: ${allowedTransitions.join(', ')}`;
    return result;
  }

  result.isValid = true;
  return result;
}

/**
 * Check if a status can transition forward (not backwards)
 */
export function isForwardTransition(
  currentStatus: ReportStatus,
  newStatus: ReportStatus
): boolean {
  return STATUS_ORDER[newStatus] > STATUS_ORDER[currentStatus];
}

/**
 * Get the next valid status in the workflow
 */
export function getNextStatus(currentStatus: ReportStatus): ReportStatus | null {
  const forwardTransitions = VALID_TRANSITIONS[currentStatus].filter(
    (status) => isForwardTransition(currentStatus, status)
  );
  return forwardTransitions.length > 0 ? forwardTransitions[0] : null;
}

/**
 * Check if status is a terminal state
 */
export function isTerminalStatus(status: ReportStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0;
}

// ============================================
// Status Service Interface
// ============================================

export interface IStatusService {
  transitionStatus(reportId: string, newStatus: ReportStatus, workerId?: string): Promise<StatusTransitionResult>;
  getReportWithPhotos(reportId: string): Promise<ReportWithPhotos | null>;
  getReportsForDevice(deviceId: string): Promise<ReportDisplayData[]>;
}

export interface ReportWithPhotos extends WasteReport {
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

export interface ReportDisplayData {
  id: string;
  photoUrl: string;
  thumbnailUrl: string;
  location: {
    lat: number;
    lng: number;
  };
  status: ReportStatus;
  timestamp: Date;
  description?: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

// ============================================
// Status Service Implementation
// ============================================

class StatusService implements IStatusService {
  /**
   * Transition a report to a new status with validation
   * Requirements: 5.5
   */
  async transitionStatus(
    reportId: string,
    newStatus: ReportStatus,
    workerId?: string
  ): Promise<StatusTransitionResult> {
    // Get current status
    const currentResult = await pool.query(
      `SELECT status FROM reports WHERE id = $1`,
      [reportId]
    );

    if (currentResult.rows.length === 0) {
      return {
        isValid: false,
        error: 'Report not found',
        fromStatus: ReportStatus.OPEN,
        toStatus: newStatus
      };
    }

    const currentStatus = currentResult.rows[0].status as ReportStatus;

    // Validate transition
    const validationResult = validateStatusTransition(currentStatus, newStatus);
    
    if (!validationResult.isValid) {
      logger.warn({ reportId, currentStatus, newStatus, error: validationResult.error }, 'Invalid status transition attempted');
      return validationResult;
    }

    // Perform the transition
    const timestampField = this.getTimestampFieldForStatus(newStatus);
    
    let query = `UPDATE reports SET status = $1`;
    const params: (string | null)[] = [newStatus];
    let paramIndex = 2;

    if (timestampField) {
      query += `, ${timestampField} = NOW()`;
    }

    if (workerId && newStatus === ReportStatus.ASSIGNED) {
      query += `, worker_id = $${paramIndex}`;
      params.push(workerId);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex}`;
    params.push(reportId);

    await pool.query(query, params);
    
    logger.info({ reportId, fromStatus: currentStatus, toStatus: newStatus, workerId }, 'Report status transitioned');

    return validationResult;
  }

  /**
   * Get report with before/after photos
   * Requirements: 5.4
   */
  async getReportWithPhotos(reportId: string): Promise<ReportWithPhotos | null> {
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

    const row = result.rows[0];
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
      severity: row.severity || undefined,
      wasteTypes: row.waste_types || undefined,
      createdAt: new Date(row.created_at),
      assignedAt: row.assigned_at ? new Date(row.assigned_at) : undefined,
      inProgressAt: row.in_progress_at ? new Date(row.in_progress_at) : undefined,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
      workerId: row.worker_id || undefined,
      pointsAwarded: row.points_awarded || 0,
      beforePhotoUrl: row.before_photo_url || undefined,
      afterPhotoUrl: row.after_photo_url || undefined
    };
  }

  /**
   * Get reports for device with display fields
   * Requirements: 5.1, 5.2
   */
  async getReportsForDevice(deviceId: string): Promise<ReportDisplayData[]> {
    const result = await pool.query(
      `SELECT 
        r.id, r.photo_url, r.latitude, r.longitude,
        r.status, r.created_at, r.description,
        v.before_photo_url, v.after_photo_url
       FROM reports r
       LEFT JOIN verifications v ON r.id = v.report_id AND v.approval_status = 'approved'
       WHERE r.device_id = $1
       ORDER BY r.created_at DESC`,
      [deviceId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      photoUrl: row.photo_url,
      thumbnailUrl: this.getThumbnailUrl(row.photo_url),
      location: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude)
      },
      status: row.status as ReportStatus,
      timestamp: new Date(row.created_at),
      description: row.description || undefined,
      beforePhotoUrl: row.before_photo_url || undefined,
      afterPhotoUrl: row.after_photo_url || undefined
    }));
  }

  /**
   * Get thumbnail URL from photo URL
   * In production, this would point to a resized version
   */
  private getThumbnailUrl(photoUrl: string): string {
    // For now, return the same URL
    // In production, append thumbnail suffix or use CDN transformation
    return photoUrl;
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
export const statusService = new StatusService();
export default statusService;
