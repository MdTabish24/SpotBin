import { useState, useEffect, useCallback } from 'react';
import * as SQLite from 'expo-sqlite';
import { CreateReportDTO, GeoLocation } from '../api/reports';

const DB_NAME = 'cleancity_citizen.db';

export interface PendingReport extends CreateReportDTO {
  id: string;
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'failed';
  syncAttempts: number;
  lastSyncAttempt?: string;
  errorMessage?: string;
}

interface UseOfflineReportStorageReturn {
  pendingReports: PendingReport[];
  isInitialized: boolean;
  storePendingReport: (report: CreateReportDTO) => Promise<string>;
  getPendingReports: () => Promise<PendingReport[]>;
  updateReportSyncStatus: (
    id: string,
    status: 'pending' | 'syncing' | 'failed',
    errorMessage?: string
  ) => Promise<void>;
  removeReport: (id: string) => Promise<void>;
  clearAllPending: () => Promise<void>;
  getReportById: (id: string) => Promise<PendingReport | null>;
}

/**
 * Hook for offline report storage using expo-sqlite
 * Stores pending reports locally when offline
 * Requirements: 13.1, 13.2
 */
export function useOfflineReportStorage(): UseOfflineReportStorageReturn {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize database
  useEffect(() => {
    initDatabase();
  }, []);

  const initDatabase = async () => {
    try {
      const database = await SQLite.openDatabaseAsync(DB_NAME);

      // Create pending_reports table if not exists
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_reports (
          id TEXT PRIMARY KEY,
          photo TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL NOT NULL,
          timestamp TEXT NOT NULL,
          deviceFingerprint TEXT NOT NULL,
          description TEXT,
          createdAt TEXT NOT NULL,
          syncStatus TEXT DEFAULT 'pending',
          syncAttempts INTEGER DEFAULT 0,
          lastSyncAttempt TEXT,
          errorMessage TEXT
        );
      `);

      setDb(database);

      // Load pending reports
      const reports = await loadPendingReports(database);
      setPendingReports(reports);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize offline report database:', error);
      setIsInitialized(true); // Still mark as initialized to prevent blocking
    }
  };

  const loadPendingReports = async (
    database: SQLite.SQLiteDatabase
  ): Promise<PendingReport[]> => {
    try {
      const result = await database.getAllAsync<{
        id: string;
        photo: string;
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: string;
        deviceFingerprint: string;
        description: string | null;
        createdAt: string;
        syncStatus: string;
        syncAttempts: number;
        lastSyncAttempt: string | null;
        errorMessage: string | null;
      }>('SELECT * FROM pending_reports ORDER BY createdAt DESC');

      return result.map((row) => ({
        id: row.id,
        photo: row.photo,
        location: {
          lat: row.latitude,
          lng: row.longitude,
          accuracy: row.accuracy,
        } as GeoLocation,
        timestamp: row.timestamp,
        deviceFingerprint: row.deviceFingerprint,
        description: row.description || undefined,
        createdAt: row.createdAt,
        syncStatus: row.syncStatus as 'pending' | 'syncing' | 'failed',
        syncAttempts: row.syncAttempts,
        lastSyncAttempt: row.lastSyncAttempt || undefined,
        errorMessage: row.errorMessage || undefined,
      }));
    } catch (error) {
      console.error('Failed to load pending reports:', error);
      return [];
    }
  };

  const generateId = (): string => {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const storePendingReport = useCallback(
    async (report: CreateReportDTO): Promise<string> => {
      if (!db) throw new Error('Database not initialized');

      const id = generateId();
      const createdAt = new Date().toISOString();

      try {
        await db.runAsync(
          `INSERT INTO pending_reports 
           (id, photo, latitude, longitude, accuracy, timestamp, deviceFingerprint, 
            description, createdAt, syncStatus, syncAttempts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
          [
            id,
            report.photo,
            report.location.lat,
            report.location.lng,
            report.location.accuracy,
            report.timestamp,
            report.deviceFingerprint,
            report.description || null,
            createdAt,
          ]
        );

        const newReport: PendingReport = {
          ...report,
          id,
          createdAt,
          syncStatus: 'pending',
          syncAttempts: 0,
        };

        setPendingReports((prev) => [newReport, ...prev]);
        return id;
      } catch (error) {
        console.error('Failed to store pending report:', error);
        throw error;
      }
    },
    [db]
  );

  const getPendingReports = useCallback(async (): Promise<PendingReport[]> => {
    if (!db) return pendingReports;
    return loadPendingReports(db);
  }, [db, pendingReports]);

  const getReportById = useCallback(
    async (id: string): Promise<PendingReport | null> => {
      if (!db) return null;

      try {
        const result = await db.getFirstAsync<{
          id: string;
          photo: string;
          latitude: number;
          longitude: number;
          accuracy: number;
          timestamp: string;
          deviceFingerprint: string;
          description: string | null;
          createdAt: string;
          syncStatus: string;
          syncAttempts: number;
          lastSyncAttempt: string | null;
          errorMessage: string | null;
        }>('SELECT * FROM pending_reports WHERE id = ?', [id]);

        if (!result) return null;

        return {
          id: result.id,
          photo: result.photo,
          location: {
            lat: result.latitude,
            lng: result.longitude,
            accuracy: result.accuracy,
          },
          timestamp: result.timestamp,
          deviceFingerprint: result.deviceFingerprint,
          description: result.description || undefined,
          createdAt: result.createdAt,
          syncStatus: result.syncStatus as 'pending' | 'syncing' | 'failed',
          syncAttempts: result.syncAttempts,
          lastSyncAttempt: result.lastSyncAttempt || undefined,
          errorMessage: result.errorMessage || undefined,
        };
      } catch (error) {
        console.error('Failed to get report by id:', error);
        return null;
      }
    },
    [db]
  );


  const updateReportSyncStatus = useCallback(
    async (
      id: string,
      status: 'pending' | 'syncing' | 'failed',
      errorMessage?: string
    ): Promise<void> => {
      if (!db) return;

      try {
        const now = new Date().toISOString();

        if (status === 'syncing') {
          await db.runAsync(
            `UPDATE pending_reports 
             SET syncStatus = ?, lastSyncAttempt = ?, syncAttempts = syncAttempts + 1
             WHERE id = ?`,
            [status, now, id]
          );
        } else if (status === 'failed') {
          await db.runAsync(
            `UPDATE pending_reports 
             SET syncStatus = ?, lastSyncAttempt = ?, errorMessage = ?
             WHERE id = ?`,
            [status, now, errorMessage || null, id]
          );
        } else {
          await db.runAsync(
            `UPDATE pending_reports SET syncStatus = ? WHERE id = ?`,
            [status, id]
          );
        }

        // Update local state
        setPendingReports((prev) =>
          prev.map((report) =>
            report.id === id
              ? {
                  ...report,
                  syncStatus: status,
                  lastSyncAttempt: now,
                  syncAttempts:
                    status === 'syncing'
                      ? report.syncAttempts + 1
                      : report.syncAttempts,
                  errorMessage: status === 'failed' ? errorMessage : undefined,
                }
              : report
          )
        );
      } catch (error) {
        console.error('Failed to update report sync status:', error);
      }
    },
    [db]
  );

  const removeReport = useCallback(
    async (id: string): Promise<void> => {
      if (!db) return;

      try {
        await db.runAsync('DELETE FROM pending_reports WHERE id = ?', [id]);
        setPendingReports((prev) => prev.filter((report) => report.id !== id));
      } catch (error) {
        console.error('Failed to remove report:', error);
      }
    },
    [db]
  );

  const clearAllPending = useCallback(async (): Promise<void> => {
    if (!db) return;

    try {
      await db.execAsync('DELETE FROM pending_reports');
      setPendingReports([]);
    } catch (error) {
      console.error('Failed to clear pending reports:', error);
    }
  }, [db]);

  return {
    pendingReports,
    isInitialized,
    storePendingReport,
    getPendingReports,
    updateReportSyncStatus,
    removeReport,
    clearAllPending,
    getReportById,
  };
}

export default useOfflineReportStorage;
