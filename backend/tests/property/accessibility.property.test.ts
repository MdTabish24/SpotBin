/**
 * Feature: cleancity-waste-management
 * Property Tests for Accessibility
 * 
 * Property 37: Touch target size validation
 * Property 38: Color contrast ratio validation
 * 
 * Validates: Requirements 16.3, 16.4
 */

import fc from 'fast-check';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Constants (matching accessibility.ts)
// ============================================

const MIN_TOUCH_TARGET_SIZE = 44;
const MIN_CONTRAST_RATIO_NORMAL = 4.5;
const MIN_CONTRAST_RATIO_LARGE = 3.0;

// ============================================
// Utility Functions (matching accessibility.ts)
// ============================================

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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
 * Calculate relative luminance of a color
 */
function getLuminance(hex: string): number {
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
 */
function getContrastRatio(foreground: string, background: string): number {
  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
function meetsContrastRequirement(
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const minRatio = isLargeText ? MIN_CONTRAST_RATIO_LARGE : MIN_CONTRAST_RATIO_NORMAL;
  return ratio >= minRatio;
}

/**
 * Validate touch target size
 */
function isValidTouchTarget(width: number, height: number): boolean {
  return width >= MIN_TOUCH_TARGET_SIZE && height >= MIN_TOUCH_TARGET_SIZE;
}

// ============================================
// Generators
// ============================================

// Valid touch target sizes (>= 44px)
const validTouchTargetSizeGenerator = fc.integer({ min: 44, max: 500 });

// Invalid touch target sizes (< 44px)
const invalidTouchTargetSizeGenerator = fc.integer({ min: 1, max: 43 });

// Generate valid hex color
const hexColorGenerator = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([r, g, b]) => {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
});

// High contrast color pairs (guaranteed to pass 4.5:1)
const highContrastPairGenerator = fc.constantFrom(
  { foreground: '#000000', background: '#FFFFFF' }, // 21:1
  { foreground: '#111827', background: '#FFFFFF' }, // ~16:1
  { foreground: '#FFFFFF', background: '#000000' }, // 21:1
  { foreground: '#047857', background: '#FFFFFF' }, // ~5.5:1
  { foreground: '#991B1B', background: '#FEE2E2' }, // ~7:1
  { foreground: '#065F46', background: '#D1FAE5' }, // ~7:1
  { foreground: '#92400E', background: '#FEF3C7' }, // ~5.5:1
);

// Low contrast color pairs (guaranteed to fail 4.5:1)
const lowContrastPairGenerator = fc.constantFrom(
  { foreground: '#CCCCCC', background: '#FFFFFF' }, // ~1.6:1
  { foreground: '#AAAAAA', background: '#BBBBBB' }, // ~1.1:1
  { foreground: '#10B981', background: '#FFFFFF' }, // ~3:1 (fails normal, passes large)
  { foreground: '#FBBF24', background: '#FFFFFF' }, // ~1.7:1
  { foreground: '#60A5FA', background: '#FFFFFF' }, // ~2.5:1
);

// ============================================
// Property 37: Touch target size validation
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 37: Touch target size validation', () => {
    /**
     * Property 37: Touch target size
     * For any interactive UI element (buttons, links, form controls),
     * the touch target size SHALL be at least 44×44 pixels.
     * Validates: Requirements 16.3
     */
    it('should accept touch targets >= 44x44 pixels', () => {
      fc.assert(
        fc.property(
          validTouchTargetSizeGenerator,
          validTouchTargetSizeGenerator,
          (width, height) => {
            const result = isValidTouchTarget(width, height);
            expect(result).toBe(true);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject touch targets with width < 44 pixels', () => {
      fc.assert(
        fc.property(
          invalidTouchTargetSizeGenerator,
          validTouchTargetSizeGenerator,
          (width, height) => {
            const result = isValidTouchTarget(width, height);
            expect(result).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject touch targets with height < 44 pixels', () => {
      fc.assert(
        fc.property(
          validTouchTargetSizeGenerator,
          invalidTouchTargetSizeGenerator,
          (width, height) => {
            const result = isValidTouchTarget(width, height);
            expect(result).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should reject touch targets with both dimensions < 44 pixels', () => {
      fc.assert(
        fc.property(
          invalidTouchTargetSizeGenerator,
          invalidTouchTargetSizeGenerator,
          (width, height) => {
            const result = isValidTouchTarget(width, height);
            expect(result).toBe(false);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should accept exactly 44x44 pixel touch targets', () => {
      expect(isValidTouchTarget(44, 44)).toBe(true);
    });

    it('should reject 43x43 pixel touch targets', () => {
      expect(isValidTouchTarget(43, 43)).toBe(false);
    });

    it('should handle edge case of 44x43 (one dimension invalid)', () => {
      expect(isValidTouchTarget(44, 43)).toBe(false);
      expect(isValidTouchTarget(43, 44)).toBe(false);
    });
  });

  // ============================================
  // Property 38: Color contrast ratio validation
  // ============================================

  describe('Property 38: Color contrast ratio validation', () => {
    /**
     * Property 38: Color contrast ratio
     * For any text displayed against a background, the color contrast ratio
     * SHALL be at least 4.5:1 for normal text and 3:1 for large text.
     * Validates: Requirements 16.4
     */
    it('should correctly calculate contrast ratio for high contrast pairs', () => {
      fc.assert(
        fc.property(highContrastPairGenerator, ({ foreground, background }) => {
          const ratio = getContrastRatio(foreground, background);
          expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO_NORMAL);
        }),
        PBT_CONFIG
      );
    });

    it('should correctly identify high contrast pairs as meeting requirements', () => {
      fc.assert(
        fc.property(highContrastPairGenerator, ({ foreground, background }) => {
          const meetsRequirement = meetsContrastRequirement(foreground, background, false);
          expect(meetsRequirement).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should correctly identify low contrast pairs as failing normal text requirements', () => {
      fc.assert(
        fc.property(lowContrastPairGenerator, ({ foreground, background }) => {
          const meetsRequirement = meetsContrastRequirement(foreground, background, false);
          expect(meetsRequirement).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should have lower threshold (3:1) for large text', () => {
      // #757575 on white has ~4.6:1 contrast - passes both
      // #808080 on white has ~3.9:1 contrast - passes large text (3:1), fails normal (4.5:1)
      const ratio = getContrastRatio('#808080', '#FFFFFF');
      expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO_LARGE);
      expect(ratio).toBeLessThan(MIN_CONTRAST_RATIO_NORMAL);
      
      expect(meetsContrastRequirement('#808080', '#FFFFFF', true)).toBe(true);
      expect(meetsContrastRequirement('#808080', '#FFFFFF', false)).toBe(false);
    });

    it('should return maximum contrast (21:1) for black on white', () => {
      const ratio = getContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21, 0);
    });

    it('should return minimum contrast (1:1) for same colors', () => {
      fc.assert(
        fc.property(hexColorGenerator, (color) => {
          const ratio = getContrastRatio(color, color);
          expect(ratio).toBeCloseTo(1, 5);
        }),
        PBT_CONFIG
      );
    });

    it('should be symmetric (A on B equals B on A)', () => {
      fc.assert(
        fc.property(hexColorGenerator, hexColorGenerator, (color1, color2) => {
          const ratio1 = getContrastRatio(color1, color2);
          const ratio2 = getContrastRatio(color2, color1);
          expect(ratio1).toBeCloseTo(ratio2, 10);
        }),
        PBT_CONFIG
      );
    });

    it('should always return ratio >= 1', () => {
      fc.assert(
        fc.property(hexColorGenerator, hexColorGenerator, (color1, color2) => {
          const ratio = getContrastRatio(color1, color2);
          expect(ratio).toBeGreaterThanOrEqual(1);
        }),
        PBT_CONFIG
      );
    });

    it('should always return ratio <= 21', () => {
      fc.assert(
        fc.property(hexColorGenerator, hexColorGenerator, (color1, color2) => {
          const ratio = getContrastRatio(color1, color2);
          expect(ratio).toBeLessThanOrEqual(21);
        }),
        PBT_CONFIG
      );
    });

    it('should validate design system colors meet requirements', () => {
      // Test the accessible color palette from accessibility.ts
      const designSystemColors = [
        { foreground: '#047857', background: '#FFFFFF', name: 'primary' },
        { foreground: '#065F46', background: '#FFFFFF', name: 'primaryDark' },
        { foreground: '#DC2626', background: '#FFFFFF', name: 'danger' },
        { foreground: '#B45309', background: '#FFFFFF', name: 'warning' },
        { foreground: '#0369A1', background: '#FFFFFF', name: 'info' },
        { foreground: '#111827', background: '#FFFFFF', name: 'textPrimary' },
        { foreground: '#4B5563', background: '#FFFFFF', name: 'textSecondary' },
        { foreground: '#6B7280', background: '#FFFFFF', name: 'textMuted' },
      ];

      for (const { foreground, background, name } of designSystemColors) {
        const ratio = getContrastRatio(foreground, background);
        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO_NORMAL);
      }
    });

    it('should validate status colors meet requirements', () => {
      const statusColors = [
        { foreground: '#991B1B', background: '#FEE2E2', name: 'open' },
        { foreground: '#92400E', background: '#FEF3C7', name: 'assigned' },
        { foreground: '#065F46', background: '#D1FAE5', name: 'resolved' },
      ];

      for (const { foreground, background, name } of statusColors) {
        const ratio = getContrastRatio(foreground, background);
        expect(ratio).toBeGreaterThanOrEqual(MIN_CONTRAST_RATIO_NORMAL);
      }
    });
  });

  // ============================================
  // Luminance Calculation Tests
  // ============================================

  describe('Luminance calculation', () => {
    it('should return 0 for black', () => {
      expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    });

    it('should return 1 for white', () => {
      expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    });

    it('should return values between 0 and 1', () => {
      fc.assert(
        fc.property(hexColorGenerator, (color) => {
          const luminance = getLuminance(color);
          expect(luminance).toBeGreaterThanOrEqual(0);
          expect(luminance).toBeLessThanOrEqual(1);
        }),
        PBT_CONFIG
      );
    });

    it('should handle lowercase and uppercase hex', () => {
      expect(getLuminance('#ffffff')).toBeCloseTo(getLuminance('#FFFFFF'), 10);
      expect(getLuminance('#aabbcc')).toBeCloseTo(getLuminance('#AABBCC'), 10);
    });
  });
});
