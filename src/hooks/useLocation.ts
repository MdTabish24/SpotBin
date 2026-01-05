import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { showErrorToast } from '../components/Toast';

interface GeoLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

interface UseLocationReturn {
  location: GeoLocation | null;
  hasPermission: boolean | null;
  isLoading: boolean;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<GeoLocation | null>;
  watchLocation: () => void;
  stopWatching: () => void;
}

/**
 * Hook for location functionality
 * Handles permissions, current location, and location watching
 */
export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchSubscription, setWatchSubscription] = useState<Location.LocationSubscription | null>(null);

  useEffect(() => {
    checkPermission();
    return () => {
      if (watchSubscription) {
        watchSubscription.remove();
      }
    };
  }, []);

  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const requestPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasPermission(granted);

    if (!granted) {
      showErrorToast(
        'Location Permission Required',
        'Please enable location access in settings'
      );
    }

    return granted;
  };

  const getCurrentLocation = useCallback(async (): Promise<GeoLocation | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check permission first
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setIsLoading(false);
          return null;
        }
      }

      // Get current location with high accuracy
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 0,
      });

      const geoLocation: GeoLocation = {
        lat: result.coords.latitude,
        lng: result.coords.longitude,
        accuracy: result.coords.accuracy || 0,
      };

      setLocation(geoLocation);
      setIsLoading(false);
      return geoLocation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get location';
      setError(errorMessage);
      setIsLoading(false);
      showErrorToast('Location Error', errorMessage);
      return null;
    }
  }, [hasPermission]);

  const watchLocation = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    // Stop existing watch if any
    if (watchSubscription) {
      watchSubscription.remove();
    }

    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 10, // Update every 10 meters
      },
      (result) => {
        setLocation({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy || 0,
        });
      }
    );

    setWatchSubscription(subscription);
  }, [hasPermission, watchSubscription]);

  const stopWatching = useCallback(() => {
    if (watchSubscription) {
      watchSubscription.remove();
      setWatchSubscription(null);
    }
  }, [watchSubscription]);

  return {
    location,
    hasPermission,
    isLoading,
    error,
    requestPermission,
    getCurrentLocation,
    watchLocation,
    stopWatching,
  };
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default useLocation;
