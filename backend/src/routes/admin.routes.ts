/**
 * Admin Routes - API endpoints for admin dashboard
 * Requirements: 9.4, 9.5, 10.1, 10.2, 10.3, 10.4
 */

import { Router, Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { adminService, AdminReportFilters } from '../services/admin.service';
import { approvalService } from '../services/approval.service';
import { workerService } from '../services/worker.service';
import { notificationService } from '../services/notification.service';
import { analyticsService } from '../services/analytics.service';
import { logger } from '../config/logger';
import { ApiError, ReportStatus, Severity } from '../types';

const router = Router();

// Note: In production, these routes should be protected by admin authentication middleware
// For now, we'll implement the endpoints and add auth later

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for filtering stats
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for filtering stats
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalReports:
 *                   type: number
 *                 openReports:
 *                   type: number
 *                 inProgressReports:
 *                   type: number
 *                 resolvedToday:
 *                   type: number
 *                 avgResolutionTime:
 *                   type: number
 *                 topContributors:
 *                   type: array
 *                 areaWiseBreakdown:
 *                   type: array
 */
router.get(
  '/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await dashboardService.getDashboardStats(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: Get filtered reports with pagination
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *         description: Filter by area name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, assigned, in_progress, verified, resolved]
 *         description: Filter by report status
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by severity
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated list of reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reports:
 *                   type: array
 *                 totalCount:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *                 currentPage:
 *                   type: number
 *                 hasNextPage:
 *                   type: boolean
 *                 hasPrevPage:
 *                   type: boolean
 */
router.get(
  '/reports',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        startDate,
        endDate,
        area,
        status,
        severity,
        page,
        limit
      } = req.query;

      // Validate status if provided
      if (status && !Object.values(ReportStatus).includes(status as ReportStatus)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid status. Must be one of: ${Object.values(ReportStatus).join(', ')}`,
            field: 'status'
          }
        };
        return res.status(400).json(error);
      }

      // Validate severity if provided
      if (severity && !Object.values(Severity).includes(severity as Severity)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid severity. Must be one of: ${Object.values(Severity).join(', ')}`,
            field: 'severity'
          }
        };
        return res.status(400).json(error);
      }

      const filters: AdminReportFilters = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        area: area as string | undefined,
        status: status as ReportStatus | undefined,
        severity: severity as Severity | undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50
      };

      const result = await adminService.getFilteredReports(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/reports/{reportId}:
 *   get:
 *     summary: Get a single report by ID with full details
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report details
 *       404:
 *         description: Report not found
 */
router.get(
  '/reports/:reportId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const report = await adminService.getReportById(reportId);

      if (!report) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Report not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/stats/summary:
 *   get:
 *     summary: Get quick summary stats (lightweight endpoint)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Summary statistics
 */
router.get(
  '/stats/summary',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [totalReports, openReports, resolvedToday] = await Promise.all([
        dashboardService.getTotalReports(),
        dashboardService.getOpenReports(),
        dashboardService.getResolvedToday()
      ]);

      res.json({
        totalReports,
        openReports,
        resolvedToday,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/stats/areas:
 *   get:
 *     summary: Get area-wise breakdown
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Area-wise statistics
 */
router.get(
  '/stats/areas',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const areaBreakdown = await dashboardService.getAreaWiseBreakdown();
      res.json({ areas: areaBreakdown });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/stats/contributors:
 *   get:
 *     summary: Get top contributors
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top contributors to return
 *     responses:
 *       200:
 *         description: Top contributors list
 */
router.get(
  '/stats/contributors',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const contributors = await dashboardService.getTopContributors(limit);
      res.json({ contributors });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Approval Workflow Endpoints
// Requirements: 10.1, 10.2, 10.3, 10.4
// ============================================

/**
 * @swagger
 * /api/v1/admin/verifications/pending:
 *   get:
 *     summary: Get pending verifications for admin review
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of verifications to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of pending verifications
 */
router.get(
  '/verifications/pending',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const verifications = await approvalService.getPendingVerifications(limit, offset);
      res.json({ verifications, count: verifications.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/verifications/{verificationId}:
 *   get:
 *     summary: Get a single verification by ID
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Verification details
 *       404:
 *         description: Verification not found
 */
router.get(
  '/verifications/:verificationId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verificationId } = req.params;
      const verification = await approvalService.getVerificationById(verificationId);

      if (!verification) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Verification not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(verification);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/verifications/{verificationId}/approve:
 *   post:
 *     summary: Approve a verification
 *     description: Approves the verification, changes report status to resolved, and credits points to citizen
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Verification approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reportId:
 *                   type: string
 *                 verificationId:
 *                   type: string
 *                 pointsAwarded:
 *                   type: number
 *                 newStatus:
 *                   type: string
 *       400:
 *         description: Invalid request or verification already processed
 *       404:
 *         description: Verification not found
 */
router.post(
  '/verifications/:verificationId/approve',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verificationId } = req.params;
      // In production, adminId would come from JWT token
      const adminId = req.body.adminId || 'admin';

      const result = await approvalService.approveVerification(verificationId, adminId);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 400;
        const error: ApiError = {
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
            message: result.error || 'Failed to approve verification'
          }
        };
        return res.status(statusCode).json(error);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/verifications/{verificationId}/reject:
 *   post:
 *     summary: Reject a verification
 *     description: Rejects the verification and returns the task to the worker queue
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *     responses:
 *       200:
 *         description: Verification rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reportId:
 *                   type: string
 *                 verificationId:
 *                   type: string
 *                 newStatus:
 *                   type: string
 *       400:
 *         description: Invalid request or verification already processed
 *       404:
 *         description: Verification not found
 */
router.post(
  '/verifications/:verificationId/reject',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { verificationId } = req.params;
      const { reason } = req.body;
      // In production, adminId would come from JWT token
      const adminId = req.body.adminId || 'admin';

      const result = await approvalService.rejectVerification(verificationId, reason, adminId);

      if (!result.success) {
        const statusCode = result.error?.includes('not found') ? 404 : 400;
        const error: ApiError = {
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
            message: result.error || 'Failed to reject verification'
          }
        };
        return res.status(statusCode).json(error);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/verifications/stats:
 *   get:
 *     summary: Get approval workflow statistics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Approval statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pendingCount:
 *                   type: number
 *                 approvedToday:
 *                   type: number
 *                 rejectedToday:
 *                   type: number
 *                 avgApprovalTime:
 *                   type: number
 */
router.get(
  '/verifications/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await approvalService.getApprovalStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Worker Management Endpoints
// Requirements: 11.1, 11.2, 11.3
// ============================================

/**
 * @swagger
 * /api/v1/admin/workers:
 *   get:
 *     summary: Get all workers with stats
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of workers to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: List of workers with stats
 */
router.get(
  '/workers',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { isActive, limit, offset } = req.query;

      const result = await workerService.getAllWorkersWithStats({
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers:
 *   post:
 *     summary: Create a new worker
 *     tags: [Admin - Workers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               assignedZones:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Worker created successfully
 *       400:
 *         description: Validation error or phone already exists
 */
router.post(
  '/workers',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, phone, assignedZones } = req.body;

      if (!name || !phone) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Name and phone are required'
          }
        };
        return res.status(400).json(error);
      }

      const worker = await workerService.createWorker({ name, phone, assignedZones });
      res.status(201).json(worker);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        const apiError: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        };
        return res.status(400).json(apiError);
      }
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}:
 *   get:
 *     summary: Get worker by ID with stats
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Worker details with stats
 *       404:
 *         description: Worker not found
 */
router.get(
  '/workers/:workerId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const stats = await workerService.getWorkerStats(workerId);

      if (!stats) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}:
 *   put:
 *     summary: Update worker details
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               assignedZones:
 *                 type: array
 *                 items:
 *                   type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Worker updated successfully
 *       404:
 *         description: Worker not found
 */
router.put(
  '/workers/:workerId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const { name, phone, assignedZones, isActive } = req.body;

      const worker = await workerService.updateWorker(workerId, {
        name,
        phone,
        assignedZones,
        isActive
      });

      if (!worker) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(worker);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}:
 *   delete:
 *     summary: Deactivate a worker (soft delete)
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Worker deactivated successfully
 *       404:
 *         description: Worker not found
 */
router.delete(
  '/workers/:workerId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const success = await workerService.deleteWorker(workerId);

      if (!success) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json({ success: true, message: 'Worker deactivated' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/zones:
 *   put:
 *     summary: Assign zones to a worker (replaces existing zones)
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zones
 *             properties:
 *               zones:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Zones assigned successfully
 *       404:
 *         description: Worker not found
 */
router.put(
  '/workers/:workerId/zones',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const { zones } = req.body;

      if (!Array.isArray(zones)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Zones must be an array'
          }
        };
        return res.status(400).json(error);
      }

      const worker = await workerService.assignZones(workerId, zones);

      if (!worker) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(worker);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/zones/add:
 *   post:
 *     summary: Add zones to a worker (appends to existing)
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zones
 *             properties:
 *               zones:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Zones added successfully
 *       404:
 *         description: Worker not found
 */
router.post(
  '/workers/:workerId/zones/add',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const { zones } = req.body;

      if (!Array.isArray(zones)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Zones must be an array'
          }
        };
        return res.status(400).json(error);
      }

      const worker = await workerService.addZones(workerId, zones);

      if (!worker) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(worker);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/zones/remove:
 *   post:
 *     summary: Remove zones from a worker
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zones
 *             properties:
 *               zones:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Zones removed successfully
 *       404:
 *         description: Worker not found
 */
router.post(
  '/workers/:workerId/zones/remove',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const { zones } = req.body;

      if (!Array.isArray(zones)) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Zones must be an array'
          }
        };
        return res.status(400).json(error);
      }

      const worker = await workerService.removeZones(workerId, zones);

      if (!worker) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(worker);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/performance:
 *   get:
 *     summary: Get worker performance metrics (daily, weekly, monthly)
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Worker performance metrics
 *       404:
 *         description: Worker not found
 */
router.get(
  '/workers/:workerId/performance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const performance = await workerService.getWorkerPerformance(workerId);

      if (!performance) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json(performance);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/tasks:
 *   get:
 *     summary: Get worker's active tasks
 *     tags: [Admin - Workers]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Worker's active tasks
 *       404:
 *         description: Worker not found
 */
router.get(
  '/workers/:workerId/tasks',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;

      // Check if worker exists
      const worker = await workerService.getWorkerById(workerId);
      if (!worker) {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      const tasks = await workerService.getWorkerActiveTasks(workerId);
      res.json({ tasks, count: tasks.length });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Notification Endpoints
// Requirements: 5.3, 11.5
// ============================================

/**
 * @swagger
 * /api/v1/admin/workers/{workerId}/notify:
 *   post:
 *     summary: Send notification to a worker
 *     tags: [Admin - Notifications]
 *     parameters:
 *       - in: path
 *         name: workerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: Message to send to worker
 *               priority:
 *                 type: string
 *                 enum: [low, high]
 *                 default: low
 *     responses:
 *       200:
 *         description: Notification sent/queued successfully
 *       404:
 *         description: Worker not found
 */
router.post(
  '/workers/:workerId/notify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerId } = req.params;
      const { message, priority = 'low' } = req.body;

      if (!message || typeof message !== 'string') {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required'
          }
        };
        return res.status(400).json(error);
      }

      const result = await notificationService.notifyWorker(
        workerId,
        message,
        priority as 'low' | 'high'
      );

      if (result.error === 'Worker not found') {
        const error: ApiError = {
          error: {
            code: 'NOT_FOUND',
            message: 'Worker not found'
          }
        };
        return res.status(404).json(error);
      }

      res.json({
        success: result.success,
        queued: result.queued,
        notificationId: result.notificationId,
        message: result.success
          ? 'Notification sent successfully'
          : result.queued
          ? 'Notification queued (worker has no FCM token)'
          : 'Failed to send notification'
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/notifications/broadcast:
 *   post:
 *     summary: Send notification to multiple workers
 *     tags: [Admin - Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workerIds
 *               - message
 *             properties:
 *               workerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               message:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, high]
 *                 default: low
 *     responses:
 *       200:
 *         description: Broadcast result
 */
router.post(
  '/notifications/broadcast',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workerIds, message, priority = 'low' } = req.body;

      if (!Array.isArray(workerIds) || workerIds.length === 0) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'workerIds must be a non-empty array'
          }
        };
        return res.status(400).json(error);
      }

      if (!message || typeof message !== 'string') {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Message is required'
          }
        };
        return res.status(400).json(error);
      }

      const result = await notificationService.notifyMultipleWorkers(
        workerIds,
        message,
        priority as 'low' | 'high'
      );

      res.json({
        ...result,
        totalWorkers: workerIds.length
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Admin - Notifications]
 *     responses:
 *       200:
 *         description: Notification statistics
 */
router.get(
  '/notifications/stats',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await notificationService.getNotificationStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// Analytics Endpoints
// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
// ============================================

/**
 * @swagger
 * /api/v1/admin/analytics:
 *   get:
 *     summary: Generate analytics report for a date range
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics
 *     responses:
 *       200:
 *         description: Analytics report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 period:
 *                   type: object
 *                   properties:
 *                     startDate:
 *                       type: string
 *                     endDate:
 *                       type: string
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalReports:
 *                       type: number
 *                     resolvedReports:
 *                       type: number
 *                     avgResolutionTime:
 *                       type: number
 *                     citizenParticipation:
 *                       type: number
 *                     wasteCollected:
 *                       type: number
 *                 trends:
 *                   type: object
 *                   properties:
 *                     reportsTrend:
 *                       type: number
 *                     resolutionTrend:
 *                       type: number
 *                     participationTrend:
 *                       type: number
 *                 charts:
 *                   type: object
 *                   properties:
 *                     dailyReports:
 *                       type: array
 *                     areaWise:
 *                       type: array
 *                     wasteTypes:
 *                       type: array
 *       400:
 *         description: Invalid date range
 */
router.get(
  '/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format'
          }
        };
        return res.status(400).json(error);
      }

      if (start > end) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate must be before endDate'
          }
        };
        return res.status(400).json(error);
      }

      const report = await analyticsService.generateReport(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/analytics/summary:
 *   get:
 *     summary: Get analytics summary for a date range
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Analytics summary
 */
router.get(
  '/analytics/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const summary = await analyticsService.getSummary(start, end);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/analytics/trends:
 *   get:
 *     summary: Get analytics trends compared to previous period
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Analytics trends
 */
router.get(
  '/analytics/trends',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const trends = await analyticsService.getTrends(start, end);
      res.json(trends);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/analytics/charts/daily:
 *   get:
 *     summary: Get daily reports chart data
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Daily reports data
 */
router.get(
  '/analytics/charts/daily',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const dailyReports = await analyticsService.getDailyReports(start, end);
      res.json({ dailyReports });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/analytics/charts/areas:
 *   get:
 *     summary: Get area-wise breakdown chart data
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Area-wise breakdown data
 */
router.get(
  '/analytics/charts/areas',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const areaWise = await analyticsService.getAreaWiseBreakdown(start, end);
      res.json({ areaWise });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/analytics/charts/waste-types:
 *   get:
 *     summary: Get waste type distribution chart data
 *     tags: [Admin - Analytics]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Waste type distribution data
 */
router.get(
  '/analytics/charts/waste-types',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      const wasteTypes = await analyticsService.getWasteTypeDistribution(start, end);
      res.json({ wasteTypes });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/export/pdf:
 *   get:
 *     summary: Export analytics report as PDF
 *     tags: [Admin - Export]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/export/pdf',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Generate report
      const report = await analyticsService.generateReport(start, end);

      // Export to PDF
      const pdfBuffer = await analyticsService.exportToPDF(report);

      // Set headers for PDF download
      const filename = `cleancity-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/admin/export/excel:
 *   get:
 *     summary: Export analytics report as Excel
 *     tags: [Admin - Export]
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Excel file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/export/excel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required'
          }
        };
        return res.status(400).json(error);
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Generate report
      const report = await analyticsService.generateReport(start, end);

      // Export to Excel
      const excelBuffer = await analyticsService.exportToExcel(report);

      // Set headers for Excel download
      const filename = `cleancity-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      res.send(excelBuffer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
