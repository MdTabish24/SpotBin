/**
 * Notification Service Property Tests
 * Feature: cleancity-waste-management
 * 
 * Property 15: Status change notification trigger
 * Property 32: Worker notification delivery
 * 
 * Validates: Requirements 5.3, 11.5
 */

import * as fc from 'fast-check';
import {
  shouldTriggerNotification,
  getStatusChangeMessage,
  validateNotificationPayload,
  shouldQueueForDelivery,
  createStatusChangeNotificationData,
  createWorkerNotificationData,
  STATUS_CHANGE_MESSAGES
} from '../../src/services/notification.service';
import { ReportStatus, NotificationPayload } from '../../src/types';

// ============================================
// Test Configuration
// ============================================

const PBT_CONFIG = {
  numRuns: 100,
  verbose: false
};

// ============================================
// Generators
// ============================================

/**
 * Generate a valid report status
 */
const reportStatusGenerator = fc.constantFrom(
  ReportStatus.OPEN,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.VERIFIED,
  ReportStatus.RESOLVED
);

/**
 * Generate a valid FCM token (or null)
 */
const fcmTokenGenerator = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 100, maxLength: 200 }) // FCM tokens are typically long strings
);

/**
 * Generate points earned
 */
const pointsGenerator = fc.integer({ min: 10, max: 100 });

/**
 * Generate a notification priority
 */
const priorityGenerator = fc.constantFrom('low', 'high') as fc.Arbitrary<'low' | 'high'>;

/**
 * Generate a notification message
 */
const messageGenerator = fc.string({ minLength: 1, maxLength: 500 });

/**
 * Generate a report ID
 */
const reportIdGenerator = fc.uuid();

// ============================================
// Property 15: Status Change Notification Trigger
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 15: Status change notification trigger', () => {
    /**
     * Property 15a: Any status change should trigger a notification
     * Validates: Requirements 5.3
     */
    it('Property 15a: Any status change should trigger a notification', () => {
      fc.assert(
        fc.property(
          reportStatusGenerator,
          reportStatusGenerator,
          (oldStatus, newStatus) => {
            const shouldTrigger = shouldTriggerNotification(oldStatus, newStatus);
            
            // Should trigger if status actually changed
            if (oldStatus !== newStatus) {
              return shouldTrigger === true;
            }
            // Should not trigger if status is the same
            return shouldTrigger === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15b: Null old status (new report) should trigger notification
     * Validates: Requirements 5.3
     */
    it('Property 15b: Null old status (new report) should trigger notification', () => {
      fc.assert(
        fc.property(
          reportStatusGenerator,
          (newStatus) => {
            const shouldTrigger = shouldTriggerNotification(null, newStatus);
            return shouldTrigger === true;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15c: Same status should not trigger notification
     * Validates: Requirements 5.3
     */
    it('Property 15c: Same status should not trigger notification', () => {
      fc.assert(
        fc.property(
          reportStatusGenerator,
          (status) => {
            const shouldTrigger = shouldTriggerNotification(status, status);
            return shouldTrigger === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15d: All statuses have defined notification messages
     * Validates: Requirements 5.3
     */
    it('Property 15d: All statuses have defined notification messages', () => {
      fc.assert(
        fc.property(
          reportStatusGenerator,
          (status) => {
            const message = getStatusChangeMessage(status);
            return (
              typeof message.title === 'string' &&
              message.title.length > 0 &&
              typeof message.body === 'string' &&
              message.body.length > 0
            );
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15e: Resolved status with points includes points in message
     * Validates: Requirements 5.3
     */
    it('Property 15e: Resolved status with points includes points in message', () => {
      fc.assert(
        fc.property(
          pointsGenerator,
          (points) => {
            const message = getStatusChangeMessage(ReportStatus.RESOLVED, points);
            return message.body.includes(String(points));
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15f: Status change notification data has all required fields
     * Validates: Requirements 5.3
     */
    it('Property 15f: Status change notification data has all required fields', () => {
      fc.assert(
        fc.property(
          reportIdGenerator,
          reportStatusGenerator,
          fc.option(pointsGenerator),
          (reportId, status, points) => {
            const data = createStatusChangeNotificationData(
              reportId,
              status,
              points ?? undefined
            );
            
            return (
              typeof data.title === 'string' &&
              data.title.length > 0 &&
              typeof data.body === 'string' &&
              data.body.length > 0 &&
              typeof data.data === 'object' &&
              data.data.type === 'status_change' &&
              data.data.reportId === reportId &&
              data.data.newStatus === status
            );
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15g: Notification payload validation works correctly
     * Validates: Requirements 5.3
     */
    it('Property 15g: Notification payload validation works correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 500 }),
          (title, body) => {
            const payload: NotificationPayload = { title, body };
            return validateNotificationPayload(payload) === true;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 15h: Empty title or body fails validation
     * Validates: Requirements 5.3
     */
    it('Property 15h: Empty title or body fails validation', () => {
      // Empty title
      expect(validateNotificationPayload({ title: '', body: 'test' })).toBe(false);
      // Empty body
      expect(validateNotificationPayload({ title: 'test', body: '' })).toBe(false);
      // Both empty
      expect(validateNotificationPayload({ title: '', body: '' })).toBe(false);
    });
  });


  // ============================================
  // Property 32: Worker Notification Delivery
  // ============================================

  describe('Property 32: Worker notification delivery', () => {
    /**
     * Property 32a: Notification should be queued if recipient exists
     * Validates: Requirements 11.5
     */
    it('Property 32a: Notification should be queued if recipient exists', () => {
      fc.assert(
        fc.property(
          fcmTokenGenerator,
          (fcmToken) => {
            const result = shouldQueueForDelivery(fcmToken, true);
            return result.shouldQueue === true;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32b: Notification should not be queued if recipient doesn't exist
     * Validates: Requirements 11.5
     */
    it('Property 32b: Notification should not be queued if recipient does not exist', () => {
      fc.assert(
        fc.property(
          fcmTokenGenerator,
          (fcmToken) => {
            const result = shouldQueueForDelivery(fcmToken, false);
            return result.shouldQueue === false && result.canSendImmediately === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32c: Can send immediately only if FCM token exists
     * Validates: Requirements 11.5
     */
    it('Property 32c: Can send immediately only if FCM token exists', () => {
      fc.assert(
        fc.property(
          fcmTokenGenerator,
          (fcmToken) => {
            const result = shouldQueueForDelivery(fcmToken, true);
            
            if (fcmToken && fcmToken.length > 0) {
              return result.canSendImmediately === true;
            }
            return result.canSendImmediately === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32d: Worker notification data has correct structure
     * Validates: Requirements 11.5
     */
    it('Property 32d: Worker notification data has correct structure', () => {
      fc.assert(
        fc.property(
          messageGenerator,
          priorityGenerator,
          (message, priority) => {
            const data = createWorkerNotificationData(message, priority);
            
            return (
              typeof data.title === 'string' &&
              data.title.length > 0 &&
              data.body === message &&
              data.data.type === 'admin_message' &&
              data.data.priority === priority
            );
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32e: High priority notifications have urgent title
     * Validates: Requirements 11.5
     */
    it('Property 32e: High priority notifications have urgent title', () => {
      fc.assert(
        fc.property(
          messageGenerator,
          (message) => {
            const data = createWorkerNotificationData(message, 'high');
            return data.title.includes('Urgent') || data.title.includes('🚨');
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32f: Low priority notifications have standard title
     * Validates: Requirements 11.5
     */
    it('Property 32f: Low priority notifications have standard title', () => {
      fc.assert(
        fc.property(
          messageGenerator,
          (message) => {
            const data = createWorkerNotificationData(message, 'low');
            return data.title.includes('Message') || data.title.includes('📢');
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 32g: Null FCM token means cannot send immediately
     * Validates: Requirements 11.5
     */
    it('Property 32g: Null FCM token means cannot send immediately', () => {
      const result = shouldQueueForDelivery(null, true);
      expect(result.shouldQueue).toBe(true);
      expect(result.canSendImmediately).toBe(false);
    });

    /**
     * Property 32h: Empty string FCM token means cannot send immediately
     * Validates: Requirements 11.5
     */
    it('Property 32h: Empty string FCM token means cannot send immediately', () => {
      const result = shouldQueueForDelivery('', true);
      expect(result.shouldQueue).toBe(true);
      expect(result.canSendImmediately).toBe(false);
    });

    /**
     * Property 32i: Undefined FCM token means cannot send immediately
     * Validates: Requirements 11.5
     */
    it('Property 32i: Undefined FCM token means cannot send immediately', () => {
      const result = shouldQueueForDelivery(undefined, true);
      expect(result.shouldQueue).toBe(true);
      expect(result.canSendImmediately).toBe(false);
    });
  });

  // ============================================
  // Status Change Messages Configuration
  // ============================================

  describe('Status change messages configuration', () => {
    /**
     * All statuses should have messages defined
     */
    it('should have messages defined for all statuses', () => {
      const allStatuses = Object.values(ReportStatus);
      
      allStatuses.forEach((status) => {
        expect(STATUS_CHANGE_MESSAGES[status]).toBeDefined();
        expect(STATUS_CHANGE_MESSAGES[status].title).toBeTruthy();
        expect(STATUS_CHANGE_MESSAGES[status].body).toBeTruthy();
      });
    });

    /**
     * Messages should be user-friendly (contain emoji or descriptive text)
     */
    it('should have user-friendly messages', () => {
      const allStatuses = Object.values(ReportStatus);
      
      allStatuses.forEach((status) => {
        const message = STATUS_CHANGE_MESSAGES[status];
        // Title should be descriptive (more than just status name)
        expect(message.title.length).toBeGreaterThan(5);
        // Body should provide context
        expect(message.body.length).toBeGreaterThan(10);
      });
    });

    /**
     * RESOLVED status message should mention completion
     */
    it('should have completion message for RESOLVED status', () => {
      const message = STATUS_CHANGE_MESSAGES[ReportStatus.RESOLVED];
      expect(
        message.title.toLowerCase().includes('resolved') ||
        message.body.toLowerCase().includes('cleaned') ||
        message.body.toLowerCase().includes('resolved')
      ).toBe(true);
    });

    /**
     * IN_PROGRESS status message should indicate ongoing work
     */
    it('should have progress message for IN_PROGRESS status', () => {
      const message = STATUS_CHANGE_MESSAGES[ReportStatus.IN_PROGRESS];
      expect(
        message.title.toLowerCase().includes('progress') ||
        message.body.toLowerCase().includes('cleaning') ||
        message.body.toLowerCase().includes('currently')
      ).toBe(true);
    });
  });
});
