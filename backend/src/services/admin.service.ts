/**
 * Admin Service - Report filtering and management for admin panel
 * Requirements: 9.4
 * Property 27: Admin filter functionality
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import {
  WasteReport,
  ReportStatus,
  Severity,
  GeoLocation
} from '../types';

// ============================================
// Admin Filter Types
// ============================================

export interface AdminReportFilters {
  startDate?: Date;
  endDate?: Date;
  area?: string;
  status?: ReportStatus;
  severity?: Severity;
  page?: number;
  limit?: number;
}

export interface PaginatedReports {
  reports: WasteReport[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ============================================
// Admin Service Interface
// ============================================

export interface IAdminService {
  getFilteredReports(filters: AdminReportFilters): Promise<PaginatedReports>;
  getReportById(reportId: string): Promise<WasteReport | null>;
}

// ============================================
// Admin Service Implementation
// ============================================

class AdminService implements IAdminService {
  private readonly DEFAULT_PAGE_SIZE = 50;
  private readonly MAX_PAGE_SIZE = 100;

  /**
   * Get filtered reports with pagination
   * Property 27: Admin filter functionality
   * For any combination of filters (date range, area, status, severity),
   * the returned reports SHALL only include reports matching ALL specified filter criteria.
   */
  async getFilteredReports(filters: AdminReportFilters): Promise<PaginatedReports> {
    const {
      startDate,
      endDate,
      area,
      status,
      severity,
      page = 1,
      limit = this.DEFAULT_PAGE_SIZE
    } = filters;

    // Ensure limit doesn't exceed max
    const safeLimit = Math.min(limit, this.MAX_PAGE_SIZE);
    const offset = (page - 1) * safeLimit;

    // Build dynamic query with filters
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Date range filter
    if (startDate) {
      conditions.push(`r.created_at >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      conditions.push(`r.created_at <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    // Area filter (from citizen's area)
    if (area) {
      conditions.push(`c.area = $${paramIndex}`);
      params.push(area);
      paramIndex++;
    }

    // Status filter
    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Severity filter
    if (severity) {
      conditions.push(`r.severity = $${paramIndex}`);
      params.push(severity);
      paramIndex++;
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM reports r
      LEFT JOIN citizens c ON r.device_id = c.device_id
      ${whereClause}
    `;
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get paginated reports
    const dataQuery = `
      SELECT 
        r.id, r.device_id, r.photo_url, r.latitude, r.longitude,
        r.location_accuracy, r.description, r.status, r.severity,
        r.waste_types, r.created_at, r.assigned_at, r.in_progress_at,
        r.verified_at, r.resolved_at, r.worker_id, r.points_awarded,
        v.before_photo_url, v.after_photo_url,
        c.area
      FROM reports r
      LEFT JOIN citizens c ON r.device_id = c.device_id
      LEFT JOIN verifications v ON r.id = v.report_id AND v.approval_status = 'approved'
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(safeLimit, offset);

    const dataResult = await pool.query(dataQuery, params);

    const reports = dataResult.rows.map(this.mapRowToReport);
    const totalPages = Math.ceil(totalCount / safeLimit);

    logger.info(
      { filters: { startDate, endDate, area, status, severity }, totalCount, page },
      'Admin filtered reports fetched'
    );

    return {
      reports,
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * Get a single report by ID with full details
   */
  async getReportById(reportId: string): Promise<WasteReport | null> {
    const result = await pool.query(
      `SELECT 
        r.id, r.device_id, r.photo_url, r.latitude, r.longitude,
        r.location_accuracy, r.description, r.status, r.severity,
        r.waste_types, r.created_at, r.assigned_at, r.in_progress_at,
        r.verified_at, r.resolved_at, r.worker_id, r.points_awarded,
        v.before_photo_url, v.after_photo_url, v.started_at, v.completed_at,
        w.name as worker_name
       FROM reports r
       LEFT JOIN verifications v ON r.id = v.report_id
       LEFT JOIN workers w ON r.worker_id = w.id
       WHERE r.id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToReport(result.rows[0]);
  }

  /**
   * Map database row to WasteReport object
   */
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
}

// Export singleton instance
export const adminService = new AdminService();
export default adminService;
