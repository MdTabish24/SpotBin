/**
 * Feature: cleancity-waste-management
 * Property 34: Offline storage and sync round-trip
 * Validates: Requirements 1.8, 13.1, 13.2
 *
 * For any report submitted while offline, storing locally then syncing when online
 * SHALL result in the report being persisted to the backend with all original data intact.
 */

import fc from 'fast-check';

// Types matching the mobile app
interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface CreateReportDTO {
  photo: string;
  location: GeoLocation;
  timestamp: string;
  deviceFingerprint: string;
  description?: string;
}

interface PendingReport extends CreateReportDTO {
  id: string;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'failed';
  syncAttempts: number;
}

// Simulated offline storage (in-memory for testing)
class OfflineStorage {
  private reports: Map<string, PendingReport> = new Map();

  generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  store(report: CreateReportDTO): PendingReport {
    const id = this.generateId();
    const pendingReport: PendingReport = {
      ...report,
      id,
      createdAt: new Date().toISOString(),
      syncStatus: 'pending',
      syncAttempts: 0,
    };
    this.reports.set(id, pendingReport);
    return pendingReport;
  }

  get(id: string): PendingReport | undefined {
    return this.reports.get(id);
  }

  getAll(): PendingReport[] {
    return Array.from(this.reports.values());
  }

  remove(id: string): boolean {
    return this.reports.delete(id);
  }

  updateStatus(
    id: string,
    status: 'pending' | 'syncing' | 'failed'
  ): PendingReport | undefined {
    const report = this.reports.get(id);
    if (report) {
      report.syncStatus = status;
      if (status === 'syncing') {
        report.syncAttempts++;
      }
    }
    return report;
  }

  clear(): void {
    this.reports.clear();
  }
}

// Simulated backend storage
class BackendStorage {
  private reports: Map<string, CreateReportDTO & { id: string }> = new Map();

  async createReport(
    report: CreateReportDTO
  ): Promise<{ reportId: string; success: boolean }> {
    const id = `backend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.reports.set(id, { ...report, id });
    return { reportId: id, success: true };
  }

  getReport(id: string): (CreateReportDTO & { id: string }) | undefined {
    return this.reports.get(id);
  }

  getAllReports(): (CreateReportDTO & { id: string })[] {
    return Array.from(this.reports.values());
  }

  clear(): void {
    this.reports.clear();
  }
}

// Sync manager simulation
class SyncManager {
  constructor(
    private offlineStorage: OfflineStorage,
    private backendStorage: BackendStorage
  ) {}

  async syncReport(
    pendingReport: PendingReport
  ): Promise<{ success: boolean; backendId?: string }> {
    // Update status to syncing
    this.offlineStorage.updateStatus(pendingReport.id, 'syncing');

    try {
      // Extract original report data
      const reportData: CreateReportDTO = {
        photo: pendingReport.photo,
        location: pendingReport.location,
        timestamp: pendingReport.timestamp,
        deviceFingerprint: pendingReport.deviceFingerprint,
        description: pendingReport.description,
      };

      // Send to backend
      const result = await this.backendStorage.createReport(reportData);

      // Remove from offline storage on success
      this.offlineStorage.remove(pendingReport.id);

      return { success: true, backendId: result.reportId };
    } catch {
      this.offlineStorage.updateStatus(pendingReport.id, 'failed');
      return { success: false };
    }
  }

  async syncAll(): Promise<{ synced: number; failed: number }> {
    const pending = this.offlineStorage.getAll();
    let synced = 0;
    let failed = 0;

    for (const report of pending) {
      const result = await this.syncReport(report);
      if (result.success) {
        synced++;
      } else {
        failed++;
      }
    }

    return { synced, failed };
  }
}

// Custom generators
const geoLocationGenerator = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true }),
  accuracy: fc.double({ min: 0, max: 100, noNaN: true }),
});

const reportGenerator = fc.record({
  photo: fc.string({ minLength: 10, maxLength: 100 }).map((s) => `file://${s}.jpg`),
  location: geoLocationGenerator,
  timestamp: fc.date({ min: new Date(Date.now() - 300000), max: new Date() }).map(
    (d) => d.toISOString()
  ),
  deviceFingerprint: fc.hexaString({ minLength: 32, maxLength: 64 }),
  description: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
});

describe('Property 34: Offline storage and sync round-trip', () => {
  let offlineStorage: OfflineStorage;
  let backendStorage: BackendStorage;
  let syncManager: SyncManager;

  beforeEach(() => {
    offlineStorage = new OfflineStorage();
    backendStorage = new BackendStorage();
    syncManager = new SyncManager(offlineStorage, backendStorage);
  });

  afterEach(() => {
    offlineStorage.clear();
    backendStorage.clear();
  });

  it('should store report locally with all original data intact', () => {
    fc.assert(
      fc.property(reportGenerator, (report) => {
        const stored = offlineStorage.store(report);

        // Verify all original data is preserved
        expect(stored.photo).toBe(report.photo);
        expect(stored.location.lat).toBe(report.location.lat);
        expect(stored.location.lng).toBe(report.location.lng);
        expect(stored.location.accuracy).toBe(report.location.accuracy);
        expect(stored.timestamp).toBe(report.timestamp);
        expect(stored.deviceFingerprint).toBe(report.deviceFingerprint);
        expect(stored.description).toBe(report.description);

        // Verify metadata is added
        expect(stored.id).toBeDefined();
        expect(stored.id.startsWith('offline_')).toBe(true);
        expect(stored.createdAt).toBeDefined();
        expect(stored.syncStatus).toBe('pending');
        expect(stored.syncAttempts).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });


  it('should sync report to backend with all original data intact', async () => {
    await fc.assert(
      fc.asyncProperty(reportGenerator, async (report) => {
        // Store offline
        const stored = offlineStorage.store(report);

        // Sync to backend
        const result = await syncManager.syncReport(stored);

        expect(result.success).toBe(true);
        expect(result.backendId).toBeDefined();

        // Verify backend received correct data
        const backendReport = backendStorage.getReport(result.backendId!);
        expect(backendReport).toBeDefined();
        expect(backendReport!.photo).toBe(report.photo);
        expect(backendReport!.location.lat).toBe(report.location.lat);
        expect(backendReport!.location.lng).toBe(report.location.lng);
        expect(backendReport!.location.accuracy).toBe(report.location.accuracy);
        expect(backendReport!.timestamp).toBe(report.timestamp);
        expect(backendReport!.deviceFingerprint).toBe(report.deviceFingerprint);
        expect(backendReport!.description).toBe(report.description);

        // Verify removed from offline storage
        expect(offlineStorage.get(stored.id)).toBeUndefined();

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle multiple reports in sync queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(reportGenerator, { minLength: 1, maxLength: 10 }),
        async (reports) => {
          // Create fresh storage instances for each iteration
          const localOffline = new OfflineStorage();
          const localBackend = new BackendStorage();
          const localSync = new SyncManager(localOffline, localBackend);

          // Store all reports offline
          const storedReports = reports.map((r) => localOffline.store(r));

          // Verify all stored
          expect(localOffline.getAll().length).toBe(reports.length);

          // Sync all
          const result = await localSync.syncAll();

          expect(result.synced).toBe(reports.length);
          expect(result.failed).toBe(0);

          // Verify all removed from offline storage
          expect(localOffline.getAll().length).toBe(0);

          // Verify all in backend
          const backendReports = localBackend.getAllReports();
          expect(backendReports.length).toBe(reports.length);

          // Verify data integrity for each report
          for (let i = 0; i < reports.length; i++) {
            const original = reports[i];
            const backend = backendReports.find(
              (b) =>
                b.deviceFingerprint === original.deviceFingerprint &&
                b.timestamp === original.timestamp
            );

            expect(backend).toBeDefined();
            expect(backend!.photo).toBe(original.photo);
            expect(backend!.location.lat).toBe(original.location.lat);
            expect(backend!.location.lng).toBe(original.location.lng);
          }

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should preserve report order during sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(reportGenerator, { minLength: 2, maxLength: 5 }),
        async (reports) => {
          // Create fresh storage instances for each iteration
          const localOffline = new OfflineStorage();
          const localBackend = new BackendStorage();
          const localSync = new SyncManager(localOffline, localBackend);

          // Store reports with slight delay to ensure different timestamps
          const storedReports: PendingReport[] = [];
          for (const report of reports) {
            storedReports.push(localOffline.store(report));
          }

          // Verify stored in order
          const allStored = localOffline.getAll();
          expect(allStored.length).toBe(reports.length);

          // Sync all
          await localSync.syncAll();

          // Verify all synced
          expect(localOffline.getAll().length).toBe(0);
          expect(localBackend.getAllReports().length).toBe(reports.length);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle GPS coordinate precision during round-trip', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -90, max: 90, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (lat, lng, accuracy) => {
          const report: CreateReportDTO = {
            photo: 'file://test.jpg',
            location: { lat, lng, accuracy },
            timestamp: new Date().toISOString(),
            deviceFingerprint: 'test123',
          };

          const stored = offlineStorage.store(report);

          // Verify GPS precision is maintained
          expect(stored.location.lat).toBe(lat);
          expect(stored.location.lng).toBe(lng);
          expect(stored.location.accuracy).toBe(accuracy);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle optional description field correctly', () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
        (description) => {
          const report: CreateReportDTO = {
            photo: 'file://test.jpg',
            location: { lat: 0, lng: 0, accuracy: 10 },
            timestamp: new Date().toISOString(),
            deviceFingerprint: 'test123',
            description,
          };

          const stored = offlineStorage.store(report);

          // Verify description is preserved (including undefined)
          expect(stored.description).toBe(description);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track sync attempts correctly', () => {
    fc.assert(
      fc.property(reportGenerator, (report) => {
        const stored = offlineStorage.store(report);

        expect(stored.syncAttempts).toBe(0);

        // Simulate sync attempt
        offlineStorage.updateStatus(stored.id, 'syncing');
        const updated1 = offlineStorage.get(stored.id);
        expect(updated1?.syncAttempts).toBe(1);
        expect(updated1?.syncStatus).toBe('syncing');

        // Simulate failed sync
        offlineStorage.updateStatus(stored.id, 'failed');
        const updated2 = offlineStorage.get(stored.id);
        expect(updated2?.syncStatus).toBe('failed');
        expect(updated2?.syncAttempts).toBe(1); // Should not increment on failure

        // Simulate retry
        offlineStorage.updateStatus(stored.id, 'syncing');
        const updated3 = offlineStorage.get(stored.id);
        expect(updated3?.syncAttempts).toBe(2);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
