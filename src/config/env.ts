import Constants from 'expo-constants';

// Environment configuration for Expo app
export const ENV = {
  // API Configuration
  // Use your machine's local IP for mobile device access
  API_BASE_URL: __DEV__ 
    ? 'http://192.168.0.103:3000/api/v1' 
    : 'https://api.cleancity.in/v1',
  
  // Google Maps (loaded from app.json config)
  GOOGLE_MAPS_API_KEY: Constants.expoConfig?.android?.config?.googleMaps?.apiKey || '',
  
  // App Info
  APP_NAME: Constants.expoConfig?.name || 'CleanCity',
  APP_VERSION: Constants.expoConfig?.version || '1.0.0',
  
  // Feature Flags
  IS_DEV: __DEV__,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  
  // Timeouts
  API_TIMEOUT: 30000, // 30 seconds
  UPLOAD_TIMEOUT: 60000, // 60 seconds for image uploads
  
  // Limits
  MAX_PHOTO_SIZE_MB: 5,
  MAX_DESCRIPTION_LENGTH: 50,
  REPORT_COOLDOWN_MINUTES: 5,
  MAX_REPORTS_PER_DAY: 10,
  
  // Verification
  MAX_DISTANCE_FROM_REPORT_METERS: 50,
  MIN_TIME_BETWEEN_PHOTOS_MINUTES: 2,
  MAX_TIME_BETWEEN_PHOTOS_MINUTES: 240,
};

export default ENV;
