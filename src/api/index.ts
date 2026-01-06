// API exports
export { default as apiClient, setAuthToken, getAuthToken, clearAuthToken, setDeviceId, getDeviceId } from './client';
export { reportApi } from './reports';
export type {
  GeoLocation,
  CreateReportDTO,
  ReportSubmissionResponse,
  WasteReport,
  UserStats,
  LeaderboardEntry,
} from './reports';
