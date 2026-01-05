/**
 * CleanCity - Core Data Models and Types
 * Requirements: 1.9, 7.6
 */

// ============================================
// Enums
// ============================================

export enum ReportStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  VERIFIED = 'verified',
  RESOLVED = 'resolved'
}

export enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

export enum BadgeType {
  CLEANLINESS_ROOKIE = 'Cleanliness Rookie',
  ECO_WARRIOR = 'Eco Warrior',
  COMMUNITY_CHAMPION = 'Community Champion',
  CLEANUP_LEGEND = 'Cleanup Legend'
}

export enum PointReason {
  REPORT_VERIFIED = 'report_verified',
  HIGH_SEVERITY_REPORT = 'high_severity_report',
  CONSECUTIVE_DAYS = 'consecutive_days',
  FIRST_IN_AREA = 'first_in_area'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// ============================================
// Location Types
// ============================================

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

// ============================================
// Report Types (Requirement 1.9)
// ============================================

export interface WasteReport {
  id: string;
  deviceId: string;
  photoUrl: string;
  location: GeoLocation;
  timestamp: Date;
  description?: string;
  status: ReportStatus;
  severity?: Severity;
  wasteTypes?: string[];
  createdAt: Date;
  assignedAt?: Date;
  inProgressAt?: Date;
  verifiedAt?: Date;
  resolvedAt?: Date;
  workerId?: string;
  pointsAwarded: number;
}

export interface CreateReportDTO {
  photo: Buffer;
  lat: number;
  lng: number;
  accuracy: number;
  deviceId: string;
  description?: string;
  timestamp: Date;
}

export interface ReportSubmissionResponse {
  reportId: string;
  message: string;
  estimatedCleanupTime: string;
  status: ReportStatus;
}

// ============================================
// Citizen Types
// ============================================

export interface Citizen {
  deviceId: string;
  firstSeen: Date;
  lastActive: Date;
  totalPoints: number;
  reportsCount: number;
  currentBadge: BadgeType;
  city?: string;
  area?: string;
  streakDays: number;
  lastReportDate?: Date;
}

// ============================================
// Worker Types
// ============================================

export interface Worker {
  id: string;
  name: string;
  phone: string;
  assignedZones: string[];
  createdAt: Date;
  isActive: boolean;
  fcmToken?: string;
}

export interface WorkerLoginDTO {
  phone: string;
}

export interface WorkerVerifyOtpDTO {
  phone: string;
  otp: string;
}

export interface WorkerAuthResponse {
  token: string;
  worker: Worker;
}

// ============================================
// Task Types (Requirement 7.6)
// ============================================

export interface Task {
  reportId: string;
  location: GeoLocation;
  severity: Severity;
  wasteTypes: string[];
  reportedAt: Date;
  distance: number;
  estimatedTime: number;
  status: ReportStatus;
  photoUrl: string;
  description?: string;
}

// ============================================
// Verification Types
// ============================================

export interface Verification {
  id: string;
  reportId: string;
  workerId: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  startedAt: Date;
  completedAt: Date;
  workerLat: number;
  workerLng: number;
  timeSpent: number;
  qualityScore?: number;
  approvalStatus: ApprovalStatus;
}

export interface StartTaskDTO {
  workerId: string;
  beforePhoto: Buffer;
  workerLat: number;
  workerLng: number;
}

export interface CompleteTaskDTO {
  workerId: string;
  afterPhoto: Buffer;
  workerLat: number;
  workerLng: number;
}

// ============================================
// Admin Types
// ============================================

export interface Admin {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  role: string;
  createdAt: Date;
}

// ============================================
// Points and Gamification Types
// ============================================

export interface Badge {
  name: BadgeType;
  icon: string;
  requirement: number;
  unlocked: boolean;
}

export interface UserStats {
  totalPoints: number;
  currentBadge: Badge;
  rank: number;
  cityRank: number;
  areaRank: number;
  reportsCount: number;
  streakDays: number;
}

export interface LeaderboardEntry {
  rank: number;
  deviceId: string;
  points: number;
  reportsCount: number;
  badge: string;
}

export interface PointsHistory {
  id: string;
  deviceId: string;
  reportId: string;
  points: number;
  reason: PointReason;
  createdAt: Date;
}

// ============================================
// Dashboard Types
// ============================================

export interface DashboardStats {
  totalReports: number;
  openReports: number;
  inProgressReports: number;
  resolvedToday: number;
  avgResolutionTime: number;
  topContributors: ContributorSummary[];
  areaWiseBreakdown: AreaBreakdown[];
}

export interface ContributorSummary {
  deviceId: string;
  points: number;
  reportsCount: number;
}

export interface AreaBreakdown {
  areaName: string;
  totalReports: number;
  resolvedPercentage: number;
}

// ============================================
// Analytics Types
// ============================================

export interface MonthlyReport {
  period: { start: Date; end: Date };
  summary: {
    totalReports: number;
    resolvedReports: number;
    avgResolutionTime: number;
    citizenParticipation: number;
    wasteCollected: number;
  };
  trends: {
    reportsTrend: number;
    resolutionTrend: number;
    participationTrend: number;
  };
  charts: {
    dailyReports: { date: string; count: number }[];
    areaWise: { area: string; count: number }[];
    wasteTypes: { type: string; percentage: number }[];
  };
}

// ============================================
// OTP Types
// ============================================

export interface OtpRecord {
  phone: string;
  code: string;
  expiresAt: Date;
  attempts: number;
}

// ============================================
// Notification Types
// ============================================

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// ============================================
// Error Types
// ============================================

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'DUPLICATE_REPORT'
  | 'COOLDOWN_ACTIVE'
  | 'DAILY_LIMIT_REACHED'
  | 'STALE_PHOTO'
  | 'INVALID_LOCATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'PROXIMITY_ERROR'
  | 'TIMING_ERROR';

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    field?: string;
    retryAfter?: number;
  };
}

// ============================================
// Spam Detection Types
// ============================================

export interface SpamCheckResult {
  isSpam: boolean;
  reason?: 'daily_limit' | 'cooldown' | 'duplicate' | 'stale_photo';
  retryAfter?: number;
}

export interface DeviceRecord {
  deviceId: string;
  firstSeen: Date;
  lastActive: Date;
  totalReports: number;
  lastReportAt: Date;
  dailyReportCount: number;
}

// ============================================
// Configuration Constants
// ============================================

export const POINTS_CONFIG = {
  reportVerified: 10,
  highSeverityReport: 15,
  consecutiveDays: 5,
  firstReportInArea: 20
} as const;

export const BADGES: Badge[] = [
  { name: BadgeType.CLEANLINESS_ROOKIE, icon: '🌱', requirement: 0, unlocked: true },
  { name: BadgeType.ECO_WARRIOR, icon: '🌿', requirement: 50, unlocked: false },
  { name: BadgeType.COMMUNITY_CHAMPION, icon: '🏆', requirement: 200, unlocked: false },
  { name: BadgeType.CLEANUP_LEGEND, icon: '👑', requirement: 500, unlocked: false }
];

export const RATE_LIMIT_CONFIG = {
  maxReportsPerDay: 10,
  cooldownMinutes: 5,
  duplicateRadiusMeters: 50,
  duplicateWindowHours: 24,
  maxPhotoAgeMinutes: 5
} as const;

export const VERIFICATION_RULES = {
  maxDistanceFromReport: 50,
  minTimeBetweenPhotos: 2,
  maxTimeBetweenPhotos: 240,
  requiredPhotoQuality: 0.7
} as const;
