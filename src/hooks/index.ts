// Custom hooks for CleanCity app

export { useCamera } from './useCamera';
export { useLocation, calculateDistance } from './useLocation';
export { useSecureStorage, secureStorage, STORAGE_KEYS } from './useSecureStorage';
export { useDeviceFingerprint } from './useDeviceFingerprint';
export { useWorkerAuth } from './useWorkerAuth';
export { useOfflineTaskCache } from './useOfflineTaskCache';
export { useOfflineReportStorage, type PendingReport } from './useOfflineReportStorage';
export { useSyncManager, type SyncStatus } from './useSyncManager';
