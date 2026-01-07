/**
 * Citizen Routes - API endpoints for citizen stats and leaderboard
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pointsService } from '../services/points.service';
import { logger } from '../config/logger';
import { ApiError } from '../types';

const router = Router();

/**
 * @swagger
 * /api/v1/citizens/stats:
 *   get:
 *     summary: Get user stats by device ID
 *     tags: [Citizens]
 *     parameters:
 *       - in: header
 *         name: X-Device-ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User statistics
 *       400:
 *         description: Device ID required
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = req.headers['x-device-id'] as string;

    if (!deviceId) {
      const error: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'X-Device-ID header is required'
        }
      };
      return res.status(400).json(error);
    }

    const stats = await pointsService.getUserStats(deviceId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/leaderboard:
 *   get:
 *     summary: Get leaderboard
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [city, area]
 *           default: city
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard entries
 */
export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = (req.query.scope as 'city' | 'area') || 'city';
    const area = req.query.area as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const leaderboard = await pointsService.getLeaderboard(scope, area, limit);
    res.json({ leaderboard });
  } catch (error) {
    next(error);
  }
};

export default router;
