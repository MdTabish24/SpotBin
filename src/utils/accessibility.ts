/**
 * Accessibility utilities for CleanCity app
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

// Minimum touch target size per WCAG 2.1 guidelines
export const MIN_TOUCH_TARGET_SIZE = 44;

// Color contrast requirements
export const MIN_CONTRAST_RATIO_NORMAL = 4.5;
export const MIN_CONTRAST_RATIO_LARGE = 3.0;

/**
 * Design system colors with accessibility-compliant contrast ratios
 * All colors meet WCAG 2.1 Level AA requirements (4.5:1 for normal text)
 */
export const accessibleColors = {
  // Primary colors - Green theme (WCAG AA compliant)
  primary: '#047857', // Contrast ratio 5.5:1 on white - meets AA
  primaryDark: '#065F46', // Contrast ratio 7:1 on white
  primaryLight: '#10B981', // Use only for large text or decorative (3:1)

  // Status colors
  success: '#047857', // 5.5:1 on white - meets AA
  warning: '#B45309', // 4.5:1 on white
  danger: '#DC2626', // 4.5:1 on white
  info: '#0369A1', // 4.5:1 on white (darker blue)

  // Text colors
  textPrimary: '#111827', // 16:1 on white
  textSecondary: '#4B5563', // 7:1 on white
  textMuted: '#6B7280', // 4.5:1 on white

  // Background colors
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  backgroundTertiary: '#F3F4F6',

  // Border colors
  border: '#D1D5DB',
  borderFocus: '#059669',
};

/**
 * Calculate relative luminance of a color
 * @param hex - Hex color string (e.g., '#FFFFFF')
 */
export function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * @param foreground - Foreground color hex
 * @param background - Background color hex
 * @returns Contrast ratio (1 to 21)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 * @param foreground - Foreground color hex
 * @param background - Background color hex
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 */
export function meetsContrastRequirement(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const minRatio = isLargeText ? MIN_CONTRAST_RATIO_LARGE : MIN_CONTRAST_RATIO_NORMAL;
  return ratio >= minRatio;
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}


/**
 * Validate touch target size
 * @param width - Element width in pixels
 * @param height - Element height in pixels
 */
export function isValidTouchTarget(width: number, height: number): boolean {
  return width >= MIN_TOUCH_TARGET_SIZE && height >= MIN_TOUCH_TARGET_SIZE;
}

/**
 * Get accessible touch target style
 * Ensures minimum 44x44px touch target
 */
export function getAccessibleTouchTargetStyle(
  currentWidth?: number,
  currentHeight?: number
): { minWidth: number; minHeight: number } {
  return {
    minWidth: Math.max(currentWidth || 0, MIN_TOUCH_TARGET_SIZE),
    minHeight: Math.max(currentHeight || 0, MIN_TOUCH_TARGET_SIZE),
  };
}

/**
 * Generate accessibility props for interactive elements
 */
export interface AccessibilityProps {
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole: 'button' | 'link' | 'checkbox' | 'radio' | 'tab' | 'menuitem' | 'image' | 'text' | 'header' | 'search' | 'switch' | 'adjustable' | 'imagebutton' | 'keyboardkey' | 'progressbar' | 'scrollbar' | 'spinbutton' | 'timer' | 'toolbar' | 'none';
  accessibilityState?: {
    disabled?: boolean;
    selected?: boolean;
    checked?: boolean | 'mixed';
    busy?: boolean;
    expanded?: boolean;
  };
}

/**
 * Create accessibility props for a button
 */
export function createButtonAccessibilityProps(
  label: string,
  hint?: string,
  disabled?: boolean
): AccessibilityProps {
  return {
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: 'button',
    accessibilityState: { disabled },
  };
}

/**
 * Create accessibility props for an image
 */
export function createImageAccessibilityProps(
  label: string
): Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityRole'> {
  return {
    accessibilityLabel: label,
    accessibilityRole: 'image',
  };
}

/**
 * Create accessibility props for a link
 */
export function createLinkAccessibilityProps(
  label: string,
  hint?: string
): AccessibilityProps {
  return {
    accessibilityLabel: label,
    accessibilityHint: hint || 'Double tap to open',
    accessibilityRole: 'link',
  };
}

/**
 * Status colors with accessible alternatives
 */
export const statusColors = {
  open: {
    background: '#FEE2E2', // Light red
    text: '#991B1B', // Dark red - 7:1 contrast
    border: '#FECACA',
  },
  assigned: {
    background: '#FEF3C7', // Light amber
    text: '#92400E', // Dark amber - 5.5:1 contrast
    border: '#FDE68A',
  },
  in_progress: {
    background: '#FEF3C7', // Light amber
    text: '#92400E', // Dark amber - 5.5:1 contrast
    border: '#FDE68A',
  },
  verified: {
    background: '#D1FAE5', // Light green
    text: '#065F46', // Dark green - 7:1 contrast
    border: '#A7F3D0',
  },
  resolved: {
    background: '#D1FAE5', // Light green
    text: '#065F46', // Dark green - 7:1 contrast
    border: '#A7F3D0',
  },
};

export default {
  MIN_TOUCH_TARGET_SIZE,
  MIN_CONTRAST_RATIO_NORMAL,
  MIN_CONTRAST_RATIO_LARGE,
  accessibleColors,
  statusColors,
  getLuminance,
  getContrastRatio,
  meetsContrastRequirement,
  hexToRgb,
  isValidTouchTarget,
  getAccessibleTouchTargetStyle,
  createButtonAccessibilityProps,
  createImageAccessibilityProps,
  createLinkAccessibilityProps,
};
