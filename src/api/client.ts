import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Toast from 'react-native-toast-message';

// API base URL - will be configured via environment
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// Storage keys
const TOKEN_KEY = 'auth_token';
const DEVICE_ID_KEY = 'device_id';

/**
 * Create axios instance with base configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor - adds auth token and device ID to all requests
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Add device ID header for citizen identification
    const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (deviceId) {
      config.headers['X-Device-ID'] = deviceId;
    }

    // Add auth token for worker/admin routes
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor - handles errors globally
 */
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error: { code: string; message: string } }>) => {
    const { response } = error;

    if (response) {
      const { status, data } = response;
      const errorMessage = data?.error?.message || 'An error occurred';
      const errorCode = data?.error?.code || 'UNKNOWN_ERROR';

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          Toast.show({
            type: 'error',
            text1: 'Session Expired',
            text2: 'Please login again',
          });
          break;

        case 429:
          // Rate limited
          Toast.show({
            type: 'error',
            text1: 'Too Many Requests',
            text2: errorMessage,
          });
          break;

        case 400:
          // Validation error
          Toast.show({
            type: 'error',
            text1: 'Validation Error',
            text2: errorMessage,
          });
          break;

        case 409:
          // Duplicate report
          Toast.show({
            type: 'info',
            text1: 'Duplicate Report',
            text2: errorMessage,
          });
          break;

        case 500:
          // Server error
          Toast.show({
            type: 'error',
            text1: 'Server Error',
            text2: 'Please try again later',
          });
          break;

        default:
          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: errorMessage,
          });
      }
    } else if (error.request) {
      // Network error
      Toast.show({
        type: 'error',
        text1: 'Network Error',
        text2: 'Please check your internet connection',
      });
    }

    return Promise.reject(error);
  }
);

/**
 * Auth token management
 */
export const setAuthToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getAuthToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const clearAuthToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

/**
 * Device ID management
 */
export const setDeviceId = async (deviceId: string): Promise<void> => {
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
};

export const getDeviceId = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
};

export default apiClient;
