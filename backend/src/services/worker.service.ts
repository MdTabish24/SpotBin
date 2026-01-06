/**
 * Worker Management Service
 * Requirements: 11.1, 11.2, 11.3
 * 
 * Provides CRUD operations for workers, zone assignment/reassignment,
 * and worker stats calculation for admin panel.
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import { Worker, ReportStatus, ApprovalStatus } from '../types';

// ============================================
// Worker Stats Interface
// ============================================

export interface WorkerStats {
  workerId: string;
  name: string;
  phone: string;
  assignedZones: string[];
  isActive: boolean;
  tasksCompleted: number;
  activeTasksCount: number;
  avgResolutionTime: number; // in hours
  totalVerifications: number;
  approvedVerifications: number;
  rejectedVerifications: number;
  efficiency: number; // percentage of approved vs total
  lastActive: Date | null;
}

export interface WorkerPerformance {
  workerId: string;
  name: string;
  daily: PerformanceMetrics;
  weekly: PerformanceMetrics;
  monthly: PerformanceMetrics;
}

export interface PerformanceMetrics {
  tasksCompleted: number;
  avgResolutionTime: number;
  approvalRate: number;
}

export interface CreateWorkerDTO {
  name: string;
  phone: string;
  assignedZones?: string[];
}

export interface UpdateWorkerDTO {
  name?: string;
  phone?: string;
  assignedZones?: string[];
  isActive?: boolean;
  fcmToken?: string;
}

// ============================================
// Worker Management Service Implementation
// ============================================

class WorkerService {
  /**
   * Create a new worker
   * Requirements: 11.1
   */
  async createWorker(data: CreateWorkerDTO): Promise<Worker> {
    const { name, phone, assignedZones = [] } = data;

    // Check if phone already exists
    const existing = await pool.query(
      `SELECT id FROM workers WHERE phone = $1`,
      [phone]
    );

    if (existing.rows.length > 0) {
      throw new Error('Worker with this phone number already exists');
    }

    const result = await pool.query(
      `INSERT INTO workers (name, phone, assigned_zones, is_active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING id, name, phone, assigned_zones, created_at, is_active, fcm_token`,
      [name, phone, JSON.stringify(assignedZones)]
    );

    const row = result.rows[0];
    logger.info({ workerId: row.id, name, phone }, 'Worker created');

    return this.mapRowToWorker(row);
  }

  /**
   * Get worker by ID
   */
  async getWorkerById(workerId: string): Promise<Worker | null> {
    const result = await pool.query(
      `SELECT id, name, phone, assigned_zones, created_at, is_active, fcm_token
       FROM workers WHERE id = $1`,
      [workerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorker(result.rows[0]);
  }

  /**
   * Get worker by phone number
   */
  async getWorkerByPhone(phone: string): Promise<Worker | null> {
    const result = await pool.query(
      `SELECT id, name, phone, assigned_zones, created_at, is_active, fcm_token
       FROM workers WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToWorker(result.rows[0]);
  }

  /**
   * Get all workers with optional filters
   * Requirements: 11.1
   */
  async getAllWorkers(options?: {
    isActive?: boolean;
    zone?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ workers: Worker[]; total: number }> {
    const { isActive, zone, limit = 50, offset = 0 } = options || {};

    let query = `SELECT id, name, phone, assigned_zones, created_at, is_active, fcm_token FROM workers WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM workers WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      countQuery += ` AND is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    if (zone) {
      query += ` AND assigned_zones @> $${paramIndex}::jsonb`;
      countQuery += ` AND assigned_zones @> $${paramIndex}::jsonb`;
      params.push(JSON.stringify([zone]));
      paramIndex++;
    }

    // Get total count
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const workers = result.rows.map(this.mapRowToWorker);

    return { workers, total };
  }

  /**
   * Update worker details
   * Requirements: 11.2
   */
  async updateWorker(workerId: string, data: UpdateWorkerDTO): Promise<Worker | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(data.name);
      paramIndex++;
    }

    if (data.phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(data.phone);
      paramIndex++;
    }

    if (data.assignedZones !== undefined) {
      updates.push(`assigned_zones = $${paramIndex}`);
      params.push(JSON.stringify(data.assignedZones));
      paramIndex++;
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(data.isActive);
      paramIndex++;
    }

    if (data.fcmToken !== undefined) {
      updates.push(`fcm_token = $${paramIndex}`);
      params.push(data.fcmToken);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getWorkerById(workerId);
    }

    params.push(workerId);
    const query = `
      UPDATE workers 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, phone, assigned_zones, created_at, is_active, fcm_token
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    logger.info({ workerId, updates: Object.keys(data) }, 'Worker updated');
    return this.mapRowToWorker(result.rows[0]);
  }

  /**
   * Delete worker (soft delete by setting is_active = false)
   */
  async deleteWorker(workerId: string): Promise<boolean> {
    const result = await pool.query(
      `UPDATE workers SET is_active = false WHERE id = $1 RETURNING id`,
      [workerId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    logger.info({ workerId }, 'Worker deactivated');
    return true;
  }

  /**
   * Assign zones to a worker
   * Requirements: 11.2
   * Property 31: Zone assignment persistence
   */
  async assignZones(workerId: string, zones: string[]): Promise<Worker | null> {
    const result = await pool.query(
      `UPDATE workers 
       SET assigned_zones = $1
       WHERE id = $2
       RETURNING id, name, phone, assigned_zones, created_at, is_active, fcm_token`,
      [JSON.stringify(zones), workerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    logger.info({ workerId, zones }, 'Zones assigned to worker');
    return this.mapRowToWorker(result.rows[0]);
  }

  /**
   * Add zones to a worker (append to existing)
   */
  async addZones(workerId: string, newZones: string[]): Promise<Worker | null> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) {
      return null;
    }

    const existingZones = worker.assignedZones || [];
    const uniqueZones = [...new Set([...existingZones, ...newZones])];

    return this.assignZones(workerId, uniqueZones);
  }

  /**
   * Remove zones from a worker
   */
  async removeZones(workerId: string, zonesToRemove: string[]): Promise<Worker | null> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) {
      return null;
    }

    const remainingZones = (worker.assignedZones || []).filter(
      (zone) => !zonesToRemove.includes(zone)
    );

    return this.assignZones(workerId, remainingZones);
  }


  /**
   * Get worker stats
   * Requirements: 11.1
   * Property 30: Worker stats accuracy
   * - tasksCompleted: count of resolved tasks
   * - activeTasksCount: count of in_progress tasks
   * - assignedZones: current zone assignments
   */
  async getWorkerStats(workerId: string): Promise<WorkerStats | null> {
    // Get worker basic info
    const workerResult = await pool.query(
      `SELECT id, name, phone, assigned_zones, is_active, fcm_token
       FROM workers WHERE id = $1`,
      [workerId]
    );

    if (workerResult.rows.length === 0) {
      return null;
    }

    const worker = workerResult.rows[0];

    // Get task counts
    const taskCountsResult = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'resolved') as tasks_completed,
         COUNT(*) FILTER (WHERE status = 'in_progress') as active_tasks
       FROM reports WHERE worker_id = $1`,
      [workerId]
    );

    const taskCounts = taskCountsResult.rows[0];

    // Get verification stats
    const verificationResult = await pool.query(
      `SELECT 
         COUNT(*) as total_verifications,
         COUNT(*) FILTER (WHERE approval_status = 'approved') as approved,
         COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected,
         AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_resolution_hours
       FROM verifications WHERE worker_id = $1`,
      [workerId]
    );

    const verificationStats = verificationResult.rows[0];

    // Get last activity
    const lastActivityResult = await pool.query(
      `SELECT MAX(completed_at) as last_active
       FROM verifications WHERE worker_id = $1`,
      [workerId]
    );

    const lastActive = lastActivityResult.rows[0]?.last_active || null;

    const totalVerifications = parseInt(verificationStats.total_verifications, 10) || 0;
    const approvedVerifications = parseInt(verificationStats.approved, 10) || 0;
    const rejectedVerifications = parseInt(verificationStats.rejected, 10) || 0;

    // Calculate efficiency (approval rate)
    const efficiency = totalVerifications > 0
      ? (approvedVerifications / totalVerifications) * 100
      : 0;

    return {
      workerId: worker.id,
      name: worker.name,
      phone: worker.phone,
      assignedZones: worker.assigned_zones || [],
      isActive: worker.is_active,
      tasksCompleted: parseInt(taskCounts.tasks_completed, 10) || 0,
      activeTasksCount: parseInt(taskCounts.active_tasks, 10) || 0,
      avgResolutionTime: parseFloat(verificationStats.avg_resolution_hours) || 0,
      totalVerifications,
      approvedVerifications,
      rejectedVerifications,
      efficiency: Math.round(efficiency * 100) / 100,
      lastActive: lastActive ? new Date(lastActive) : null
    };
  }

  /**
   * Get all workers with stats
   * Requirements: 11.1
   */
  async getAllWorkersWithStats(options?: {
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ workers: WorkerStats[]; total: number }> {
    const { isActive, limit = 50, offset = 0 } = options || {};

    let whereClause = '1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (isActive !== undefined) {
      whereClause += ` AND w.is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    // Complex query to get all stats in one go
    const query = `
      SELECT 
        w.id as worker_id,
        w.name,
        w.phone,
        w.assigned_zones,
        w.is_active,
        COALESCE(r_stats.tasks_completed, 0) as tasks_completed,
        COALESCE(r_stats.active_tasks, 0) as active_tasks,
        COALESCE(v_stats.total_verifications, 0) as total_verifications,
        COALESCE(v_stats.approved, 0) as approved_verifications,
        COALESCE(v_stats.rejected, 0) as rejected_verifications,
        COALESCE(v_stats.avg_resolution_hours, 0) as avg_resolution_time,
        v_stats.last_active
      FROM workers w
      LEFT JOIN (
        SELECT 
          worker_id,
          COUNT(*) FILTER (WHERE status = 'resolved') as tasks_completed,
          COUNT(*) FILTER (WHERE status = 'in_progress') as active_tasks
        FROM reports
        GROUP BY worker_id
      ) r_stats ON w.id = r_stats.worker_id
      LEFT JOIN (
        SELECT 
          worker_id,
          COUNT(*) as total_verifications,
          COUNT(*) FILTER (WHERE approval_status = 'approved') as approved,
          COUNT(*) FILTER (WHERE approval_status = 'rejected') as rejected,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_resolution_hours,
          MAX(completed_at) as last_active
        FROM verifications
        GROUP BY worker_id
      ) v_stats ON w.id = v_stats.worker_id
      WHERE ${whereClause}
      ORDER BY tasks_completed DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM workers w WHERE ${whereClause}`;
    const countParams = params.slice(0, paramIndex - 1);
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(query, params);

    const workers: WorkerStats[] = result.rows.map((row) => {
      const totalVerifications = parseInt(row.total_verifications, 10) || 0;
      const approvedVerifications = parseInt(row.approved_verifications, 10) || 0;
      const efficiency = totalVerifications > 0
        ? (approvedVerifications / totalVerifications) * 100
        : 0;

      return {
        workerId: row.worker_id,
        name: row.name,
        phone: row.phone,
        assignedZones: row.assigned_zones || [],
        isActive: row.is_active,
        tasksCompleted: parseInt(row.tasks_completed, 10) || 0,
        activeTasksCount: parseInt(row.active_tasks, 10) || 0,
        avgResolutionTime: parseFloat(row.avg_resolution_time) || 0,
        totalVerifications,
        approvedVerifications,
        rejectedVerifications: parseInt(row.rejected_verifications, 10) || 0,
        efficiency: Math.round(efficiency * 100) / 100,
        lastActive: row.last_active ? new Date(row.last_active) : null
      };
    });

    return { workers, total };
  }

  /**
   * Get worker performance metrics (daily, weekly, monthly)
   * Requirements: 11.4
   */
  async getWorkerPerformance(workerId: string): Promise<WorkerPerformance | null> {
    const worker = await this.getWorkerById(workerId);
    if (!worker) {
      return null;
    }

    const [daily, weekly, monthly] = await Promise.all([
      this.getPerformanceMetrics(workerId, 1),
      this.getPerformanceMetrics(workerId, 7),
      this.getPerformanceMetrics(workerId, 30)
    ]);

    return {
      workerId,
      name: worker.name,
      daily,
      weekly,
      monthly
    };
  }

  /**
   * Get performance metrics for a specific time period
   */
  private async getPerformanceMetrics(workerId: string, days: number): Promise<PerformanceMetrics> {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as tasks_completed,
         AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_resolution_hours,
         COUNT(*) FILTER (WHERE approval_status = 'approved') as approved,
         COUNT(*) as total
       FROM verifications 
       WHERE worker_id = $1 
         AND completed_at >= NOW() - INTERVAL '${days} days'`,
      [workerId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total, 10) || 0;
    const approved = parseInt(row.approved, 10) || 0;

    return {
      tasksCompleted: parseInt(row.tasks_completed, 10) || 0,
      avgResolutionTime: parseFloat(row.avg_resolution_hours) || 0,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
    };
  }

  /**
   * Get worker's active tasks
   * Requirements: 11.3
   */
  async getWorkerActiveTasks(workerId: string): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
         r.id,
         r.photo_url,
         r.latitude,
         r.longitude,
         r.severity,
         r.waste_types,
         r.status,
         r.created_at,
         r.assigned_at,
         r.in_progress_at
       FROM reports r
       WHERE r.worker_id = $1 
         AND r.status IN ('assigned', 'in_progress')
       ORDER BY r.assigned_at DESC`,
      [workerId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      photoUrl: row.photo_url,
      location: {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude)
      },
      severity: row.severity,
      wasteTypes: row.waste_types || [],
      status: row.status,
      createdAt: row.created_at,
      assignedAt: row.assigned_at,
      inProgressAt: row.in_progress_at
    }));
  }

  /**
   * Map database row to Worker object
   */
  private mapRowToWorker(row: any): Worker {
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      assignedZones: row.assigned_zones || [],
      createdAt: new Date(row.created_at),
      isActive: row.is_active,
      fcmToken: row.fcm_token || undefined
    };
  }
}

// ============================================
// Pure Logic Functions for Property Testing
// ============================================

/**
 * Calculate worker stats from raw data
 * Property 30: Worker stats accuracy
 */
export function calculateWorkerStats(
  worker: { id: string; name: string; phone: string; assignedZones: string[]; isActive: boolean },
  reports: Array<{ workerId: string; status: string }>,
  verifications: Array<{
    workerId: string;
    approvalStatus: string;
    startedAt: Date;
    completedAt: Date;
  }>
): WorkerStats {
  // Filter reports for this worker
  const workerReports = reports.filter((r) => r.workerId === worker.id);
  const tasksCompleted = workerReports.filter((r) => r.status === 'resolved').length;
  const activeTasksCount = workerReports.filter((r) => r.status === 'in_progress').length;

  // Filter verifications for this worker
  const workerVerifications = verifications.filter((v) => v.workerId === worker.id);
  const totalVerifications = workerVerifications.length;
  const approvedVerifications = workerVerifications.filter((v) => v.approvalStatus === 'approved').length;
  const rejectedVerifications = workerVerifications.filter((v) => v.approvalStatus === 'rejected').length;

  // Calculate average resolution time
  let avgResolutionTime = 0;
  if (workerVerifications.length > 0) {
    const totalHours = workerVerifications.reduce((sum, v) => {
      const hours = (v.completedAt.getTime() - v.startedAt.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);
    avgResolutionTime = totalHours / workerVerifications.length;
  }

  // Calculate efficiency
  const efficiency = totalVerifications > 0
    ? (approvedVerifications / totalVerifications) * 100
    : 0;

  // Get last active
  let lastActive: Date | null = null;
  if (workerVerifications.length > 0) {
    lastActive = workerVerifications.reduce((latest, v) => {
      return v.completedAt > latest ? v.completedAt : latest;
    }, workerVerifications[0].completedAt);
  }

  return {
    workerId: worker.id,
    name: worker.name,
    phone: worker.phone,
    assignedZones: worker.assignedZones,
    isActive: worker.isActive,
    tasksCompleted,
    activeTasksCount,
    avgResolutionTime,
    totalVerifications,
    approvedVerifications,
    rejectedVerifications,
    efficiency: Math.round(efficiency * 100) / 100,
    lastActive
  };
}

/**
 * Validate zone assignment
 * Property 31: Zone assignment persistence
 */
export function validateZoneAssignment(
  assignedZones: string[],
  expectedZones: string[]
): boolean {
  if (assignedZones.length !== expectedZones.length) {
    return false;
  }

  const sortedAssigned = [...assignedZones].sort();
  const sortedExpected = [...expectedZones].sort();

  return sortedAssigned.every((zone, index) => zone === sortedExpected[index]);
}

/**
 * Merge zones (for add operation)
 */
export function mergeZones(existingZones: string[], newZones: string[]): string[] {
  return [...new Set([...existingZones, ...newZones])];
}

/**
 * Remove zones (for remove operation)
 */
export function removeZonesFromList(existingZones: string[], zonesToRemove: string[]): string[] {
  return existingZones.filter((zone) => !zonesToRemove.includes(zone));
}

// Export singleton instance
export const workerService = new WorkerService();
export default workerService;
