/**
 * Report Routes - API endpoints for waste reports
 * Requirements: 1.7, 5.1
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { reportService } from '../services/report.service';
import { abusePreventionService } from '../services/abuse-prevention.service';
import { imageService } from '../services/image.service';
import { logger } from '../config/logger';
import {
  validateGpsCoordinates,
  validateDescription,
  validatePhotoTimestamp,
  validateDeviceFingerprint
} from '../utils/validation';
import { ApiError, ReportStatus } from '../types';

const router = Router();

// Configure multer for file uploads (memory storage for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     summary: Submit a new waste report
 *     tags: [Reports]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - photo
 *               - lat
 *               - lng
 *               - accuracy
 *               - timestamp
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *               lat:
 *                 type: number
 *               lng:
 *                 type: number
 *               accuracy:
 *                 type: number
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *               description:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post(
  '/',
  upload.single('photo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.headers['x-device-id'] as string;
      const { lat, lng, accuracy, timestamp, description } = req.body;

      // Validate device fingerprint
      const fingerprintResult = validateDeviceFingerprint(deviceId);
      if (!fingerprintResult.isValid) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: fingerprintResult.error || 'Invalid device ID',
            field: 'X-Device-ID'
          }
        };
        return res.status(400).json(error);
      }

      // Validate GPS coordinates
      const gpsResult = validateGpsCoordinates(
        parseFloat(lat),
        parseFloat(lng),
        parseFloat(accuracy)
      );
      if (!gpsResult.isValid) {
        const error: ApiError = {
          error: {
            code: 'INVALID_LOCATION',
            message: gpsResult.errors.join(', ')
          }
        };
        return res.status(400).json(error);
      }

      // Validate photo timestamp
      const timestampResult = validatePhotoTimestamp(timestamp);
      if (!timestampResult.isValid) {
        const error: ApiError = {
          error: {
            code: 'STALE_PHOTO',
            message: timestampResult.error || 'Photo timestamp is invalid'
          }
        };
        return res.status(400).json(error);
      }

      // Validate description
      const descResult = validateDescription(description);
      if (!descResult.isValid) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: descResult.error || 'Invalid description',
            field: 'description'
          }
        };
        return res.status(400).json(error);
      }

      // Check abuse prevention
      const spamCheck = await abusePreventionService.checkSpam(
        deviceId,
        parseFloat(lat),
        parseFloat(lng)
      );

      if (spamCheck.isSpam) {
        const errorMap: Record<string, { code: string; status: number }> = {
          daily_limit: { code: 'DAILY_LIMIT_REACHED', status: 429 },
          cooldown: { code: 'COOLDOWN_ACTIVE', status: 429 },
          duplicate: { code: 'DUPLICATE_REPORT', status: 409 },
          stale_photo: { code: 'STALE_PHOTO', status: 400 }
        };

        const errorInfo = errorMap[spamCheck.reason || 'daily_limit'];
        const error: ApiError = {
          error: {
            code: errorInfo.code as any,
            message: getSpamErrorMessage(spamCheck.reason),
            retryAfter: spamCheck.retryAfter
          }
        };
        return res.status(errorInfo.status).json(error);
      }

      // Check if photo was uploaded
      if (!req.file) {
        const error: ApiError = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Photo is required',
            field: 'photo'
          }
        };
        return res.status(400).json(error);
      }

      // Process and upload image
      const photoUrl = await imageService.processAndUploadImage(req.file.buffer);

      // Create the report
      const result = await reportService.createReport(
        {
          photo: req.file.buffer,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          accuracy: parseFloat(accuracy),
          deviceId,
          description: descResult.sanitized,
          timestamp: new Date(timestamp)
        },
        photoUrl
      );

      logger.info({ reportId: result.reportId, deviceId }, 'Report submitted');
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reports/my:
 *   get:
 *     summary: Get current user's reports
 *     tags: [Reports]
 *     parameters:
 *       - in: header
 *         name: X-Device-ID
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of user's reports
 *       400:
 *         description: Device ID required
 */
router.get(
  '/my',
  async (req: Request, res: Response, next: NextFunction) => {
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

      const reports = await reportService.getReportsByDevice(deviceId);
      res.json({ reports, count: reports.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reports/device/{deviceId}:
 *   get:
 *     summary: Get all reports for a device
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of reports
 */
router.get(
  '/device/:deviceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { deviceId } = req.params;
      const headerDeviceId = req.headers['x-device-id'] as string;

      // Verify the requesting device matches the requested device
      if (deviceId !== headerDeviceId) {
        const error: ApiError = {
          error: {
            code: 'FORBIDDEN',
            message: 'You can only view your own reports'
          }
        };
        return res.status(403).json(error);
      }

      const reports = await reportService.getReportsByDevice(deviceId);
      res.json({ reports, count: reports.length });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/reports/{reportId}:
 *   get:
 *     summary: Get a single report by ID
 *     tags: [Reports]
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
  '/:reportId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.params;
      const report = await reportService.getReportById(reportId);

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

// Helper function for spam error messages
function getSpamErrorMessage(reason?: string): string {
  switch (reason) {
    case 'daily_limit':
      return 'Maximum 10 reports per day reached. Please try again tomorrow.';
    case 'cooldown':
      return 'Please wait 5 minutes between reports.';
    case 'duplicate':
      return 'A similar report already exists nearby.';
    case 'stale_photo':
      return 'Photo must be taken within the last 5 minutes.';
    default:
      return 'Unable to submit report at this time.';
  }
}

export default router;
