import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { reportApi, CreateReportDTO } from '../api/reports';
import {
  useOfflineReportStorage,
  PendingReport,
} from './useOfflineReportStorage';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

interface UseSyncManagerReturn {
  isOnline: boolean;
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncAt: Date | null;
  syncNow: () => Promise<void>;
  submitReport: (report: CreateReportDTO) => Promise<SyncResult>;
  getPendingReports: () => PendingReport[];
}

// Sync configuration
const SYNC_CONFIG = {
  maxRetries: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 60 seconds
  backoffMultiplier: 2,
};

/**
 * Sync manager hook with auto-sync and exponential backoff
 * Requirements: 13.1, 13.2
 */
export function useSyncManager(): UseSyncManagerReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const syncInProgress = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    pendingReports,
    isInitialized,
    storePendingReport,
    updateReportSyncStatus,
    removeReport,
    getPendingReports: getStoredReports,
  } = useOfflineReportStorage();

  // Subscribe to network state changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      if (online) {
        setSyncStatus('idle');
        // Auto-sync when coming back online
        syncPendingReports();
      } else {
        setSyncStatus('offline');
      }
    });

    // Check initial network state
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
      if (!state.isConnected) {
        setSyncStatus('offline');
      }
    });

    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Auto-sync when initialized and online
  useEffect(() => {
    if (isInitialized && isOnline && pendingReports.length > 0) {
      syncPendingReports();
    }
  }, [isInitialized, isOnline]);

  /**
   * Calculate delay with exponential backoff
   */
  const calculateBackoffDelay = (attempt: number): number => {
    const delay = Math.min(
      SYNC_CONFIG.baseDelay * Math.pow(SYNC_CONFIG.backoffMultiplier, attempt),
      SYNC_CONFIG.maxDelay
    );
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  };

  /**
   * Sync a single report to the backend
   */
  const syncReport = async (report: PendingReport): Promise<boolean> => {
    if (report.syncAttempts >= SYNC_CONFIG.maxRetries) {
      console.log(`Report ${report.id} exceeded max retries, skipping`);
      return false;
    }

    try {
      await updateReportSyncStatus(report.id, 'syncing');

      const reportData: CreateReportDTO = {
        photo: report.photo,
        location: report.location,
        timestamp: report.timestamp,
        deviceFingerprint: report.deviceFingerprint,
        description: report.description,
      };

      await reportApi.createReport(reportData);

      // Success - remove from pending
      await removeReport(report.id);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      await updateReportSyncStatus(report.id, 'failed', errorMessage);
      return false;
    }
  };

  /**
   * Sync all pending reports
   */
  const syncPendingReports = useCallback(async (): Promise<void> => {
    if (syncInProgress.current || !isOnline) return;

    const reports = await getStoredReports();
    const pendingToSync = reports.filter(
      (r) =>
        r.syncStatus !== 'syncing' && r.syncAttempts < SYNC_CONFIG.maxRetries
    );

    if (pendingToSync.length === 0) return;

    syncInProgress.current = true;
    setSyncStatus('syncing');

    let hasFailures = false;
    let minRetryDelay = Infinity;

    for (const report of pendingToSync) {
      if (!isOnline) break;

      const success = await syncReport(report);

      if (!success) {
        hasFailures = true;
        const delay = calculateBackoffDelay(report.syncAttempts);
        minRetryDelay = Math.min(minRetryDelay, delay);
      }
    }

    syncInProgress.current = false;
    setLastSyncAt(new Date());

    if (hasFailures && isOnline) {
      setSyncStatus('error');
      // Schedule retry with backoff
      if (minRetryDelay < Infinity) {
        retryTimeoutRef.current = setTimeout(() => {
          syncPendingReports();
        }, minRetryDelay);
      }
    } else {
      setSyncStatus(isOnline ? 'idle' : 'offline');
    }
  }, [isOnline, getStoredReports, updateReportSyncStatus, removeReport]);

  /**
   * Submit a new report - stores locally if offline, syncs immediately if online
   */
  const submitReport = useCallback(
    async (report: CreateReportDTO): Promise<SyncResult> => {
      // Always store locally first
      const localId = await storePendingReport(report);

      if (!isOnline) {
        return {
          success: true,
          reportId: localId,
        };
      }

      // Try to sync immediately
      try {
        const response = await reportApi.createReport(report);
        // Success - remove from pending
        await removeReport(localId);
        return {
          success: true,
          reportId: response.reportId,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        await updateReportSyncStatus(localId, 'failed', errorMessage);

        // Still return success since it's stored locally
        return {
          success: true,
          reportId: localId,
          error: `Stored offline. Will sync when online. Error: ${errorMessage}`,
        };
      }
    },
    [isOnline, storePendingReport, removeReport, updateReportSyncStatus]
  );

  const syncNow = useCallback(async (): Promise<void> => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    await syncPendingReports();
  }, [syncPendingReports]);

  const getPendingReports = useCallback((): PendingReport[] => {
    return pendingReports;
  }, [pendingReports]);

  return {
    isOnline,
    syncStatus,
    pendingCount: pendingReports.length,
    lastSyncAt,
    syncNow,
    submitReport,
    getPendingReports,
  };
}

export default useSyncManager;
