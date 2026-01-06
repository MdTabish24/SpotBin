import apiClient from './client';

// Types
export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface CreateReportDTO {
  photo: string; // base64 or URI
  location: GeoLocation;
  timestamp: string;
  deviceFingerprint: string;
  description?: string;
}

export interface ReportSubmissionResponse {
  reportId: string;
  message: string;
  estimatedCleanupTime: string;
  status: string;
}

export interface WasteReport {
  id: string;
  photoUrl: string;
  location: GeoLocation;
  description?: string;
  status: 'open' | 'assigned' | 'in_progress' | 'verified' | 'resolved';
  severity?: 'low' | 'medium' | 'high';
  wasteTypes?: string[];
  createdAt: string;
  assignedAt?: string;
  resolvedAt?: string;
  pointsAwarded?: number;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
}

export interface UserStats {
  totalPoints: number;
  currentBadge: {
    name: string;
    icon: string;
    requirement: number;
  };
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

/**
 * Report API service
 */
export const reportApi = {
  /**
   * Submit a new waste report
   */
  async createReport(data: CreateReportDTO): Promise<ReportSubmissionResponse> {
    // Create FormData for multipart upload
    const formData = new FormData();
    
    // Add photo as file
    const photoUri = data.photo;
    const filename = photoUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('photo', {
      uri: photoUri,
      name: filename,
      type,
    } as any);
    
    // Add other fields
    formData.append('latitude', data.location.lat.toString());
    formData.append('longitude', data.location.lng.toString());
    formData.append('accuracy', data.location.accuracy.toString());
    formData.append('timestamp', data.timestamp);
    formData.append('deviceFingerprint', data.deviceFingerprint);
    
    if (data.description) {
      formData.append('description', data.description);
    }

    const response = await apiClient.post<ReportSubmissionResponse>(
      '/reports',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for upload
      }
    );
    
    return response.data;
  },

  /**
   * Get all reports for current device
   */
  async getMyReports(): Promise<WasteReport[]> {
    const response = await apiClient.get<{ reports: WasteReport[] }>('/reports/my');
    return response.data.reports;
  },

  /**
   * Get a single report by ID
   */
  async getReportById(reportId: string): Promise<WasteReport> {
    const response = await apiClient.get<{ report: WasteReport }>(`/reports/${reportId}`);
    return response.data.report;
  },

  /**
   * Get user stats (points, badge, rank)
   */
  async getUserStats(): Promise<UserStats> {
    const response = await apiClient.get<{ stats: UserStats }>('/citizens/stats');
    return response.data.stats;
  },

  /**
   * Get leaderboard
   */
  async getLeaderboard(scope: 'city' | 'area', limit: number = 50): Promise<LeaderboardEntry[]> {
    const response = await apiClient.get<{ leaderboard: LeaderboardEntry[] }>(
      `/leaderboard?scope=${scope}&limit=${limit}`
    );
    return response.data.leaderboard;
  },
};

export default reportApi;
