/**
 * Worker Management Property Tests
 * Feature: cleancity-waste-management
 * 
 * Property 30: Worker stats accuracy
 * Property 31: Zone assignment persistence
 * 
 * Validates: Requirements 11.1, 11.2
 */

import * as fc from 'fast-check';
import {
  calculateWorkerStats,
  validateZoneAssignment,
  mergeZones,
  removeZonesFromList,
  WorkerStats
} from '../../src/services/worker.service';

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
 * Generate a valid worker object
 */
const workerGenerator = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  phone: fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 10, maxLength: 15 }),
  assignedZones: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
  isActive: fc.boolean()
});

/**
 * Generate a report with worker assignment
 */
const reportGenerator = (workerId: string) => fc.record({
  workerId: fc.constant(workerId),
  status: fc.constantFrom('open', 'assigned', 'in_progress', 'verified', 'resolved')
});

/**
 * Generate a verification record
 */
const verificationGenerator = (workerId: string) => {
  return fc.record({
    workerId: fc.constant(workerId),
    approvalStatus: fc.constantFrom('pending', 'approved', 'rejected'),
    startedAt: fc.date({ min: new Date('2024-01-01'), max: new Date('2025-12-31') })
  }).chain((base) => {
    // Ensure completedAt is after startedAt (between 2 minutes and 4 hours later)
    const minTime = base.startedAt.getTime() + 2 * 60 * 1000; // 2 minutes
    const maxTime = base.startedAt.getTime() + 4 * 60 * 60 * 1000; // 4 hours
    return fc.date({ min: new Date(minTime), max: new Date(maxTime) }).map((completedAt) => ({
      ...base,
      completedAt
    }));
  });
};

/**
 * Generate zone names
 */
const zoneGenerator = fc.string({ minLength: 1, maxLength: 50 });
const zonesArrayGenerator = fc.array(zoneGenerator, { minLength: 0, maxLength: 10 });

// ============================================
// Property 30: Worker Stats Accuracy
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 30: Worker stats accuracy', () => {
    /**
     * Property 30a: tasksCompleted equals count of resolved tasks
     * Validates: Requirements 11.1
     */
    it('Property 30a: tasksCompleted equals count of resolved tasks', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          fc.array(fc.constantFrom('open', 'assigned', 'in_progress', 'verified', 'resolved'), { minLength: 0, maxLength: 50 }),
          (worker, statuses) => {
            // Create reports with the generated statuses
            const reports = statuses.map((status) => ({
              workerId: worker.id,
              status
            }));

            // Empty verifications for this test
            const verifications: Array<{
              workerId: string;
              approvalStatus: string;
              startedAt: Date;
              completedAt: Date;
            }> = [];

            const stats = calculateWorkerStats(worker, reports, verifications);

            // Count expected resolved tasks
            const expectedCompleted = reports.filter((r) => r.status === 'resolved').length;

            return stats.tasksCompleted === expectedCompleted;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30b: activeTasksCount equals count of in_progress tasks
     * Validates: Requirements 11.1
     */
    it('Property 30b: activeTasksCount equals count of in_progress tasks', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          fc.array(fc.constantFrom('open', 'assigned', 'in_progress', 'verified', 'resolved'), { minLength: 0, maxLength: 50 }),
          (worker, statuses) => {
            const reports = statuses.map((status) => ({
              workerId: worker.id,
              status
            }));

            const verifications: Array<{
              workerId: string;
              approvalStatus: string;
              startedAt: Date;
              completedAt: Date;
            }> = [];

            const stats = calculateWorkerStats(worker, reports, verifications);

            const expectedActive = reports.filter((r) => r.status === 'in_progress').length;

            return stats.activeTasksCount === expectedActive;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30c: assignedZones matches worker's zones
     * Validates: Requirements 11.1
     */
    it('Property 30c: assignedZones matches worker zones', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          (worker) => {
            const stats = calculateWorkerStats(worker, [], []);

            // Zones should match exactly
            return validateZoneAssignment(stats.assignedZones, worker.assignedZones);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30d: Verification counts are accurate
     * Validates: Requirements 11.1
     */
    it('Property 30d: Verification counts are accurate', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          fc.array(fc.constantFrom('pending', 'approved', 'rejected'), { minLength: 0, maxLength: 30 }),
          (worker, approvalStatuses) => {
            const baseDate = new Date('2024-06-01');
            const verifications = approvalStatuses.map((status, index) => {
              const startedAt = new Date(baseDate.getTime() + index * 60 * 60 * 1000);
              const completedAt = new Date(startedAt.getTime() + 30 * 60 * 1000); // 30 minutes later
              return {
                workerId: worker.id,
                approvalStatus: status,
                startedAt,
                completedAt
              };
            });

            const stats = calculateWorkerStats(worker, [], verifications);

            const expectedTotal = verifications.length;
            const expectedApproved = verifications.filter((v) => v.approvalStatus === 'approved').length;
            const expectedRejected = verifications.filter((v) => v.approvalStatus === 'rejected').length;

            return (
              stats.totalVerifications === expectedTotal &&
              stats.approvedVerifications === expectedApproved &&
              stats.rejectedVerifications === expectedRejected
            );
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30e: Efficiency calculation is correct
     * Validates: Requirements 11.1
     */
    it('Property 30e: Efficiency calculation is correct', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          fc.array(fc.constantFrom('pending', 'approved', 'rejected'), { minLength: 1, maxLength: 30 }),
          (worker, approvalStatuses) => {
            const baseDate = new Date('2024-06-01');
            const verifications = approvalStatuses.map((status, index) => {
              const startedAt = new Date(baseDate.getTime() + index * 60 * 60 * 1000);
              const completedAt = new Date(startedAt.getTime() + 30 * 60 * 1000);
              return {
                workerId: worker.id,
                approvalStatus: status,
                startedAt,
                completedAt
              };
            });

            const stats = calculateWorkerStats(worker, [], verifications);

            const total = verifications.length;
            const approved = verifications.filter((v) => v.approvalStatus === 'approved').length;
            const expectedEfficiency = total > 0 ? Math.round((approved / total) * 100 * 100) / 100 : 0;

            return stats.efficiency === expectedEfficiency;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30f: Zero verifications means zero efficiency
     * Validates: Requirements 11.1
     */
    it('Property 30f: Zero verifications means zero efficiency', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          (worker) => {
            const stats = calculateWorkerStats(worker, [], []);
            return stats.efficiency === 0 && stats.totalVerifications === 0;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 30g: Stats only count reports for the specific worker
     * Validates: Requirements 11.1
     */
    it('Property 30g: Stats only count reports for the specific worker', () => {
      fc.assert(
        fc.property(
          workerGenerator,
          fc.uuid(),
          fc.array(fc.constantFrom('open', 'assigned', 'in_progress', 'verified', 'resolved'), { minLength: 1, maxLength: 20 }),
          fc.array(fc.constantFrom('open', 'assigned', 'in_progress', 'verified', 'resolved'), { minLength: 1, maxLength: 20 }),
          (worker, otherWorkerId, workerStatuses, otherStatuses) => {
            // Create reports for both workers
            const workerReports = workerStatuses.map((status) => ({
              workerId: worker.id,
              status
            }));

            const otherReports = otherStatuses.map((status) => ({
              workerId: otherWorkerId,
              status
            }));

            const allReports = [...workerReports, ...otherReports];

            const stats = calculateWorkerStats(worker, allReports, []);

            // Should only count this worker's reports
            const expectedCompleted = workerReports.filter((r) => r.status === 'resolved').length;
            const expectedActive = workerReports.filter((r) => r.status === 'in_progress').length;

            return (
              stats.tasksCompleted === expectedCompleted &&
              stats.activeTasksCount === expectedActive
            );
          }
        ),
        PBT_CONFIG
      );
    });
  });


  // ============================================
  // Property 31: Zone Assignment Persistence
  // ============================================

  describe('Property 31: Zone assignment persistence', () => {
    /**
     * Property 31a: After zone assignment, worker's assignedZones contains exactly the assigned zones
     * Validates: Requirements 11.2
     */
    it('Property 31a: Zone assignment contains exactly assigned zones', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          (zones) => {
            // Simulate zone assignment
            const assignedZones = [...zones];

            // Validate that assigned zones match expected
            return validateZoneAssignment(assignedZones, zones);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31b: Zone assignment is order-independent
     * Validates: Requirements 11.2
     */
    it('Property 31b: Zone assignment is order-independent', () => {
      fc.assert(
        fc.property(
          fc.array(zoneGenerator, { minLength: 1, maxLength: 10 }),
          (zones) => {
            // Shuffle zones
            const shuffled = [...zones].sort(() => Math.random() - 0.5);

            // Both should validate as equal
            return validateZoneAssignment(zones, shuffled);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31c: Merging zones produces union of both arrays
     * Validates: Requirements 11.2
     */
    it('Property 31c: Merging zones produces union of both arrays', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          zonesArrayGenerator,
          (existing, newZones) => {
            const merged = mergeZones(existing, newZones);

            // All existing zones should be in merged
            const existingInMerged = existing.every((zone) => merged.includes(zone));

            // All new zones should be in merged
            const newInMerged = newZones.every((zone) => merged.includes(zone));

            // Merged should have no duplicates
            const noDuplicates = merged.length === new Set(merged).size;

            return existingInMerged && newInMerged && noDuplicates;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31d: Removing zones produces difference of arrays
     * Validates: Requirements 11.2
     */
    it('Property 31d: Removing zones produces difference of arrays', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          zonesArrayGenerator,
          (existing, toRemove) => {
            const remaining = removeZonesFromList(existing, toRemove);

            // None of the removed zones should be in remaining
            const removedNotPresent = toRemove.every((zone) => !remaining.includes(zone));

            // All remaining zones should be from existing and not in toRemove
            const remainingValid = remaining.every(
              (zone) => existing.includes(zone) && !toRemove.includes(zone)
            );

            return removedNotPresent && remainingValid;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31e: Empty zone assignment results in empty zones
     * Validates: Requirements 11.2
     */
    it('Property 31e: Empty zone assignment results in empty zones', () => {
      fc.assert(
        fc.property(
          fc.constant([]),
          (zones: string[]) => {
            return validateZoneAssignment(zones, []);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31f: Zone assignment is idempotent
     * Validates: Requirements 11.2
     */
    it('Property 31f: Zone assignment is idempotent', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          (zones) => {
            // Assigning same zones twice should result in same zones
            const firstAssignment = [...zones];
            const secondAssignment = [...zones];

            return validateZoneAssignment(firstAssignment, secondAssignment);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31g: Merging with empty array returns original
     * Validates: Requirements 11.2
     */
    it('Property 31g: Merging with empty array returns original', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          (zones) => {
            const merged = mergeZones(zones, []);
            return validateZoneAssignment(merged, zones);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31h: Removing non-existent zones has no effect
     * Validates: Requirements 11.2
     */
    it('Property 31h: Removing non-existent zones has no effect', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          fc.array(fc.string({ minLength: 51, maxLength: 60 }), { maxLength: 5 }), // Zones that won't exist
          (existing, nonExistent) => {
            // Ensure nonExistent zones don't overlap with existing
            const filtered = nonExistent.filter((z) => !existing.includes(z));
            const remaining = removeZonesFromList(existing, filtered);

            return validateZoneAssignment(remaining, existing);
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31i: Removing all zones results in empty array
     * Validates: Requirements 11.2
     */
    it('Property 31i: Removing all zones results in empty array', () => {
      fc.assert(
        fc.property(
          fc.array(zoneGenerator, { minLength: 1, maxLength: 10 }),
          (zones) => {
            const remaining = removeZonesFromList(zones, zones);
            return remaining.length === 0;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property 31j: Merge then remove returns to original state
     * Validates: Requirements 11.2
     */
    it('Property 31j: Merge then remove returns to original state (round-trip)', () => {
      fc.assert(
        fc.property(
          zonesArrayGenerator,
          fc.array(fc.string({ minLength: 51, maxLength: 60 }), { minLength: 1, maxLength: 5 }), // Distinct zones
          (original, toAdd) => {
            // Ensure toAdd zones don't overlap with original
            const distinctToAdd = toAdd.filter((z) => !original.includes(z));
            
            if (distinctToAdd.length === 0) {
              return true; // Skip if no distinct zones to add
            }

            // Merge then remove should return to original
            const merged = mergeZones(original, distinctToAdd);
            const restored = removeZonesFromList(merged, distinctToAdd);

            return validateZoneAssignment(restored, original);
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
