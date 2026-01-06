/**
 * Feature: cleancity-waste-management
 * Property Tests for Internationalization (i18n)
 * 
 * Property 39: Internationalization completeness
 * 
 * Validates: Requirements 16.5
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Load Translation Files
// ============================================

const localesPath = path.join(__dirname, '../../../src/i18n/locales');

// Load translation files
let enTranslations: Record<string, unknown> = {};
let hiTranslations: Record<string, unknown> = {};

try {
  enTranslations = JSON.parse(
    fs.readFileSync(path.join(localesPath, 'en.json'), 'utf-8')
  );
  hiTranslations = JSON.parse(
    fs.readFileSync(path.join(localesPath, 'hi.json'), 'utf-8')
  );
} catch (error) {
  console.warn('Could not load translation files, using empty objects');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all translation keys from a nested object
 */
function getAllTranslationKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getAllTranslationKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Get value at a nested key path
 */
function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Validate that all keys exist in both languages
 */
function validateTranslations(): { missing: { en: string[]; hi: string[] } } {
  const enKeys = getAllTranslationKeys(enTranslations);
  const hiKeys = getAllTranslationKeys(hiTranslations);

  const missingInHi = enKeys.filter((key) => !hiKeys.includes(key));
  const missingInEn = hiKeys.filter((key) => !enKeys.includes(key));

  return {
    missing: {
      en: missingInEn,
      hi: missingInHi,
    },
  };
}

// ============================================
// Generators
// ============================================

// Get all English keys for property testing
const enKeys = getAllTranslationKeys(enTranslations);
const hiKeys = getAllTranslationKeys(hiTranslations);

// Generator for English translation keys
const enKeyGenerator = enKeys.length > 0 
  ? fc.constantFrom(...enKeys)
  : fc.constant('common.loading');

// Generator for Hindi translation keys
const hiKeyGenerator = hiKeys.length > 0
  ? fc.constantFrom(...hiKeys)
  : fc.constant('common.loading');

// ============================================
// Property 39: Internationalization completeness
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 39: Internationalization completeness', () => {
    /**
     * Property 39: Internationalization completeness
     * For any user-facing text string in the application,
     * translations SHALL exist for both English and Hindi languages.
     * Validates: Requirements 16.5
     */
    
    it('should have translation files loaded', () => {
      expect(Object.keys(enTranslations).length).toBeGreaterThan(0);
      expect(Object.keys(hiTranslations).length).toBeGreaterThan(0);
    });

    it('should have all English keys present in Hindi translations', () => {
      fc.assert(
        fc.property(enKeyGenerator, (key) => {
          const hiValue = getNestedValue(hiTranslations, key);
          expect(hiValue).toBeDefined();
          expect(typeof hiValue).toBe('string');
          expect((hiValue as string).length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have all Hindi keys present in English translations', () => {
      fc.assert(
        fc.property(hiKeyGenerator, (key) => {
          const enValue = getNestedValue(enTranslations, key);
          expect(enValue).toBeDefined();
          expect(typeof enValue).toBe('string');
          expect((enValue as string).length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    it('should have no missing translations in either language', () => {
      const validation = validateTranslations();
      
      expect(validation.missing.en).toHaveLength(0);
      expect(validation.missing.hi).toHaveLength(0);
    });

    it('should have same number of keys in both languages', () => {
      expect(enKeys.length).toBe(hiKeys.length);
    });

    it('should have same key structure in both languages', () => {
      const enKeySet = new Set(enKeys);
      const hiKeySet = new Set(hiKeys);
      
      // Check that all English keys exist in Hindi
      for (const key of enKeys) {
        expect(hiKeySet.has(key)).toBe(true);
      }
      
      // Check that all Hindi keys exist in English
      for (const key of hiKeys) {
        expect(enKeySet.has(key)).toBe(true);
      }
    });

    it('should have non-empty string values for all translations', () => {
      fc.assert(
        fc.property(enKeyGenerator, (key) => {
          const enValue = getNestedValue(enTranslations, key);
          const hiValue = getNestedValue(hiTranslations, key);
          
          expect(typeof enValue).toBe('string');
          expect(typeof hiValue).toBe('string');
          expect((enValue as string).trim().length).toBeGreaterThan(0);
          expect((hiValue as string).trim().length).toBeGreaterThan(0);
        }),
        PBT_CONFIG
      );
    });

    // ============================================
    // Required Translation Categories
    // ============================================

    it('should have common translations', () => {
      const requiredCommonKeys = [
        'common.loading',
        'common.error',
        'common.success',
        'common.cancel',
        'common.confirm',
        'common.save',
        'common.close',
        'common.back',
        'common.submit',
        'common.retry',
      ];

      for (const key of requiredCommonKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have authentication translations', () => {
      const requiredAuthKeys = [
        'auth.login',
        'auth.logout',
        'auth.phoneNumber',
        'auth.sendOtp',
        'auth.verifyOtp',
      ];

      for (const key of requiredAuthKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have citizen app translations', () => {
      const requiredCitizenKeys = [
        'citizen.reportWaste',
        'citizen.capturePhoto',
        'citizen.submitReport',
        'citizen.myReports',
      ];

      for (const key of requiredCitizenKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have worker app translations', () => {
      const requiredWorkerKeys = [
        'worker.tasks',
        'worker.myTasks',
        'worker.startTask',
        'worker.completeTask',
      ];

      for (const key of requiredWorkerKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have status translations', () => {
      const requiredStatusKeys = [
        'status.open',
        'status.assigned',
        'status.inProgress',
        'status.verified',
        'status.resolved',
      ];

      for (const key of requiredStatusKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have error translations', () => {
      const requiredErrorKeys = [
        'errors.networkError',
        'errors.serverError',
        'errors.photoRequired',
        'errors.locationRequired',
      ];

      for (const key of requiredErrorKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have accessibility translations', () => {
      const requiredA11yKeys = [
        'accessibility.capturePhotoButton',
        'accessibility.submitReportButton',
        'accessibility.closeModal',
      ];

      for (const key of requiredA11yKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    it('should have badge translations', () => {
      const requiredBadgeKeys = [
        'badges.cleanlinessRookie',
        'badges.ecoWarrior',
        'badges.communityChampion',
        'badges.cleanupLegend',
      ];

      for (const key of requiredBadgeKeys) {
        expect(getNestedValue(enTranslations, key)).toBeDefined();
        expect(getNestedValue(hiTranslations, key)).toBeDefined();
      }
    });

    // ============================================
    // Translation Quality Checks
    // ============================================

    it('should have different values for English and Hindi (not just copied)', () => {
      // Sample some keys to verify translations are actually different
      const sampleKeys = [
        'common.loading',
        'common.error',
        'citizen.reportWaste',
        'worker.tasks',
        'status.open',
      ];

      for (const key of sampleKeys) {
        const enValue = getNestedValue(enTranslations, key);
        const hiValue = getNestedValue(hiTranslations, key);
        
        // Hindi translations should be different from English
        // (unless they're proper nouns or technical terms)
        expect(enValue).not.toBe(hiValue);
      }
    });

    it('should preserve interpolation placeholders in translations', () => {
      // Keys that use interpolation
      const interpolationKeys = [
        'citizen.estimatedCleanup',
        'citizen.reportStatus',
        'citizen.reportedOn',
        'citizen.pointsEarned',
        'auth.resendIn',
        'errors.cooldownActive',
        'worker.distanceAway',
        'worker.estimatedTime',
      ];

      for (const key of interpolationKeys) {
        const enValue = getNestedValue(enTranslations, key) as string;
        const hiValue = getNestedValue(hiTranslations, key) as string;
        
        if (enValue && hiValue) {
          // Extract placeholders like {{time}}, {{date}}, etc.
          const enPlaceholders = enValue.match(/\{\{[^}]+\}\}/g) || [];
          const hiPlaceholders = hiValue.match(/\{\{[^}]+\}\}/g) || [];
          
          // Both should have the same placeholders
          expect(enPlaceholders.sort()).toEqual(hiPlaceholders.sort());
        }
      }
    });
  });
});
