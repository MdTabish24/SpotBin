import { Region } from 'react-native-maps';

// Default map configuration
export const MAP_CONFIG = {
  // Default region (Mumbai, India)
  defaultRegion: {
    latitude: 19.076,
    longitude: 72.8777,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  } as Region,

  // Map style (can be customized)
  mapStyle: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],

  // Marker colors based on status
  markerColors: {
    open: '#EF4444', // Red
    assigned: '#F59E0B', // Yellow/Orange
    in_progress: '#F59E0B', // Yellow/Orange
    verified: '#10B981', // Green
    resolved: '#10B981', // Green
  } as Record<string, string>,

  // Cluster configuration
  cluster: {
    radius: 50,
    minPoints: 2,
    maxZoom: 16,
  },

  // Animation duration
  animationDuration: 500,
};

// Get marker color based on report status
export const getMarkerColor = (status: string): string => {
  return MAP_CONFIG.markerColors[status] || MAP_CONFIG.markerColors.open;
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Format distance for display
export const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

// Check if coordinates are valid
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
};

// Get region that fits all markers
export const getRegionForMarkers = (
  markers: Array<{ latitude: number; longitude: number }>
): Region | null => {
  if (markers.length === 0) return null;

  let minLat = markers[0].latitude;
  let maxLat = markers[0].latitude;
  let minLng = markers[0].longitude;
  let maxLng = markers[0].longitude;

  markers.forEach(marker => {
    minLat = Math.min(minLat, marker.latitude);
    maxLat = Math.max(maxLat, marker.latitude);
    minLng = Math.min(minLng, marker.longitude);
    maxLng = Math.max(maxLng, marker.longitude);
  });

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const deltaLat = (maxLat - minLat) * 1.5; // Add padding
  const deltaLng = (maxLng - minLng) * 1.5;

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.max(deltaLat, 0.01),
    longitudeDelta: Math.max(deltaLng, 0.01),
  };
};

export default MAP_CONFIG;
