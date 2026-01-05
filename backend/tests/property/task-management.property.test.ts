/**
 * Property Tests for Task Management
 * Properties 20, 21, 22
 * Requirements: 7.2, 7.4, 7.6
 */

import fc from 'fast-check';
import {
  taskService,
  calculateTaskPriority,
  calculateEstimatedTime,
  SEVERITY_WEIGHTS
} from '../../src/services/task.service';
import { Task, ReportStatus, Severity, GeoLocation } from '../../src/types';

// ============================================
// Arbitraries (Test Data Generators)
// ============================================

const severityArb = fc.constantFrom(Severity.LOW, Severity.MEDIUM, Severity.HIGH);

const geoLocationArb = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.double({ min: 0, max: 100, noNaN: true })
});

const taskStatusArb = fc.constantFrom(
  ReportStatus.OPEN,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS
);

const wasteTypesArb = fc.array(
  fc.constantFrom('plastic', 'organic', 'metal', 'glass', 'paper', 'electronic', 'hazardous'),
  { minLength: 1, maxLength: 5 }
);

// Generate a date within the last 7 days
const recentDateArb = fc.integer({ min: 0, max: 7 * 24 * 60 * 60 * 1000 }).map(
  (msAgo) => new Date(Date.now() - msAgo)
);

const taskArb = fc.record({
  reportId: fc.uuid(),
  location: geoLocationArb,
  severity: severityArb,
  wasteTypes: wasteTypesArb,
  reportedAt: recentDateArb,
  distance: fc.double({ min: 0, max: 10000, noNaN: true }),
  estimatedTime: fc.integer({ min: 5, max: 120 }),
  status: taskStatusArb,
  photoUrl: fc.webUrl(),
  description: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined })
});

const taskListArb = fc.array(taskArb, { minLength: 1, maxLength: 20 });

// ============================================
// Property 20: Task sorting by priority
// ============================================

describe('Property 20: Task sorting by priority', () => {
  /**
   * Property 20: Task sorting by priority
   * For any list of tasks returned to a worker, tasks SHALL be sorted by priority
   * where priority = severity_weight + age_in_hours.
   * Higher severity and older tasks appear first.
   */
  it('should sort tasks by priority (severity_weight + age_in_hours) in descending order', () => {
    fc.assert(
      fc.property(taskListArb, (tasks) => {
        // Sort tasks using the service
        const sortedTasks = taskService.sortTasksByPriority(tasks);

        // Verify sorted order
        for (let i = 0; i < sortedTasks.length - 1; i++) {
          const currentPriority = calculateTaskPriority(
            sortedTasks[i].severity,
            sortedTasks[i].reportedAt
          );
          const nextPriority = calculateTaskPriority(
            sortedTasks[i + 1].severity,
            sortedTasks[i + 1].reportedAt
          );

          // Current task should have >= priority than next task
          expect(currentPriority).toBeGreaterThanOrEqual(nextPriority);
        }
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should calculate priority as severity_weight + age_in_hours', () => {
    fc.assert(
      fc.property(severityArb, recentDateArb, (severity, reportedAt) => {
        const priority = calculateTaskPriority(severity, reportedAt);
        const expectedWeight = SEVERITY_WEIGHTS[severity];
        const ageInHours = (Date.now() - reportedAt.getTime()) / (1000 * 60 * 60);

        // Priority should equal severity_weight + age_in_hours
        expect(priority).toBeCloseTo(expectedWeight + ageInHours, 5);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should prioritize high severity tasks over low severity tasks of same age', () => {
    fc.assert(
      fc.property(fc.date(), (baseDate) => {
        const sameTime = new Date(baseDate.getTime());
        
        const highPriority = calculateTaskPriority(Severity.HIGH, sameTime);
        const mediumPriority = calculateTaskPriority(Severity.MEDIUM, sameTime);
        const lowPriority = calculateTaskPriority(Severity.LOW, sameTime);

        expect(highPriority).toBeGreaterThan(mediumPriority);
        expect(mediumPriority).toBeGreaterThan(lowPriority);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should prioritize older tasks over newer tasks of same severity', () => {
    fc.assert(
      fc.property(
        severityArb,
        fc.integer({ min: 1, max: 100 }), // hours difference
        (severity, hoursDiff) => {
          const now = new Date();
          const olderDate = new Date(now.getTime() - hoursDiff * 60 * 60 * 1000);

          const olderPriority = calculateTaskPriority(severity, olderDate);
          const newerPriority = calculateTaskPriority(severity, now);

          expect(olderPriority).toBeGreaterThan(newerPriority);
        }
      ),
      { numRuns: 100, verbose: true }
    );
  });
});

// ============================================
// Property 21: Task filtering correctness
// ============================================

describe('Property 21: Task filtering correctness', () => {
  /**
   * Property 21: Task filtering by status
   * For any task filter applied (by status), the returned tasks SHALL only
   * include tasks matching the specified status.
   */
  it('should return only tasks matching the specified status', () => {
    fc.assert(
      fc.property(taskListArb, taskStatusArb, (tasks, filterStatus) => {
        const filteredTasks = taskService.filterTasksByStatus(tasks, filterStatus);

        // All filtered tasks should have the specified status
        filteredTasks.forEach((task) => {
          expect(task.status).toBe(filterStatus);
        });
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should return all tasks with matching status', () => {
    fc.assert(
      fc.property(taskListArb, taskStatusArb, (tasks, filterStatus) => {
        const filteredTasks = taskService.filterTasksByStatus(tasks, filterStatus);
        const expectedCount = tasks.filter((t) => t.status === filterStatus).length;

        // Should return exactly the number of matching tasks
        expect(filteredTasks.length).toBe(expectedCount);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should return empty array when no tasks match the status', () => {
    fc.assert(
      fc.property(taskListArb, (tasks) => {
        // Create tasks with only OPEN status
        const openOnlyTasks = tasks.map((t) => ({ ...t, status: ReportStatus.OPEN }));
        
        // Filter for IN_PROGRESS should return empty
        const filteredTasks = taskService.filterTasksByStatus(
          openOnlyTasks,
          ReportStatus.IN_PROGRESS
        );

        expect(filteredTasks.length).toBe(0);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should preserve task data when filtering', () => {
    fc.assert(
      fc.property(taskListArb, taskStatusArb, (tasks, filterStatus) => {
        const filteredTasks = taskService.filterTasksByStatus(tasks, filterStatus);

        // Each filtered task should be identical to original
        filteredTasks.forEach((filteredTask) => {
          const originalTask = tasks.find((t) => t.reportId === filteredTask.reportId);
          expect(originalTask).toBeDefined();
          expect(filteredTask).toEqual(originalTask);
        });
      }),
      { numRuns: 100, verbose: true }
    );
  });
});

// ============================================
// Property 22: Task data structure completeness
// ============================================

describe('Property 22: Task data structure completeness', () => {
  /**
   * Property 22: Task data structure completeness
   * For any task object, it SHALL contain: reportId, location (lat, lng),
   * severity, wasteType (array), reportedAt (date), distance (number),
   * and estimatedTime (number).
   */
  it('should validate task contains all required fields', () => {
    fc.assert(
      fc.property(taskArb, (task) => {
        // reportId: non-empty string
        expect(typeof task.reportId).toBe('string');
        expect(task.reportId.length).toBeGreaterThan(0);

        // location: object with lat and lng
        expect(typeof task.location).toBe('object');
        expect(typeof task.location.lat).toBe('number');
        expect(typeof task.location.lng).toBe('number');

        // severity: valid enum value
        expect(typeof task.severity).toBe('string');
        expect([Severity.LOW, Severity.MEDIUM, Severity.HIGH]).toContain(task.severity);

        // wasteTypes: array
        expect(Array.isArray(task.wasteTypes)).toBe(true);

        // reportedAt: Date
        expect(task.reportedAt instanceof Date).toBe(true);

        // distance: number
        expect(typeof task.distance).toBe('number');

        // estimatedTime: number
        expect(typeof task.estimatedTime).toBe('number');
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should validate task structure using service method', () => {
    fc.assert(
      fc.property(taskArb, (task) => {
        const isValid = taskService.validateTaskStructure(task);
        expect(isValid).toBe(true);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should have valid GPS coordinates in location', () => {
    fc.assert(
      fc.property(taskArb, (task) => {
        // Latitude: -90 to 90
        expect(task.location.lat).toBeGreaterThanOrEqual(-90);
        expect(task.location.lat).toBeLessThanOrEqual(90);

        // Longitude: -180 to 180
        expect(task.location.lng).toBeGreaterThanOrEqual(-180);
        expect(task.location.lng).toBeLessThanOrEqual(180);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should have non-negative distance and estimatedTime', () => {
    fc.assert(
      fc.property(taskArb, (task) => {
        expect(task.distance).toBeGreaterThanOrEqual(0);
        expect(task.estimatedTime).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100, verbose: true }
    );
  });

  it('should have valid reportedAt date (not in future)', () => {
    fc.assert(
      fc.property(taskArb, (task) => {
        const now = new Date();
        expect(task.reportedAt.getTime()).toBeLessThanOrEqual(now.getTime());
      }),
      { numRuns: 100, verbose: true }
    );
  });
});

// ============================================
// Additional Task Service Tests
// ============================================

describe('Task Service - Estimated Time Calculation', () => {
  it('should calculate estimated time based on severity', () => {
    expect(calculateEstimatedTime(Severity.HIGH)).toBe(60);
    expect(calculateEstimatedTime(Severity.MEDIUM)).toBe(30);
    expect(calculateEstimatedTime(Severity.LOW)).toBe(15);
    expect(calculateEstimatedTime(undefined)).toBe(15);
  });
});

describe('Task Service - Severity Weights', () => {
  it('should have correct severity weights', () => {
    expect(SEVERITY_WEIGHTS[Severity.HIGH]).toBe(100);
    expect(SEVERITY_WEIGHTS[Severity.MEDIUM]).toBe(50);
    expect(SEVERITY_WEIGHTS[Severity.LOW]).toBe(10);
  });

  it('should have HIGH > MEDIUM > LOW weights', () => {
    expect(SEVERITY_WEIGHTS[Severity.HIGH]).toBeGreaterThan(SEVERITY_WEIGHTS[Severity.MEDIUM]);
    expect(SEVERITY_WEIGHTS[Severity.MEDIUM]).toBeGreaterThan(SEVERITY_WEIGHTS[Severity.LOW]);
  });
});
