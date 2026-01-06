// Report types
export type ReportStatus = 'open' | 'assigned' | 'in_progress' | 'verified' | 'resolved';
export type Severity = 'low' | 'medium' | 'high';

export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface Report {
  id: string;
  deviceId: string;
  photoUrl: string;
  location: GeoLocation;
  description?: string;
  status: ReportStatus;
  severity: Severity;
  wasteTypes: string[];
  createdAt: string;
  assignedAt?: string;
  inProgressAt?: string;
  verifiedAt?: string;
  resolvedAt?: string;
  workerId?: string;
  workerName?: string;
  pointsAwarded: number;
  verification?: Verification;
}

export interface Verification {
  id: string;
  reportId: string;
  workerId: string;
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  startedAt: string;
  completedAt: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
}

// Worker types
export interface Worker {
  id: string;
  name: string;
  phone: string;
  assignedZones: string[];
  isActive: boolean;
  createdAt: string;
  tasksCompleted: number;
  activeTasksCount: number;
  avgResolutionTime?: number;
  rating?: number;
  lastActive?: string;
}

// Admin types
export interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
}

// Dashboard types
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

// Analytics types
export interface AnalyticsReport {
  period: { start: string; end: string };
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

// Filter types
export interface ReportFilters {
  status?: ReportStatus;
  severity?: Severity;
  area?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    field?: string;
  };
}
