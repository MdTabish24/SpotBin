import admin from 'firebase-admin';
import { config } from './env';
import { logger } from './logger';

// Initialize Firebase Admin SDK
let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): admin.app.App | null => {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if Firebase is configured
  if (
    !config.firebase.projectId ||
    !config.firebase.privateKey ||
    !config.firebase.clientEmail ||
    config.firebase.projectId === 'placeholder'
  ) {
    logger.warn('Firebase not configured - push notifications disabled');
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      }),
    });

    logger.info('Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Firebase');
    return null;
  }
};

// Get Firebase Messaging instance
export const getMessaging = (): admin.messaging.Messaging | null => {
  const app = initializeFirebase();
  return app ? admin.messaging(app) : null;
};

// Send push notification to a single device
export const sendPushNotification = async (
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> => {
  const messaging = getMessaging();
  
  if (!messaging) {
    logger.warn('Firebase not configured - skipping push notification');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'cleancity-default',
          icon: 'ic_notification',
          color: '#10B981',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);
    logger.info({ messageId: response }, 'Push notification sent');
    return true;
  } catch (error) {
    logger.error({ error, fcmToken }, 'Failed to send push notification');
    return false;
  }
};

// Send push notification to multiple devices
export const sendMulticastNotification = async (
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number }> => {
  const messaging = getMessaging();
  
  if (!messaging) {
    logger.warn('Firebase not configured - skipping multicast notification');
    return { successCount: 0, failureCount: fcmTokens.length };
  }

  if (fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'cleancity-default',
          icon: 'ic_notification',
          color: '#10B981',
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    logger.info({
      successCount: response.successCount,
      failureCount: response.failureCount,
    }, 'Multicast notification sent');

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    logger.error({ error }, 'Failed to send multicast notification');
    return { successCount: 0, failureCount: fcmTokens.length };
  }
};

// Notification templates
export const NotificationTemplates = {
  reportSubmitted: (reportId: string) => ({
    title: '✅ Report Submitted',
    body: 'Your waste report has been submitted successfully. We\'ll notify you when it\'s resolved.',
    data: { type: 'report_submitted', reportId },
  }),

  reportAssigned: (reportId: string) => ({
    title: '👷 Worker Assigned',
    body: 'A sanitation worker has been assigned to your report.',
    data: { type: 'report_assigned', reportId },
  }),

  reportInProgress: (reportId: string) => ({
    title: '🚧 Cleanup In Progress',
    body: 'A worker is currently cleaning up the waste you reported.',
    data: { type: 'report_in_progress', reportId },
  }),

  reportResolved: (reportId: string, pointsEarned: number) => ({
    title: '🎉 Report Resolved!',
    body: `The waste has been cleaned up! You earned ${pointsEarned} points.`,
    data: { type: 'report_resolved', reportId, pointsEarned: String(pointsEarned) },
  }),

  newTaskAssigned: (taskId: string, area: string) => ({
    title: '📋 New Task Assigned',
    body: `You have a new cleanup task in ${area}.`,
    data: { type: 'new_task', taskId },
  }),

  adminMessage: (message: string, priority: 'low' | 'high') => ({
    title: priority === 'high' ? '🚨 Urgent Message' : '📢 Message from Admin',
    body: message,
    data: { type: 'admin_message', priority },
  }),

  badgeUnlocked: (badgeName: string) => ({
    title: '🏆 Badge Unlocked!',
    body: `Congratulations! You've earned the "${badgeName}" badge.`,
    data: { type: 'badge_unlocked', badgeName },
  }),
};

export default { initializeFirebase, sendPushNotification, sendMulticastNotification };
