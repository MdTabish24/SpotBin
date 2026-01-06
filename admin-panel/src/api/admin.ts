import apiClient, { setAuthToken, clearAuthToken } from './client';
import type {
  Admin,
  Report,
  Worker,
  DashboardStats,
  AnalyticsReport,
  ReportFilters,
  PaginatedResponse,
} from '../types';

/**
 * Admin Authentication API
 */
export const authApi = {
  async login(email: string, password: string): Promise<{ token: string; admin: Admin }> {
    const response = await apiClient.post('/auth/admin/login', { email, password });
    const { token, admin } = response.data;
    setAuthToken(token);
    localStorage.setItem('admin_user', JSON.stringify(admin));
    return response.data;
  },

  async logout(): Promise<void> {
    clearAuthToken();
  },

  async getProfile(): Promise<Admin> {
    const response = await apiClient.get('/admin/profile');
    return response.data.admin;
  },

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
 * Dashboard API
 */
export const dashboardApi = {
  async getStats(): Promise<DashboardStats> {
    const response = await apiClient.get('/admin/dashboard/stats');
    return response.data;
  },

  async getRecentReports(limit = 10): Promise<Report[]> {
    const response = await apiClient.get(`/admin/reports?limit=${limit}&sort=createdAt:desc`);
    return response.data.reports;
  },
};

/**
 * Reports API
 */
export const reportsApi = {
  async getReports(filters: ReportFilters = {}): Promise<PaginatedResponse<Report>> {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.severity) params.append('severity', filters.severity);
    if (filters.area) params.append('area', filters.area);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get(`/admin/reports?${params.toString()}`);
    return response.data;
  },

  async getReportById(id: string): Promise<Report> {
    const response = await apiClient.get(`/admin/reports/${id}`);
    return response.data.report;
  },

  async approveVerification(reportId: string): Promise<void> {
    await apiClient.post(`/admin/reports/${reportId}/approve`);
  },

  async rejectVerification(reportId: string, reason?: string): Promise<void> {
    await apiClient.post(`/admin/reports/${reportId}/reject`, { reason });
  },

  async getVerificationsPending(): Promise<Report[]> {
    const response = await apiClient.get('/admin/verifications/pending');
    return response.data.reports;
  },
};

/**
 * Workers API
 */
export const workersApi = {
  async getWorkers(): Promise<Worker[]> {
    const response = await apiClient.get('/admin/workers');
    return response.data.workers;
  },

  async getWorkerById(id: string): Promise<Worker> {
    const response = await apiClient.get(`/admin/workers/${id}`);
    return response.data.worker;
  },

  async createWorker(data: { name: string; phone: string; assignedZones: string[] }): Promise<Worker> {
    const response = await apiClient.post('/admin/workers', data);
    return response.data.worker;
  },

  async updateWorker(id: string, data: Partial<Worker>): Promise<Worker> {
    const response = await apiClient.put(`/admin/workers/${id}`, data);
    return response.data.worker;
  },

  async assignZones(workerId: string, zones: string[]): Promise<void> {
    await apiClient.put(`/admin/workers/${workerId}/zones`, { zones });
  },

  async sendNotification(workerId: string, message: string): Promise<void> {
    await apiClient.post(`/admin/workers/${workerId}/notify`, { message });
  },

  async getWorkerTasks(workerId: string): Promise<Report[]> {
    const response = await apiClient.get(`/admin/workers/${workerId}/tasks`);
    return response.data.tasks;
  },
};

/**
 * Analytics API
 */
export const analyticsApi = {
  async getReport(startDate: string, endDate: string): Promise<AnalyticsReport> {
    const response = await apiClient.get(`/admin/analytics?startDate=${startDate}&endDate=${endDate}`);
    return response.data;
  },

  async exportPdf(startDate: string, endDate: string): Promise<Blob> {
    const response = await apiClient.get(
      `/admin/analytics/export/pdf?startDate=${startDate}&endDate=${endDate}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  async exportExcel(startDate: string, endDate: string): Promise<Blob> {
    const response = await apiClient.get(
      `/admin/analytics/export/excel?startDate=${startDate}&endDate=${endDate}`,
      { responseType: 'blob' }
    );
    return response.data;
  },
};

export default { authApi, dashboardApi, reportsApi, workersApi, analyticsApi };
