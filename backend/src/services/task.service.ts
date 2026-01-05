/**
 * Task Service - Worker Task Management
 * Requirements: 7.1, 7.2, 7.4, 7.6
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import { Task, ReportStatus, Severity, GeoLocation } from '../types';
import { calculateDistance } from '../utils/validation';

// ============================================
// Priority Calculation
// ============================================

/**
 * Severity weights for priority calculation
 * Property 20: Task sorting by priority = severity_weight + age_in_hours
 */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  [Severity.HIGH]: 100,
  [Severity.MEDIUM]: 50,
  [Severity.LOW]: 10
};

/**
 * Calculate task priority
 * Priority = severity_weight + age_in_hours
 * Higher priority = more urgent
 */
export function calculateTaskPriority(severity: Severity | undefined, reportedAt: Date): number {
  const severityWeight = severity ? SEVERITY_WEIGHTS[severity] : SEVERITY_WEIGHTS[Severity.LOW];
  const ageInHours = (Date.now() - reportedAt.getTime()) / (1000 * 60 * 60);
  return severityWeight + ageInHours;
}

/**
 * Calculate estimated time based on severity
 */
export function calculateEstimatedTime(severity: Severity | undefined): number {
  switch (severity) {
    case Severity.HIGH:
      return 60; // 60 minutes
    case Severity.MEDIUM:
      return 30; // 30 minutes
    case Severity.LOW:
    default:
      return 15; // 15 minutes
  }
}

// ============================================
// Task Service Interface
// ============================================

export interface ITaskService {
  getWorkerTasks(workerId: string, workerLocation?: GeoLocation, status?: ReportStatus): Promise<Task[]>;
  assignTask(reportId: string, workerId: string): Promise<void>;
  getTasksForZones(zones: string[], workerLocation?: GeoLocation, status?: ReportStatus): Promise<Task[]>;
}

// ============================================
// Task Service Implementation
// ============================================

class TaskService implements ITaskService {
  /**
   * Get tasks for a worker by their assigned zones
   * Requirements: 7.1, 7.2, 7.4
   * Property 20: Tasks sorted by priority (severity_weight + age_in_hours)
   * Property 21: Tasks filtered by status
   */
  async getWorkerTasks(
    workerId: string,
    workerLocation?: GeoLocation,
    status?: ReportStatus
  ): Promise<Task[]> {
    // Get worker's assigned zones
    const workerResult = await pool.query(
      `SELECT assigned_zones FROM workers WHERE id = $1`,
      [workerId]
    );

    if (workerResult.rows.length === 0) {
      logger.warn({ workerId }, 'Worker not found');
      return [];
    }

    const zones: string[] = workerResult.rows[0].assigned_zones || [];
    
    if (zones.length === 0) {
      logger.info({ workerId }, 'Worker has no assigned zones');
      return [];
    }

    return this.getTasksForZones(zones, workerLocation, status);
  }

  /**
   * Get tasks for specific zones
   * Property 20: Sorted by priority
   * Property 21: Filtered by status
   * Property 22: Complete task data structure
   */
  async getTasksForZones(
    zones: string[],
    workerLocation?: GeoLocation,
    status?: ReportStatus
  ): Promise<Task[]> {
    // Build query with optional status filter
    let query = `
      SELECT 
        r.id as report_id,
        r.latitude,
        r.longitude,
        r.location_accuracy,
        r.severity,
        r.waste_types,
        r.created_at,
        r.status,
        r.photo_url,
        r.description
      FROM reports r
      WHERE r.status IN ('open', 'assigned', 'in_progress')
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by status if provided
    if (status) {
      query += ` AND r.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Note: In a real implementation, we'd filter by zones using geospatial queries
    // For now, we return all tasks (zones would be matched via area/city fields)

    query += ` ORDER BY r.created_at ASC`; // Initial order, will re-sort by priority

    const result = await pool.query(query, params);

    // Map to Task objects and calculate priority
    const tasks: Task[] = result.rows.map((row) => {
      const location: GeoLocation = {
        lat: parseFloat(row.latitude),
        lng: parseFloat(row.longitude),
        accuracy: row.location_accuracy ? parseFloat(row.location_accuracy) : 0
      };

      const severity = row.severity as Severity | undefined;
      const reportedAt = new Date(row.created_at);

      // Calculate distance from worker if location provided
      const distance = workerLocation
        ? calculateDistance(workerLocation.lat, workerLocation.lng, location.lat, location.lng)
        : 0;

      return {
        reportId: row.report_id,
        location,
        severity: severity || Severity.LOW,
        wasteTypes: row.waste_types || [],
        reportedAt,
        distance,
        estimatedTime: calculateEstimatedTime(severity),
        status: row.status as ReportStatus,
        photoUrl: row.photo_url,
        description: row.description || undefined
      };
    });

    // Sort by priority (Property 20)
    // Higher priority first (higher severity weight + older age)
    return this.sortTasksByPriority(tasks);
  }

  /**
   * Sort tasks by priority
   * Property 20: priority = severity_weight + age_in_hours
   * Higher severity and older tasks appear first
   */
  sortTasksByPriority(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      const priorityA = calculateTaskPriority(a.severity, a.reportedAt);
      const priorityB = calculateTaskPriority(b.severity, b.reportedAt);
      return priorityB - priorityA; // Descending order (higher priority first)
    });
  }

  /**
   * Filter tasks by status
   * Property 21: Returns only tasks matching the specified status
   */
  filterTasksByStatus(tasks: Task[], status: ReportStatus): Task[] {
    return tasks.filter((task) => task.status === status);
  }

  /**
   * Assign a task (report) to a worker
   * Requirements: 5.5
   */
  async assignTask(reportId: string, workerId: string): Promise<void> {
    await pool.query(
      `UPDATE reports 
       SET status = $1, worker_id = $2, assigned_at = NOW()
       WHERE id = $3`,
      [ReportStatus.ASSIGNED, workerId, reportId]
    );

    logger.info({ reportId, workerId }, 'Task assigned to worker');
  }

  /**
   * Validate task data structure completeness
   * Property 22: Task must contain all required fields
   */
  validateTaskStructure(task: Task): boolean {
    return (
      typeof task.reportId === 'string' &&
      task.reportId.length > 0 &&
      typeof task.location === 'object' &&
      typeof task.location.lat === 'number' &&
      typeof task.location.lng === 'number' &&
      typeof task.severity === 'string' &&
      Array.isArray(task.wasteTypes) &&
      task.reportedAt instanceof Date &&
      typeof task.distance === 'number' &&
      typeof task.estimatedTime === 'number'
    );
  }
}

// Export singleton instance
export const taskService = new TaskService();

// Export functions for testing
export { calculateTaskPriority as calculatePriority };
export default taskService;
