import apiClient, { setAuthToken, clearAuthToken } from './client';

// Types
export interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface Worker {
  id: string;
  name: string;
  phone: string;
  assignedZones: string[];
  activeTasksCount: number;
  completedToday: number;
  rating: number;
}

export interface Task {
  reportId: string;
  photoUrl: string;
  location: GeoLocation;
  severity: 'low' | 'medium' | 'high';
  wasteTypes: string[];
  reportedAt: string;
  distance: number;
  estimatedTime: number;
  status: 'open' | 'assigned' | 'in_progress' | 'verified' | 'resolved';
  description?: string;
}

export interface VerificationPayload {
  taskId: string;
  workerLocation: GeoLocation;
  beforePhoto?: string;
  beforePhotoTimestamp?: string;
  afterPhoto?: string;
  afterPhotoTimestamp?: string;
}

export interface AuthResponse {
  token: string;
  worker: Worker;
  expiresAt: string;
}

export interface OtpResponse {
  message: string;
  expiresAt: string;
}

/**
 * Worker Authentication API
 */
export const workerAuthApi = {
  /**
   * Request OTP for phone number
   */
  async requestOtp(phone: string): Promise<OtpResponse> {
    const response = await apiClient.post<OtpResponse>('/auth/worker/otp', {
      phone,
    });
    return response.data;
  },

  /**
   * Verify OTP and get JWT token
   */
  async verifyOtp(phone: string, otp: string): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/worker/verify', {
      phone,
      otp,
    });
    
    // Store token
    await setAuthToken(response.data.token);
    
    return response.data;
  },

  /**
   * Logout - clear token
   */
  async logout(): Promise<void> {
    await clearAuthToken();
  },

  /**
   * Get current worker profile
   */
  async getProfile(): Promise<Worker> {
    const response = await apiClient.get<{ worker: Worker }>('/workers/me');
    return response.data.worker;
  },

  /**
   * Check if token is valid
   */
  async validateToken(): Promise<boolean> {
    try {
      await apiClient.get('/auth/validate');
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Worker Tasks API
 */
export const workerTaskApi = {
  /**
   * Get all tasks for current worker
   */
  async getTasks(status?: string): Promise<Task[]> {
    const params = status && status !== 'all' ? `?status=${status}` : '';
    const response = await apiClient.get<{ tasks: Task[] }>(`/workers/tasks${params}`);
    return response.data.tasks;
  },

  /**
   * Get single task by ID
   */
  async getTaskById(taskId: string): Promise<Task> {
    const response = await apiClient.get<{ task: Task }>(`/workers/tasks/${taskId}`);
    return response.data.task;
  },

  /**
   * Start a task (capture before photo)
   */
  async startTask(
    taskId: string,
    workerLocation: GeoLocation,
    beforePhoto: string
  ): Promise<{ message: string; startedAt: string }> {
    const formData = new FormData();
    
    // Add photo
    const filename = beforePhoto.split('/').pop() || 'before.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('beforePhoto', {
      uri: beforePhoto,
      name: filename,
      type,
    } as any);
    
    formData.append('latitude', workerLocation.lat.toString());
    formData.append('longitude', workerLocation.lng.toString());
    formData.append('accuracy', workerLocation.accuracy.toString());
    formData.append('timestamp', new Date().toISOString());

    const response = await apiClient.post<{ message: string; startedAt: string }>(
      `/workers/tasks/${taskId}/start`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
    
    return response.data;
  },

  /**
   * Complete a task (capture after photo)
   */
  async completeTask(
    taskId: string,
    workerLocation: GeoLocation,
    afterPhoto: string
  ): Promise<{ message: string; completedAt: string }> {
    const formData = new FormData();
    
    // Add photo
    const filename = afterPhoto.split('/').pop() || 'after.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('afterPhoto', {
      uri: afterPhoto,
      name: filename,
      type,
    } as any);
    
    formData.append('latitude', workerLocation.lat.toString());
    formData.append('longitude', workerLocation.lng.toString());
    formData.append('accuracy', workerLocation.accuracy.toString());
    formData.append('timestamp', new Date().toISOString());

    const response = await apiClient.post<{ message: string; completedAt: string }>(
      `/workers/tasks/${taskId}/complete`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
    
    return response.data;
  },

  /**
   * Get task verification status
   */
  async getVerificationStatus(taskId: string): Promise<{
    status: string;
    startedAt?: string;
    completedAt?: string;
    beforePhotoUrl?: string;
    afterPhotoUrl?: string;
  }> {
    const response = await apiClient.get(`/workers/tasks/${taskId}/verification`);
    return response.data;
  },
};

export default { workerAuthApi, workerTaskApi };
