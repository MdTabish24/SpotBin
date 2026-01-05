/**
 * CleanCity - Validation Utilities
 * Requirements: 1.3, 1.5, 1.6, 2.4
 */

import { GeoLocation, RATE_LIMIT_CONFIG } from '../types';

// ============================================
// GPS Coordinate Validation (Requirement 1.3)
// ============================================

export interface GpsValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates GPS coordinates are within valid ranges
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 * Accuracy: non-negative number
 */
export function validateGpsCoordinates(
  lat: number,
  lng: number,
  accuracy?: number
): GpsValidationResult {
  const errors: string[] = [];

  // Check latitude
  if (typeof lat !== 'number' || isNaN(lat)) {
    errors.push('Latitude must be a valid number');
  } else if (lat < -90 || lat > 90) {
    errors.push('Latitude must be between -90 and 90');
  }

  // Check longitude
  if (typeof lng !== 'number' || isNaN(lng)) {
    errors.push('Longitude must be a valid number');
  } else if (lng < -180 || lng > 180) {
    errors.push('Longitude must be between -180 and 180');
  }

  // Check accuracy if provided
  if (accuracy !== undefined) {
    if (typeof accuracy !== 'number' || isNaN(accuracy)) {
      errors.push('Accuracy must be a valid number');
    } else if (accuracy < 0) {
      errors.push('Accuracy must be non-negative');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates a GeoLocation object
 */
export function validateGeoLocation(location: GeoLocation): GpsValidationResult {
  if (!location || typeof location !== 'object') {
    return {
      isValid: false,
      errors: ['Location must be a valid object']
    };
  }

  return validateGpsCoordinates(location.lat, location.lng, location.accuracy);
}

// ============================================
// Description Validation (Requirement 1.6)
// ============================================

export interface DescriptionValidationResult {
  isValid: boolean;
  sanitized: string | undefined;
  error?: string;
}

const MAX_DESCRIPTION_LENGTH = 50;

/**
 * Validates and sanitizes description
 * Max 50 characters, trims whitespace
 */
export function validateDescription(
  description: string | undefined | null
): DescriptionValidationResult {
  // Undefined/null is valid (optional field)
  if (description === undefined || description === null) {
    return {
      isValid: true,
      sanitized: undefined
    };
  }

  // Must be a string
  if (typeof description !== 'string') {
    return {
      isValid: false,
      sanitized: undefined,
      error: 'Description must be a string'
    };
  }

  // Trim whitespace
  const trimmed = description.trim();

  // Empty string after trim is valid (treated as no description)
  if (trimmed.length === 0) {
    return {
      isValid: true,
      sanitized: undefined
    };
  }

  // Check length
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    return {
      isValid: false,
      sanitized: trimmed.substring(0, MAX_DESCRIPTION_LENGTH),
      error: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
    };
  }

  return {
    isValid: true,
    sanitized: trimmed
  };
}

// ============================================
// Photo Timestamp Validation (Requirement 1.5, 2.4)
// ============================================

export interface TimestampValidationResult {
  isValid: boolean;
  error?: string;
  ageInMinutes?: number;
}

/**
 * Validates that photo timestamp is within the last 5 minutes
 */
export function validatePhotoTimestamp(
  photoTimestamp: Date | string | number,
  currentTime: Date = new Date()
): TimestampValidationResult {
  // Convert to Date if needed
  let timestamp: Date;
  
  if (photoTimestamp instanceof Date) {
    timestamp = photoTimestamp;
  } else if (typeof photoTimestamp === 'string' || typeof photoTimestamp === 'number') {
    timestamp = new Date(photoTimestamp);
  } else {
    return {
      isValid: false,
      error: 'Invalid timestamp format'
    };
  }

  // Check if valid date
  if (isNaN(timestamp.getTime())) {
    return {
      isValid: false,
      error: 'Invalid timestamp format'
    };
  }

  // Check if timestamp is in the future
  if (timestamp > currentTime) {
    return {
      isValid: false,
      error: 'Photo timestamp cannot be in the future',
      ageInMinutes: 0
    };
  }

  // Calculate age in minutes
  const ageInMs = currentTime.getTime() - timestamp.getTime();
  const ageInMinutes = ageInMs / (1000 * 60);

  // Check if within allowed window
  if (ageInMinutes > RATE_LIMIT_CONFIG.maxPhotoAgeMinutes) {
    return {
      isValid: false,
      error: `Photo must be taken within the last ${RATE_LIMIT_CONFIG.maxPhotoAgeMinutes} minutes`,
      ageInMinutes
    };
  }

  return {
    isValid: true,
    ageInMinutes
  };
}

// ============================================
// Distance Calculation (Haversine Formula)
// ============================================

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates the distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates distance between two GeoLocation objects
 */
export function calculateDistanceBetweenLocations(
  location1: GeoLocation,
  location2: GeoLocation
): number {
  return calculateDistance(
    location1.lat,
    location1.lng,
    location2.lat,
    location2.lng
  );
}

/**
 * Checks if two locations are within a specified radius
 */
export function isWithinRadius(
  location1: GeoLocation,
  location2: GeoLocation,
  radiusMeters: number
): boolean {
  const distance = calculateDistanceBetweenLocations(location1, location2);
  return distance <= radiusMeters;
}

// ============================================
// Device Fingerprint Validation
// ============================================

export interface DeviceFingerprintValidationResult {
  isValid: boolean;
  error?: string;
}

const MIN_FINGERPRINT_LENGTH = 16;
const MAX_FINGERPRINT_LENGTH = 128;

/**
 * Validates device fingerprint format
 */
export function validateDeviceFingerprint(
  fingerprint: string | undefined | null
): DeviceFingerprintValidationResult {
  if (fingerprint === undefined || fingerprint === null) {
    return {
      isValid: false,
      error: 'Device fingerprint is required'
    };
  }

  if (typeof fingerprint !== 'string') {
    return {
      isValid: false,
      error: 'Device fingerprint must be a string'
    };
  }

  const trimmed = fingerprint.trim();

  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Device fingerprint cannot be empty'
    };
  }

  if (trimmed.length < MIN_FINGERPRINT_LENGTH) {
    return {
      isValid: false,
      error: `Device fingerprint must be at least ${MIN_FINGERPRINT_LENGTH} characters`
    };
  }

  if (trimmed.length > MAX_FINGERPRINT_LENGTH) {
    return {
      isValid: false,
      error: `Device fingerprint must not exceed ${MAX_FINGERPRINT_LENGTH} characters`
    };
  }

  return {
    isValid: true
  };
}

// ============================================
// Combined Report Validation
// ============================================

export interface ReportValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedDescription?: string;
}

export interface ReportValidationInput {
  lat: number;
  lng: number;
  accuracy?: number;
  description?: string;
  timestamp: Date | string | number;
  deviceId: string;
}

/**
 * Validates all report input fields
 */
export function validateReportInput(
  input: ReportValidationInput
): ReportValidationResult {
  const errors: string[] = [];
  let sanitizedDescription: string | undefined;

  // Validate GPS coordinates
  const gpsResult = validateGpsCoordinates(input.lat, input.lng, input.accuracy);
  if (!gpsResult.isValid) {
    errors.push(...gpsResult.errors);
  }

  // Validate description
  const descResult = validateDescription(input.description);
  if (!descResult.isValid && descResult.error) {
    errors.push(descResult.error);
  }
  sanitizedDescription = descResult.sanitized;

  // Validate timestamp
  const timestampResult = validatePhotoTimestamp(input.timestamp);
  if (!timestampResult.isValid && timestampResult.error) {
    errors.push(timestampResult.error);
  }

  // Validate device fingerprint
  const fingerprintResult = validateDeviceFingerprint(input.deviceId);
  if (!fingerprintResult.isValid && fingerprintResult.error) {
    errors.push(fingerprintResult.error);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedDescription
  };
}
