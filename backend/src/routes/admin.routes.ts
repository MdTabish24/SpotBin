/**
 * Admin Routes - API endpoints for admin dashboard
 * Requirements: 9.4, 9.5
 */

import { Router, Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { adminService, AdminReportFilters } from '../services/admin.service';
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

export default router;
