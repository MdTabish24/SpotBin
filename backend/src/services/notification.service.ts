/**
 * Notification Service - Push Notifications via Firebase Cloud Messaging
 * Requirements: 5.3, 11.5
 * 
 * Property 15: Status change notification trigger
 * Property 32: Worker notification delivery
 */

import pool from '../db/pool';
import { logger } from '../config/logger';
import {
  sendPushNotification,
  sendMulticastNotification,
  NotificationTemplates
} from '../config/firebase';
import { ReportStatus, NotificationPayload } from '../types';

// ============================================
// Notification Queue Types
// ============================================

export interface QueuedNotification {
  id: string;
  recipientType: 'citizen' | 'worker';
  recipientId: string;
  fcmToken: string | null;
  title: string;
  body: string;
  data: Record<string, string>;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  sentAt: Date | null;
  error: string | null;
}

export interface NotificationResult {
  success: boolean;
  queued: boolean;
  notificationId?: string;
  error?: string;
}

// ============================================
// Status Change Messages
// ============================================

export const STATUS_CHANGE_MESSAGES: Record<ReportStatus, { title: string; body: string }> = {
  [ReportStatus.OPEN]: {
    title: '✅ Report Submitted',
    body: 'Your waste report has been submitted successfully.'
  },
  [ReportStatus.ASSIGNED]: {
    title: '👷 Worker Assigned',
    body: 'A sanitation worker has been assigned to your report.'
  },
  [ReportStatus.IN_PROGRESS]: {
    title: '🚧 Cleanup In Progress',
    body: 'A worker is currently cleaning up the waste you reported.'
  },
  [ReportStatus.VERIFIED]: {
    title: '✔️ Cleanup Verified',
    body: 'The cleanup has been verified and is pending final approval.'
  },
  [ReportStatus.RESOLVED]: {
    title: '🎉 Report Resolved!',
    body: 'The waste has been cleaned up! Thank you for your contribution.'
  }
};

// ============================================
// Notification Service Implementation
// ============================================

class NotificationService {
  /**
   * Queue a notification for a citizen on status change
   * Property 15: Status change notification trigger
   * Requirements: 5.3
   */
  async notifyStatusChange(
    reportId: string,
    newStatus: ReportStatus,
    pointsEarned?: number
  ): Promise<NotificationResult> {
    try {
      // Get report and citizen FCM token
      const reportResult = await pool.query(
        `SELECT r.device_id, c.fcm_token
         FROM reports r
         LEFT JOIN citizens c ON r.device_id = c.device_id
         WHERE r.id = $1`,
        [reportId]
      );

      if (reportResult.rows.length === 0) {
        logger.warn({ reportId }, 'Report not found for notification');
        return { success: false, queued: false, error: 'Report not found' };
      }

      const { device_id: deviceId, fcm_token: fcmToken } = reportResult.rows[0];

      // Get notification message based on status
      let notification: NotificationPayload;
      
      if (newStatus === ReportStatus.RESOLVED && pointsEarned !== undefined) {
        const template = NotificationTemplates.reportResolved(reportId, pointsEarned);
        notification = { title: template.title, body: template.body, data: template.data };
      } else {
        const message = STATUS_CHANGE_MESSAGES[newStatus];
        notification = {
          title: message.title,
          body: message.body,
          data: { type: 'status_change', reportId, newStatus }
        };
      }

      // Queue the notification
      const queueResult = await this.queueNotification(
        'citizen',
        deviceId,
        fcmToken,
        notification
      );

      // If FCM token exists, send immediately
      if (fcmToken) {
        const sent = await sendPushNotification(
          fcmToken,
          notification.title,
          notification.body,
          notification.data
        );

        if (sent) {
          await this.markNotificationSent(queueResult.notificationId!);
        }

        return { success: sent, queued: true, notificationId: queueResult.notificationId };
      }

      // No FCM token - notification queued but not sent
      logger.info({ deviceId, reportId, newStatus }, 'Notification queued (no FCM token)');
      return { success: false, queued: true, notificationId: queueResult.notificationId };
    } catch (error) {
      logger.error({ error, reportId, newStatus }, 'Failed to send status change notification');
      return { success: false, queued: false, error: String(error) };
    }
  }

  /**
   * Send notification to a worker from admin
   * Property 32: Worker notification delivery
   * Requirements: 11.5
   */
  async notifyWorker(
    workerId: string,
    message: string,
    priority: 'low' | 'high' = 'low'
  ): Promise<NotificationResult> {
    try {
      // Get worker FCM token
      const workerResult = await pool.query(
        `SELECT fcm_token FROM workers WHERE id = $1`,
        [workerId]
      );

      if (workerResult.rows.length === 0) {
        logger.warn({ workerId }, 'Worker not found for notification');
        return { success: false, queued: false, error: 'Worker not found' };
      }

      const fcmToken = workerResult.rows[0].fcm_token;
      const template = NotificationTemplates.adminMessage(message, priority);
      const notification: NotificationPayload = {
        title: template.title,
        body: template.body,
        data: template.data
      };

      // Queue the notification
      const queueResult = await this.queueNotification(
        'worker',
        workerId,
        fcmToken,
        notification
      );

      // If FCM token exists, send immediately
      if (fcmToken) {
        const sent = await sendPushNotification(
          fcmToken,
          notification.title,
          notification.body,
          notification.data
        );

        if (sent) {
          await this.markNotificationSent(queueResult.notificationId!);
        }

        return { success: sent, queued: true, notificationId: queueResult.notificationId };
      }

      // No FCM token - notification queued but not sent
      logger.info({ workerId, priority }, 'Worker notification queued (no FCM token)');
      return { success: false, queued: true, notificationId: queueResult.notificationId };
    } catch (error) {
      logger.error({ error, workerId }, 'Failed to send worker notification');
      return { success: false, queued: false, error: String(error) };
    }
  }

  /**
   * Notify worker of new task assignment
   */
  async notifyNewTask(workerId: string, taskId: string, area: string): Promise<NotificationResult> {
    try {
      const workerResult = await pool.query(
        `SELECT fcm_token FROM workers WHERE id = $1`,
        [workerId]
      );

      if (workerResult.rows.length === 0) {
        return { success: false, queued: false, error: 'Worker not found' };
      }

      const fcmToken = workerResult.rows[0].fcm_token;
      const template = NotificationTemplates.newTaskAssigned(taskId, area);
      const notification: NotificationPayload = {
        title: template.title,
        body: template.body,
        data: template.data
      };

      const queueResult = await this.queueNotification(
        'worker',
        workerId,
        fcmToken,
        notification
      );

      if (fcmToken) {
        const sent = await sendPushNotification(
          fcmToken,
          notification.title,
          notification.body,
          notification.data
        );

        if (sent) {
          await this.markNotificationSent(queueResult.notificationId!);
        }

        return { success: sent, queued: true, notificationId: queueResult.notificationId };
      }

      return { success: false, queued: true, notificationId: queueResult.notificationId };
    } catch (error) {
      logger.error({ error, workerId, taskId }, 'Failed to send new task notification');
      return { success: false, queued: false, error: String(error) };
    }
  }

  /**
   * Notify citizen of badge unlock
   */
  async notifyBadgeUnlock(deviceId: string, badgeName: string): Promise<NotificationResult> {
    try {
      const citizenResult = await pool.query(
        `SELECT fcm_token FROM citizens WHERE device_id = $1`,
        [deviceId]
      );

      if (citizenResult.rows.length === 0) {
        return { success: false, queued: false, error: 'Citizen not found' };
      }

      const fcmToken = citizenResult.rows[0].fcm_token;
      const template = NotificationTemplates.badgeUnlocked(badgeName);
      const notification: NotificationPayload = {
        title: template.title,
        body: template.body,
        data: template.data
      };

      const queueResult = await this.queueNotification(
        'citizen',
        deviceId,
        fcmToken,
        notification
      );

      if (fcmToken) {
        const sent = await sendPushNotification(
          fcmToken,
          notification.title,
          notification.body,
          notification.data
        );

        if (sent) {
          await this.markNotificationSent(queueResult.notificationId!);
        }

        return { success: sent, queued: true, notificationId: queueResult.notificationId };
      }

      return { success: false, queued: true, notificationId: queueResult.notificationId };
    } catch (error) {
      logger.error({ error, deviceId, badgeName }, 'Failed to send badge unlock notification');
      return { success: false, queued: false, error: String(error) };
    }
  }


  /**
   * Send notification to multiple workers
   */
  async notifyMultipleWorkers(
    workerIds: string[],
    message: string,
    priority: 'low' | 'high' = 'low'
  ): Promise<{ successCount: number; failureCount: number }> {
    try {
      // Get FCM tokens for all workers
      const result = await pool.query(
        `SELECT id, fcm_token FROM workers WHERE id = ANY($1) AND fcm_token IS NOT NULL`,
        [workerIds]
      );

      const fcmTokens = result.rows
        .filter((row) => row.fcm_token)
        .map((row) => row.fcm_token);

      if (fcmTokens.length === 0) {
        logger.info({ workerIds }, 'No FCM tokens found for workers');
        return { successCount: 0, failureCount: workerIds.length };
      }

      const template = NotificationTemplates.adminMessage(message, priority);

      const sendResult = await sendMulticastNotification(
        fcmTokens,
        template.title,
        template.body,
        template.data
      );

      return sendResult;
    } catch (error) {
      logger.error({ error, workerIds }, 'Failed to send multicast notification');
      return { successCount: 0, failureCount: workerIds.length };
    }
  }

  /**
   * Queue a notification in the database
   */
  private async queueNotification(
    recipientType: 'citizen' | 'worker',
    recipientId: string,
    fcmToken: string | null,
    notification: NotificationPayload
  ): Promise<NotificationResult> {
    try {
      // For now, we'll use a simple in-memory approach
      // In production, this would be stored in a notifications table
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info({
        notificationId,
        recipientType,
        recipientId,
        title: notification.title,
        hasFcmToken: !!fcmToken
      }, 'Notification queued');

      return { success: true, queued: true, notificationId };
    } catch (error) {
      logger.error({ error }, 'Failed to queue notification');
      return { success: false, queued: false, error: String(error) };
    }
  }

  /**
   * Mark a notification as sent
   */
  private async markNotificationSent(notificationId: string): Promise<void> {
    logger.info({ notificationId }, 'Notification marked as sent');
  }

  /**
   * Update FCM token for a citizen
   */
  async updateCitizenFcmToken(deviceId: string, fcmToken: string): Promise<boolean> {
    try {
      await pool.query(
        `UPDATE citizens SET fcm_token = $1 WHERE device_id = $2`,
        [fcmToken, deviceId]
      );
      logger.info({ deviceId }, 'Citizen FCM token updated');
      return true;
    } catch (error) {
      logger.error({ error, deviceId }, 'Failed to update citizen FCM token');
      return false;
    }
  }

  /**
   * Update FCM token for a worker
   */
  async updateWorkerFcmToken(workerId: string, fcmToken: string): Promise<boolean> {
    try {
      await pool.query(
        `UPDATE workers SET fcm_token = $1 WHERE id = $2`,
        [fcmToken, workerId]
      );
      logger.info({ workerId }, 'Worker FCM token updated');
      return true;
    } catch (error) {
      logger.error({ error, workerId }, 'Failed to update worker FCM token');
      return false;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    sentToday: number;
    failedToday: number;
  }> {
    // In a full implementation, this would query a notifications table
    return {
      totalSent: 0,
      sentToday: 0,
      failedToday: 0
    };
  }
}

// ============================================
// Pure Logic Functions for Property Testing
// ============================================

/**
 * Determine if a status change should trigger a notification
 * Property 15: Status change notification trigger
 */
export function shouldTriggerNotification(
  oldStatus: ReportStatus | null,
  newStatus: ReportStatus
): boolean {
  // Always trigger notification on status change
  if (oldStatus === newStatus) {
    return false;
  }
  
  // All status changes should trigger notifications
  return true;
}

/**
 * Get notification message for a status change
 */
export function getStatusChangeMessage(
  status: ReportStatus,
  pointsEarned?: number
): { title: string; body: string } {
  if (status === ReportStatus.RESOLVED && pointsEarned !== undefined) {
    return {
      title: '🎉 Report Resolved!',
      body: `The waste has been cleaned up! You earned ${pointsEarned} points.`
    };
  }
  
  return STATUS_CHANGE_MESSAGES[status];
}

/**
 * Validate notification payload structure
 */
export function validateNotificationPayload(payload: NotificationPayload): boolean {
  return (
    typeof payload.title === 'string' &&
    payload.title.length > 0 &&
    typeof payload.body === 'string' &&
    payload.body.length > 0
  );
}

/**
 * Check if a notification should be queued for delivery
 * Property 32: Worker notification delivery
 */
export function shouldQueueForDelivery(
  fcmToken: string | null | undefined,
  recipientExists: boolean
): { shouldQueue: boolean; canSendImmediately: boolean } {
  if (!recipientExists) {
    return { shouldQueue: false, canSendImmediately: false };
  }
  
  return {
    shouldQueue: true,
    canSendImmediately: !!fcmToken && fcmToken.length > 0
  };
}

/**
 * Create notification data for status change
 */
export function createStatusChangeNotificationData(
  reportId: string,
  newStatus: ReportStatus,
  pointsEarned?: number
): { title: string; body: string; data: Record<string, string> } {
  const message = getStatusChangeMessage(newStatus, pointsEarned);
  
  return {
    title: message.title,
    body: message.body,
    data: {
      type: 'status_change',
      reportId,
      newStatus,
      ...(pointsEarned !== undefined ? { pointsEarned: String(pointsEarned) } : {})
    }
  };
}

/**
 * Create notification data for worker message
 */
export function createWorkerNotificationData(
  message: string,
  priority: 'low' | 'high'
): { title: string; body: string; data: Record<string, string> } {
  return {
    title: priority === 'high' ? '🚨 Urgent Message' : '📢 Message from Admin',
    body: message,
    data: {
      type: 'admin_message',
      priority
    }
  };
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
