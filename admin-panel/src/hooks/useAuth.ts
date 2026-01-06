import { useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/admin';
import { getAuthToken } from '../api/client';
import type { Admin } from '../types';

interface UseAuthReturn {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

export function useAuth(): UseAuthReturn {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = getAuthToken();
    
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      // Try to get stored admin data first
      const storedAdmin = localStorage.getItem('admin_user');
      if (storedAdmin) {
        setAdmin(JSON.parse(storedAdmin));
      }

      // Validate token with server
      const isValid = await authApi.validateToken();
      
      if (!isValid) {
        await logout();
      } else if (!storedAdmin) {
        // Fetch profile if not stored
        const profile = await authApi.getProfile();
        setAdmin(profile);
        localStorage.setItem('admin_user', JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const { admin: adminData } = await authApi.login(email, password);
      setAdmin(adminData);
    } catch (err: any) {
      const message = err.response?.data?.error?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAdmin(null);
  }, []);

  return {
    admin,
    isAuthenticated: !!admin,
    isLoading,
    login,
    logout,
    error,
  };
}

export default useAuth;
