import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'device_fingerprint';

/**
 * Generate a unique device fingerprint from device characteristics
 */
async function generateFingerprint(): Promise<string> {
  const components: string[] = [];

  // Application ID
  const appId = Application.applicationId || 'unknown';
  components.push(appId);

  // Device info
  components.push(Device.brand || 'unknown');
  components.push(Device.modelName || 'unknown');
  components.push(Device.osName || 'unknown');
  components.push(Device.osVersion || 'unknown');

  // Platform-specific identifiers
  if (Platform.OS === 'android') {
    const androidId = Application.getAndroidId();
    if (androidId) {
      components.push(androidId);
    }
  } else if (Platform.OS === 'ios') {
    const iosId = await Application.getIosIdForVendorAsync();
    if (iosId) {
      components.push(iosId);
    }
  }

  // Device type
  components.push(Device.deviceType?.toString() || 'unknown');

  // Create hash from components
  const combined = components.join('|');
  const fingerprint = await hashString(combined);
  
  return fingerprint;
}

/**
 * Simple hash function for fingerprint generation
 */
async function hashString(str: string): Promise<string> {
  // Simple hash implementation (in production, use crypto)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex and pad to ensure consistent length
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
  
  // Add timestamp component for uniqueness
  const timestamp = Date.now().toString(16);
  
  // Combine for final fingerprint (64 chars)
  const fingerprint = (hexHash + timestamp).repeat(4).substring(0, 64);
  
  return fingerprint;
}

interface UseDeviceFingerprintReturn {
  fingerprint: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to get or generate device fingerprint
 * Stores fingerprint in secure storage for persistence
 */
export function useDeviceFingerprint(): UseDeviceFingerprintReturn {
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeFingerprint();
  }, []);

  const initializeFingerprint = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Try to get existing fingerprint
      let storedFingerprint = await SecureStore.getItemAsync(DEVICE_ID_KEY);

      if (!storedFingerprint) {
        // Generate new fingerprint
        storedFingerprint = await generateFingerprint();
        
        // Store for future use
        await SecureStore.setItemAsync(DEVICE_ID_KEY, storedFingerprint);
      }

      setFingerprint(storedFingerprint);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get device fingerprint';
      setError(errorMessage);
      console.error('Device fingerprint error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fingerprint,
    isLoading,
    error,
  };
}

export default useDeviceFingerprint;
