/**
 * CleanCity Design System - Professional Theme
 * Inspired by top product companies like Uber, Airbnb, Swiggy
 */

export const COLORS = {
  // Primary brand colors
  primary: '#10B981',
  primaryLight: '#D1FAE5',
  primaryDark: '#059669',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Status colors
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',
  
  // Rank colors
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  display: 32,
  hero: 40,
};

export const FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
};

// Badge configuration
export const BADGES = {
  'Cleanliness Rookie': { icon: '🌱', color: '#10B981', bgColor: '#D1FAE5' },
  'Eco Warrior': { icon: '🌿', color: '#059669', bgColor: '#A7F3D0' },
  'Community Champion': { icon: '🏆', color: '#F59E0B', bgColor: '#FEF3C7' },
  'Cleanup Legend': { icon: '👑', color: '#8B5CF6', bgColor: '#EDE9FE' },
};

// Status configuration
export const STATUS_CONFIG = {
  open: { 
    color: '#EF4444', 
    bgColor: '#FEE2E2', 
    icon: 'time-outline', 
    label: 'Pending',
    description: 'Waiting for assignment'
  },
  assigned: { 
    color: '#F59E0B', 
    bgColor: '#FEF3C7', 
    icon: 'person-outline', 
    label: 'Assigned',
    description: 'Worker assigned'
  },
  in_progress: { 
    color: '#3B82F6', 
    bgColor: '#DBEAFE', 
    icon: 'construct-outline', 
    label: 'In Progress',
    description: 'Cleanup in progress'
  },
  verified: { 
    color: '#8B5CF6', 
    bgColor: '#EDE9FE', 
    icon: 'checkmark-circle-outline', 
    label: 'Verified',
    description: 'Cleanup verified'
  },
  resolved: { 
    color: '#10B981', 
    bgColor: '#D1FAE5', 
    icon: 'checkmark-done-outline', 
    label: 'Resolved',
    description: 'Cleanup complete'
  },
};

export default {
  COLORS,
  SPACING,
  FONT_SIZES,
  FONT_WEIGHTS,
  BORDER_RADIUS,
  SHADOWS,
  BADGES,
  STATUS_CONFIG,
};
