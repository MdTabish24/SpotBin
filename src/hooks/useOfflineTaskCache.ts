import { useState, useEffect, useCallback } from 'react';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { Task } from '../api/worker';

const DB_NAME = 'cleancity_worker.db';

interface UseOfflineTaskCacheReturn {
  cachedTasks: Task[];
  isOnline: boolean;
  isSyncing: boolean;
  cacheTask: (task: Task) => Promise<void>;
  cacheTasks: (tasks: Task[]) => Promise<void>;
  getCachedTasks: () => Promise<Task[]>;
  clearCache: () => Promise<void>;
}

/**
 * Hook for offline task caching using expo-sqlite
 * Caches tasks locally for offline viewing
 * Requirements: 7.5
 */
export function useOfflineTaskCache(): UseOfflineTaskCacheReturn {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [cachedTasks, setCachedTasks] = useState<Task[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize database
  useEffect(() => {
    initDatabase();
    
    // Subscribe to network state
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, []);

  const initDatabase = async () => {
    try {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      
      // Create tasks table if not exists
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          reportId TEXT PRIMARY KEY,
          photoUrl TEXT,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          severity TEXT,
          wasteTypes TEXT,
          reportedAt TEXT,
          distance REAL,
          estimatedTime INTEGER,
          status TEXT,
          description TEXT,
          cachedAt TEXT
        );
      `);

      setDb(database);
      
      // Load cached tasks
      const tasks = await loadCachedTasks(database);
      setCachedTasks(tasks);
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  };

  const loadCachedTasks = async (database: SQLite.SQLiteDatabase): Promise<Task[]> => {
    try {
      const result = await database.getAllAsync<{
        reportId: string;
        photoUrl: string;
        latitude: number;
        longitude: number;
        accuracy: number;
        severity: string;
        wasteTypes: string;
        reportedAt: string;
        distance: number;
        estimatedTime: number;
        status: string;
        description: string;
      }>('SELECT * FROM tasks ORDER BY reportedAt DESC');

      return result.map(row => ({
        reportId: row.reportId,
        photoUrl: row.photoUrl,
        location: {
          lat: row.latitude,
          lng: row.longitude,
          accuracy: row.accuracy,
        },
        severity: row.severity as 'low' | 'medium' | 'high',
        wasteTypes: JSON.parse(row.wasteTypes || '[]'),
        reportedAt: row.reportedAt,
        distance: row.distance,
        estimatedTime: row.estimatedTime,
        status: row.status as Task['status'],
        description: row.description,
      }));
    } catch (error) {
      console.error('Failed to load cached tasks:', error);
      return [];
    }
  };

  const cacheTask = useCallback(async (task: Task) => {
    if (!db) return;

    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO tasks 
         (reportId, photoUrl, latitude, longitude, accuracy, severity, wasteTypes, 
          reportedAt, distance, estimatedTime, status, description, cachedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.reportId,
          task.photoUrl,
          task.location.lat,
          task.location.lng,
          task.location.accuracy,
          task.severity,
          JSON.stringify(task.wasteTypes || []),
          task.reportedAt,
          task.distance || 0,
          task.estimatedTime || 0,
          task.status,
          task.description || '',
          new Date().toISOString(),
        ]
      );

      // Update local state
      setCachedTasks(prev => {
        const filtered = prev.filter(t => t.reportId !== task.reportId);
        return [task, ...filtered];
      });
    } catch (error) {
      console.error('Failed to cache task:', error);
    }
  }, [db]);

  const cacheTasks = useCallback(async (tasks: Task[]) => {
    if (!db) return;

    setIsSyncing(true);
    try {
      // Clear old cache and insert new tasks
      await db.execAsync('DELETE FROM tasks');

      for (const task of tasks) {
        await db.runAsync(
          `INSERT INTO tasks 
           (reportId, photoUrl, latitude, longitude, accuracy, severity, wasteTypes, 
            reportedAt, distance, estimatedTime, status, description, cachedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            task.reportId,
            task.photoUrl,
            task.location.lat,
            task.location.lng,
            task.location.accuracy,
            task.severity,
            JSON.stringify(task.wasteTypes || []),
            task.reportedAt,
            task.distance || 0,
            task.estimatedTime || 0,
            task.status,
            task.description || '',
            new Date().toISOString(),
          ]
        );
      }

      setCachedTasks(tasks);
    } catch (error) {
      console.error('Failed to cache tasks:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [db]);

  const getCachedTasks = useCallback(async (): Promise<Task[]> => {
    if (!db) return cachedTasks;
    return loadCachedTasks(db);
  }, [db, cachedTasks]);

  const clearCache = useCallback(async () => {
    if (!db) return;

    try {
      await db.execAsync('DELETE FROM tasks');
      setCachedTasks([]);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [db]);

  return {
    cachedTasks,
    isOnline,
    isSyncing,
    cacheTask,
    cacheTasks,
    getCachedTasks,
    clearCache,
  };
}

export default useOfflineTaskCache;
