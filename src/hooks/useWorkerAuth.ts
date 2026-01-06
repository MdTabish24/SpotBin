import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { workerAuthApi, Worker } from '../api/worker';

const TOKEN_KEY = 'auth_token';
const WORKER_KEY = 'worker_data';

interface UseWorkerAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  worker: Worker | null;
  login: (phone: string, otp: string) => Promise<boolean>;
  logout: () => Promise<void>;
  requestOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  refreshProfile: () => Promise<void>;
}

/**
 * Hook for worker authentication state management
 */
export function useWorkerAuth(): UseWorkerAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [worker, setWorker] = useState<Worker | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      
      if (token) {
        // Validate token with server
        const isValid = await workerAuthApi.validateToken();
        
        if (isValid) {
          // Load cached worker data
          const cachedWorker = await SecureStore.getItemAsync(WORKER_KEY);
          if (cachedWorker) {
            setWorker(JSON.parse(cachedWorker));
          }
          
          // Refresh profile in background
          try {
            const profile = await workerAuthApi.getProfile();
            setWorker(profile);
            await SecureStore.setItemAsync(WORKER_KEY, JSON.stringify(profile));
          } catch {
            // Use cached data if refresh fails
          }
          
          setIsAuthenticated(true);
        } else {
          // Token invalid, clear it
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(WORKER_KEY);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const requestOtp = useCallback(async (phone: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await workerAuthApi.requestOtp(phone);
      return { success: true, message: response.message };
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to send OTP';
      return { success: false, message };
    }
  }, []);

  const login = useCallback(async (phone: string, otp: string): Promise<boolean> => {
    try {
      const response = await workerAuthApi.verifyOtp(phone, otp);
      
      // Store worker data
      setWorker(response.worker);
      await SecureStore.setItemAsync(WORKER_KEY, JSON.stringify(response.worker));
      
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await workerAuthApi.logout();
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(WORKER_KEY);
      setWorker(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await workerAuthApi.getProfile();
      setWorker(profile);
      await SecureStore.setItemAsync(WORKER_KEY, JSON.stringify(profile));
    } catch (error) {
      console.error('Profile refresh error:', error);
    }
  }, []);

  return {
    isAuthenticated,
    isLoading,
    worker,
    login,
    logout,
    requestOtp,
    refreshProfile,
  };
}

export default useWorkerAuth;
