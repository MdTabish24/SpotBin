/**
 * Feature: cleancity-waste-management
 * Property Tests for Device Fingerprint Generation
 * 
 * Property 3: Device fingerprint generation
 * For any successfully created report, the report SHALL contain a non-empty device fingerprint string.
 * 
 * Validates: Requirements 1.4
 */

import fc from 'fast-check';
import { fingerprintService } from '../../src/services/fingerprint.service';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

// Valid fingerprint: alphanumeric, hyphens, underscores, 16-128 chars
const validFingerprintGenerator = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
  ),
  { minLength: 16, maxLength: 128 }
);

// Too short fingerprint (less than 16 chars)
const tooShortFingerprintGenerator = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ),
  { minLength: 1, maxLength: 15 }
);

// Too long fingerprint (more than 128 chars)
const tooLongFingerprintGenerator = fc.stringOf(
  fc.constantFrom(
    'a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
  ),
  { minLength: 129, maxLength: 256 }
);

// Invalid characters in fingerprint
const invalidCharFingerprintGenerator = fc.tuple(
  fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3'),
    { minLength: 8, maxLength: 60 }
  ),
  fc.constantFrom('@', '#', '$', '%', '^', '&', '*', '!', ' ', '.', '/', '\\'),
  fc.stringOf(
    fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', '0', '1', '2', '3'),
    { minLength: 8, maxLength: 60 }
  )
).map(([prefix, invalidChar, suffix]) => prefix + invalidChar + suffix);

// ============================================
// Property 3: Device fingerprint generation
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 3: Device fingerprint generation', () => {
    /**
     * Property 3: Device fingerprint generation
     * For any successfully created report, the report SHALL contain a non-empty device fingerprint string.
     * Validates: Requirements 1.4
     */

    it('should accept valid device fingerprints (16-128 alphanumeric chars with hyphens/underscores)', () => {
      fc.assert(
        fc.property(validFingerprintGenerator, (fingerprint) => {
          const isValid = fingerprintService.validateFingerprint(fingerprint);
          expect(isValid).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should reject empty fingerprints', () => {
      expect(fingerprintService.validateFingerprint('')).toBe(false);
    });

    it('should reject null/undefined fingerprints', () => {
      expect(fingerprintService.validateFingerprint(null as any)).toBe(false);
      expect(fingerprintService.validateFingerprint(undefined as any)).toBe(false);
    });

    it('should reject fingerprints shorter than 16 characters', () => {
      fc.assert(
        fc.property(tooShortFingerprintGenerator, (fingerprint) => {
          const isValid = fingerprintService.validateFingerprint(fingerprint);
          expect(isValid).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should reject fingerprints longer than 128 characters', () => {
      fc.assert(
        fc.property(tooLongFingerprintGenerator, (fingerprint) => {
          const isValid = fingerprintService.validateFingerprint(fingerprint);
          expect(isValid).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should reject fingerprints with invalid characters', () => {
      fc.assert(
        fc.property(invalidCharFingerprintGenerator, (fingerprint) => {
          const isValid = fingerprintService.validateFingerprint(fingerprint);
          expect(isValid).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should generate consistent hashes for the same fingerprint', () => {
      fc.assert(
        fc.property(validFingerprintGenerator, (fingerprint) => {
          const hash1 = fingerprintService.hashFingerprint(fingerprint);
          const hash2 = fingerprintService.hashFingerprint(fingerprint);
          expect(hash1).toBe(hash2);
        }),
        PBT_CONFIG
      );
    });

    it('should generate different hashes for different fingerprints', () => {
      fc.assert(
        fc.property(
          validFingerprintGenerator,
          validFingerprintGenerator,
          (fp1, fp2) => {
            // Skip if fingerprints happen to be the same
            fc.pre(fp1 !== fp2);
            
            const hash1 = fingerprintService.hashFingerprint(fp1);
            const hash2 = fingerprintService.hashFingerprint(fp2);
            expect(hash1).not.toBe(hash2);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should generate hashes in the expected format (user_XXXXXXXX***)', () => {
      fc.assert(
        fc.property(validFingerprintGenerator, (fingerprint) => {
          const hash = fingerprintService.hashFingerprint(fingerprint);
          expect(hash).toMatch(/^user_[a-f0-9]{8}\*\*\*$/);
        }),
        PBT_CONFIG
      );
    });

    it('should generate server component with consistent format', () => {
      fc.assert(
        fc.property(
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 100 }),
          fc.integer({ min: 0, max: Date.now() }),
          (ip, userAgent, timestamp) => {
            const component = fingerprintService.generateServerComponent(ip, userAgent, timestamp);
            // Should be 16 hex characters
            expect(component).toMatch(/^[a-f0-9]{16}$/);
          }
        ),
        PBT_CONFIG
      );
    });

    it('should generate different server components for different inputs', () => {
      fc.assert(
        fc.property(
          fc.ipV4(),
          fc.ipV4(),
          fc.string({ minLength: 10, maxLength: 50 }),
          fc.integer({ min: 0, max: Date.now() }),
          (ip1, ip2, userAgent, timestamp) => {
            fc.pre(ip1 !== ip2);
            
            const component1 = fingerprintService.generateServerComponent(ip1, userAgent, timestamp);
            const component2 = fingerprintService.generateServerComponent(ip2, userAgent, timestamp);
            expect(component1).not.toBe(component2);
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
