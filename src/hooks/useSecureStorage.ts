import { useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  DEVICE_ID: 'device_id',
  USER_PREFERENCES: 'user_preferences',
  WORKER_DATA: 'worker_data',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

interface UseSecureStorageReturn<T> {
  value: T | null;
  isLoading: boolean;
  error: string | null;
  getValue: () => Promise<T | null>;
  setValue: (value: T) => Promise<boolean>;
  removeValue: () => Promise<boolean>;
}

/**
 * Hook for secure storage operations
 * Uses expo-secure-store for encrypted storage
 */
export function useSecureStorage<T>(key: StorageKey): UseSecureStorageReturn<T> {
  const [value, setValueState] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getValue = useCallback(async (): Promise<T | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const stored = await SecureStore.getItemAsync(key);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        setValueState(parsed);
        return parsed;
      }
      setValueState(null);
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get value';
      setError(errorMessage);
      console.error(`SecureStorage get error for ${key}:`, err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  const setValue = useCallback(
    async (newValue: T): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await SecureStore.setItemAsync(key, JSON.stringify(newValue));
        setValueState(newValue);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to set value';
        setError(errorMessage);
        console.error(`SecureStorage set error for ${key}:`, err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [key]
  );

  const removeValue = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await SecureStore.deleteItemAsync(key);
      setValueState(null);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove value';
      setError(errorMessage);
      console.error(`SecureStorage remove error for ${key}:`, err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  return {
    value,
    isLoading,
    error,
    getValue,
    setValue,
    removeValue,
  };
}

/**
 * Direct secure storage functions (non-hook)
 */
export const secureStorage = {
  async get<T>(key: StorageKey): Promise<T | null> {
    try {
      const stored = await SecureStore.getItemAsync(key);
      return stored ? (JSON.parse(stored) as T) : null;
    } catch {
      return null;
    }
  },

  async set<T>(key: StorageKey, value: T): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async remove(key: StorageKey): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch {
      return false;
    }
  },
};

export default useSecureStorage;
