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

// Mock data for demo mode when backend is not available
const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, deviceId: 'user_abc123', points: 450, reportsCount: 45, badge: 'Cleanup Legend' },
  { rank: 2, deviceId: 'user_def456', points: 320, reportsCount: 32, badge: 'Community Champion' },
  { rank: 3, deviceId: 'user_ghi789', points: 280, reportsCount: 28, badge: 'Community Champion' },
  { rank: 4, deviceId: 'user_jkl012', points: 150, reportsCount: 15, badge: 'Eco Warrior' },
  { rank: 5, deviceId: 'user_mno345', points: 120, reportsCount: 12, badge: 'Eco Warrior' },
  { rank: 6, deviceId: 'user_pqr678', points: 80, reportsCount: 8, badge: 'Eco Warrior' },
  { rank: 7, deviceId: 'user_stu901', points: 60, reportsCount: 6, badge: 'Eco Warrior' },
  { rank: 8, deviceId: 'user_vwx234', points: 40, reportsCount: 4, badge: 'Cleanliness Rookie' },
  { rank: 9, deviceId: 'user_yza567', points: 30, reportsCount: 3, badge: 'Cleanliness Rookie' },
  { rank: 10, deviceId: 'user_bcd890', points: 20, reportsCount: 2, badge: 'Cleanliness Rookie' },
];

const MOCK_USER_STATS: UserStats = {
  totalPoints: 0,
  currentBadge: { name: 'Cleanliness Rookie', icon: '🌱', requirement: 0 },
  rank: 0,
  cityRank: 0,
  areaRank: 0,
  reportsCount: 0,
  streakDays: 0,
};

/**
 * Report API service
 */
export const reportApi = {
  /**
   * Submit a new waste report
   */
  async createReport(data: CreateReportDTO): Promise<ReportSubmissionResponse> {
    try {
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
      formData.append('lat', data.location.lat.toString());
      formData.append('lng', data.location.lng.toString());
      formData.append('accuracy', data.location.accuracy.toString());
      formData.append('timestamp', data.timestamp);
      
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
    } catch (error) {
      // Return mock response in demo mode
      console.log('Using demo mode for report submission');
      return {
        reportId: `demo-${Date.now()}`,
        message: 'Report submitted (Demo Mode)',
        estimatedCleanupTime: 'Within 24 hours',
        status: 'open',
      };
    }
  },

  /**
   * Get all reports for current device
   */
  async getMyReports(): Promise<WasteReport[]> {
    try {
      const response = await apiClient.get<{ reports: WasteReport[] }>('/reports/my');
      return response.data.reports;
    } catch (error) {
      // Return empty array in demo mode
      console.log('Using demo mode for reports');
      return [];
    }
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
    try {
      const response = await apiClient.get<{ stats: UserStats }>('/citizens/stats');
      return response.data.stats;
    } catch (error) {
      // Return mock stats in demo mode
      console.log('Using demo mode for user stats');
      return MOCK_USER_STATS;
    }
  },

  /**
   * Get leaderboard
   */
  async getLeaderboard(scope: 'city' | 'area', limit: number = 50): Promise<LeaderboardEntry[]> {
    try {
      const response = await apiClient.get<{ leaderboard: LeaderboardEntry[] }>(
        `/leaderboard?scope=${scope}&limit=${limit}`
      );
      return response.data.leaderboard;
    } catch (error) {
      // Return mock leaderboard in demo mode
      console.log('Using demo mode for leaderboard');
      return MOCK_LEADERBOARD.slice(0, limit);
    }
  },
};

export default reportApi;
