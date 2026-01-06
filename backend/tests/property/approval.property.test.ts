/**
 * Property Tests for Admin Approval Workflow
 * Feature: cleancity-waste-management
 * Property 29: Approval workflow correctness
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import fc from 'fast-check';
import {
  ReportStatus,
  Severity,
  ApprovalStatus,
  POINTS_CONFIG
} from '../../src/types';
import { calculatePointsForReport, calculateBadge } from '../../src/services/points.service';

// ============================================
// Approval Workflow Logic Types
// ============================================

interface ApprovalWorkflowState {
  verificationStatus: ApprovalStatus;
  reportStatus: ReportStatus;
  citizenPoints: number;
}

interface ApprovalAction {
  type: 'approve' | 'reject';
  severity?: Severity;
}

// ============================================
// Pure Approval Workflow Logic Functions
// ============================================

/**
 * Simulate approval workflow state transition
 * Property 29: Approval workflow correctness
 */
function processApproval(
  state: ApprovalWorkflowState,
  action: ApprovalAction
): { success: boolean; newState: ApprovalWorkflowState; error?: string; pointsAwarded?: number } {
  // Check if verification is in pending status
  if (state.verificationStatus !== ApprovalStatus.PENDING) {
    if (state.verificationStatus === ApprovalStatus.APPROVED) {
      return {
        success: false,
        newState: state,
        error: 'Verification already approved'
      };
    }
    if (state.verificationStatus === ApprovalStatus.REJECTED) {
      return {
        success: false,
        newState: state,
        error: 'Verification was rejected'
      };
    }
  }

  // Check if report is in verified status
  if (state.reportStatus !== ReportStatus.VERIFIED) {
    return {
      success: false,
      newState: state,
      error: `Report status is ${state.reportStatus}, expected ${ReportStatus.VERIFIED}`
    };
  }

  if (action.type === 'approve') {
    // Calculate points
    const pointsBreakdown = calculatePointsForReport(
      action.severity,
      false, // isFirstInArea
      0 // streakDays
    );

    return {
      success: true,
      newState: {
        verificationStatus: ApprovalStatus.APPROVED,
        reportStatus: ReportStatus.RESOLVED,
        citizenPoints: state.citizenPoints + pointsBreakdown.total
      },
      pointsAwarded: pointsBreakdown.total
    };
  } else {
    // Reject
    return {
      success: true,
      newState: {
        verificationStatus: ApprovalStatus.REJECTED,
        reportStatus: ReportStatus.ASSIGNED,
        citizenPoints: state.citizenPoints // No points awarded
      }
    };
  }
}

/**
 * Check if approval is allowed
 */
function canApprove(state: ApprovalWorkflowState): boolean {
  return (
    state.verificationStatus === ApprovalStatus.PENDING &&
    state.reportStatus === ReportStatus.VERIFIED
  );
}

/**
 * Check if rejection is allowed
 */
function canReject(state: ApprovalWorkflowState): boolean {
  return (
    state.verificationStatus === ApprovalStatus.PENDING &&
    state.reportStatus === ReportStatus.VERIFIED
  );
}

// ============================================
// Generators
// ============================================

const severityGenerator = fc.constantFrom(Severity.LOW, Severity.MEDIUM, Severity.HIGH);
const optionalSeverityGenerator = fc.option(severityGenerator, { nil: undefined });

const pendingStateGenerator = fc.record({
  verificationStatus: fc.constant(ApprovalStatus.PENDING),
  reportStatus: fc.constant(ReportStatus.VERIFIED),
  citizenPoints: fc.integer({ min: 0, max: 10000 })
});

const approvedStateGenerator = fc.record({
  verificationStatus: fc.constant(ApprovalStatus.APPROVED),
  reportStatus: fc.constant(ReportStatus.RESOLVED),
  citizenPoints: fc.integer({ min: 0, max: 10000 })
});

const rejectedStateGenerator = fc.record({
  verificationStatus: fc.constant(ApprovalStatus.REJECTED),
  reportStatus: fc.constant(ReportStatus.ASSIGNED),
  citizenPoints: fc.integer({ min: 0, max: 10000 })
});

// ============================================
// Property Tests
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 29: Approval workflow correctness', () => {
    /**
     * Property 29a: Approved verifications SHALL change report status to "resolved"
     * Validates: Requirements 10.2
     */
    it('Property 29a: Approved verifications change report status to resolved', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          optionalSeverityGenerator,
          (state, severity) => {
            const result = processApproval(state, { type: 'approve', severity });

            expect(result.success).toBe(true);
            expect(result.newState.reportStatus).toBe(ReportStatus.RESOLVED);
            expect(result.newState.verificationStatus).toBe(ApprovalStatus.APPROVED);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29b: Approved verifications SHALL credit points to citizen
     * Validates: Requirements 10.2
     */
    it('Property 29b: Approved verifications credit points to citizen', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          severityGenerator,
          (state, severity) => {
            const initialPoints = state.citizenPoints;
            const result = processApproval(state, { type: 'approve', severity });

            expect(result.success).toBe(true);
            expect(result.pointsAwarded).toBeDefined();
            expect(result.pointsAwarded).toBeGreaterThan(0);

            // Points should be at least base points (10)
            // High severity gets 15 points
            const expectedMinPoints = severity === Severity.HIGH ? 15 : 10;
            expect(result.pointsAwarded).toBeGreaterThanOrEqual(expectedMinPoints);

            expect(result.newState.citizenPoints).toBe(initialPoints + result.pointsAwarded!);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29c: Rejected verifications SHALL return task to worker queue with status "assigned"
     * Validates: Requirements 10.3
     */
    it('Property 29c: Rejected verifications return task to worker queue', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          (state) => {
            const result = processApproval(state, { type: 'reject' });

            expect(result.success).toBe(true);
            expect(result.newState.reportStatus).toBe(ReportStatus.ASSIGNED);
            expect(result.newState.verificationStatus).toBe(ApprovalStatus.REJECTED);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29d: Rejected verifications SHALL NOT credit points to citizen
     * Validates: Requirements 10.3
     */
    it('Property 29d: Rejected verifications do not credit points', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          (state) => {
            const initialPoints = state.citizenPoints;
            const result = processApproval(state, { type: 'reject' });

            expect(result.success).toBe(true);
            expect(result.pointsAwarded).toBeUndefined();
            expect(result.newState.citizenPoints).toBe(initialPoints);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29e: Already approved verifications cannot be approved again
     * Validates: Requirements 10.1, 10.2
     */
    it('Property 29e: Already approved verifications cannot be approved again', () => {
      fc.assert(
        fc.property(
          approvedStateGenerator,
          optionalSeverityGenerator,
          (state, severity) => {
            const result = processApproval(state, { type: 'approve', severity });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already approved');
            expect(result.newState).toEqual(state);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29f: Already rejected verifications cannot be rejected again
     * Validates: Requirements 10.3
     */
    it('Property 29f: Already rejected verifications cannot be rejected again', () => {
      fc.assert(
        fc.property(
          rejectedStateGenerator,
          (state) => {
            const result = processApproval(state, { type: 'reject' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('rejected');
            expect(result.newState).toEqual(state);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29g: Approved verifications cannot be rejected
     * Validates: Requirements 10.2, 10.3
     */
    it('Property 29g: Approved verifications cannot be rejected', () => {
      fc.assert(
        fc.property(
          approvedStateGenerator,
          (state) => {
            const result = processApproval(state, { type: 'reject' });

            expect(result.success).toBe(false);
            expect(result.error).toContain('already approved');
            expect(result.newState).toEqual(state);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29h: Rejected verifications cannot be approved
     * Validates: Requirements 10.2, 10.3
     */
    it('Property 29h: Rejected verifications cannot be approved', () => {
      fc.assert(
        fc.property(
          rejectedStateGenerator,
          optionalSeverityGenerator,
          (state, severity) => {
            const result = processApproval(state, { type: 'approve', severity });

            expect(result.success).toBe(false);
            expect(result.error).toContain('rejected');
            expect(result.newState).toEqual(state);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29i: Points calculation is correct for different severities
     * Validates: Requirements 10.2
     */
    it('Property 29i: Points calculation is correct for different severities', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          severityGenerator,
          (state, severity) => {
            const result = processApproval(state, { type: 'approve', severity });

            expect(result.success).toBe(true);

            // Verify points based on severity
            if (severity === Severity.HIGH) {
              expect(result.pointsAwarded).toBe(POINTS_CONFIG.highSeverityReport);
            } else {
              expect(result.pointsAwarded).toBe(POINTS_CONFIG.reportVerified);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property 29j: canApprove and canReject are consistent
     * Validates: Requirements 10.1, 10.2, 10.3
     */
    it('Property 29j: canApprove and canReject are consistent with processApproval', () => {
      fc.assert(
        fc.property(
          fc.oneof(pendingStateGenerator, approvedStateGenerator, rejectedStateGenerator),
          optionalSeverityGenerator,
          (state, severity) => {
            const canApproveResult = canApprove(state);
            const canRejectResult = canReject(state);

            const approveResult = processApproval(state, { type: 'approve', severity });
            const rejectResult = processApproval(state, { type: 'reject' });

            // canApprove should match whether approval succeeds
            expect(canApproveResult).toBe(approveResult.success);
            // canReject should match whether rejection succeeds
            expect(canRejectResult).toBe(rejectResult.success);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Approval workflow state transitions', () => {
    /**
     * Test that approval is idempotent in terms of final state
     */
    it('should have consistent final state after approval', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          severityGenerator,
          (state, severity) => {
            const result1 = processApproval(state, { type: 'approve', severity });
            
            // Trying to approve again should fail but not change state
            const result2 = processApproval(result1.newState, { type: 'approve', severity });

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.newState).toEqual(result1.newState);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that rejection is idempotent in terms of final state
     */
    it('should have consistent final state after rejection', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          (state) => {
            const result1 = processApproval(state, { type: 'reject' });
            
            // Trying to reject again should fail but not change state
            const result2 = processApproval(result1.newState, { type: 'reject' });

            expect(result1.success).toBe(true);
            expect(result2.success).toBe(false);
            expect(result2.newState).toEqual(result1.newState);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that approval and rejection are mutually exclusive
     */
    it('should not allow both approval and rejection on same verification', () => {
      fc.assert(
        fc.property(
          pendingStateGenerator,
          fc.boolean(),
          severityGenerator,
          (state, approveFirst, severity) => {
            if (approveFirst) {
              const approveResult = processApproval(state, { type: 'approve', severity });
              const rejectResult = processApproval(approveResult.newState, { type: 'reject' });

              expect(approveResult.success).toBe(true);
              expect(rejectResult.success).toBe(false);
            } else {
              const rejectResult = processApproval(state, { type: 'reject' });
              const approveResult = processApproval(rejectResult.newState, { type: 'approve', severity });

              expect(rejectResult.success).toBe(true);
              expect(approveResult.success).toBe(false);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
