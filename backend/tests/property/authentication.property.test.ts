/**
 * Feature: cleancity-waste-management
 * Property Tests for Worker Authentication
 * 
 * Property 18: JWT token expiry
 * Property 19: OTP validation
 * 
 * Validates: Requirements 6.2, 6.3, 15.2
 */

import fc from 'fast-check';
import {
  generateOtp,
  calculateOtpExpiry,
  isOtpExpired,
  isValidOtpFormat,
  generateJwtToken,
  verifyJwtToken,
  isJwtExpired,
  getJwtExpiryDate,
  getDaysUntilExpiry,
  AUTH_CONFIG
} from '../../src/services/auth.service';

const PBT_CONFIG = { numRuns: 100 };

// ============================================
// Generators
// ============================================

// Valid phone number generator (10-15 digits)
const phoneNumberGenerator = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 10, maxLength: 15 }
);

// Valid OTP generator (6 digits)
const validOtpGenerator = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 6, maxLength: 6 }
);

// Invalid OTP generators
const tooShortOtpGenerator = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 1, maxLength: 5 }
);

const tooLongOtpGenerator = fc.stringOf(
  fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'),
  { minLength: 7, maxLength: 20 }
);

const nonNumericOtpGenerator = fc.stringOf(
  fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'A', 'B', 'C'),
  { minLength: 6, maxLength: 6 }
);

// Worker ID generator (UUID format)
const workerIdGenerator = fc.uuid();

// Role generator
const roleGenerator = fc.constantFrom('worker', 'admin') as fc.Arbitrary<'worker' | 'admin'>;

// ============================================
// Property 18: JWT token expiry
// ============================================

describe('Feature: cleancity-waste-management', () => {
  describe('Property 18: JWT token expiry', () => {
    /**
     * Property 18: JWT token expiry
     * For any JWT token issued by the Auth_Service, the token expiry time
     * SHALL be exactly 7 days from the issuance time.
     * Validates: Requirements 6.2, 15.2
     */

    it('should generate token with exactly 7 days expiry', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, (workerId, phone) => {
          const beforeGeneration = Date.now();
          const result = generateJwtToken(workerId, phone, 'worker');
          const afterGeneration = Date.now();

          // Token should exist
          expect(result.token).toBeDefined();
          expect(typeof result.token).toBe('string');
          expect(result.token.length).toBeGreaterThan(0);

          // Expiry should be approximately 7 days from now
          const expectedExpiryMs = AUTH_CONFIG.jwtExpiryMs;
          const actualExpiryMs = result.expiresAt.getTime() - beforeGeneration;
          
          // Allow 1 second tolerance for test execution time
          expect(actualExpiryMs).toBeGreaterThanOrEqual(expectedExpiryMs - 1000);
          expect(actualExpiryMs).toBeLessThanOrEqual(expectedExpiryMs + (afterGeneration - beforeGeneration) + 1000);

          // ExpiresIn should be 7 days in milliseconds
          expect(result.expiresIn).toBe(AUTH_CONFIG.jwtExpiryMs);
        }),
        PBT_CONFIG
      );
    });

    it('should have JWT expiry of exactly 7 days (604800000 ms)', () => {
      expect(AUTH_CONFIG.jwtExpiryDays).toBe(7);
      expect(AUTH_CONFIG.jwtExpiryMs).toBe(7 * 24 * 60 * 60 * 1000);
      expect(AUTH_CONFIG.jwtExpiryMs).toBe(604800000);
    });

    it('should generate verifiable tokens', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, roleGenerator, (workerId, phone, role) => {
          const result = generateJwtToken(workerId, phone, role);
          const decoded = verifyJwtToken(result.token);

          expect(decoded).not.toBeNull();
          expect(decoded!.sub).toBe(workerId);
          expect(decoded!.phone).toBe(phone);
          expect(decoded!.role).toBe(role);
        }),
        PBT_CONFIG
      );
    });

    it('should have exp claim approximately 7 days from iat', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, (workerId, phone) => {
          const result = generateJwtToken(workerId, phone, 'worker');
          const decoded = verifyJwtToken(result.token);

          expect(decoded).not.toBeNull();
          
          // exp and iat are in seconds
          const expiryDurationSeconds = decoded!.exp - decoded!.iat;
          const expectedDurationSeconds = AUTH_CONFIG.jwtExpiryDays * 24 * 60 * 60;
          
          // Allow 1 second tolerance
          expect(expiryDurationSeconds).toBeGreaterThanOrEqual(expectedDurationSeconds - 1);
          expect(expiryDurationSeconds).toBeLessThanOrEqual(expectedDurationSeconds + 1);
        }),
        PBT_CONFIG
      );
    });

    it('should correctly identify non-expired tokens', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, (workerId, phone) => {
          const result = generateJwtToken(workerId, phone, 'worker');
          
          // Freshly generated token should not be expired
          expect(isJwtExpired(result.token)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should return correct expiry date from token', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, (workerId, phone) => {
          const result = generateJwtToken(workerId, phone, 'worker');
          const expiryDate = getJwtExpiryDate(result.token);

          expect(expiryDate).not.toBeNull();
          // Expiry dates should be within 1 second of each other
          expect(Math.abs(expiryDate!.getTime() - result.expiresAt.getTime())).toBeLessThan(1000);
        }),
        PBT_CONFIG
      );
    });

    it('should return approximately 7 days until expiry for fresh tokens', () => {
      fc.assert(
        fc.property(workerIdGenerator, phoneNumberGenerator, (workerId, phone) => {
          const result = generateJwtToken(workerId, phone, 'worker');
          const daysUntilExpiry = getDaysUntilExpiry(result.token);

          // Should be 6 or 7 days (depending on exact timing)
          expect(daysUntilExpiry).toBeGreaterThanOrEqual(6);
          expect(daysUntilExpiry).toBeLessThanOrEqual(7);
        }),
        PBT_CONFIG
      );
    });

    it('should reject invalid tokens', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 200 }), (invalidToken) => {
          const decoded = verifyJwtToken(invalidToken);
          expect(decoded).toBeNull();
        }),
        PBT_CONFIG
      );
    });

    it('should return null expiry for invalid tokens', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 10, maxLength: 100 }), (invalidToken) => {
          const expiryDate = getJwtExpiryDate(invalidToken);
          expect(expiryDate).toBeNull();
        }),
        PBT_CONFIG
      );
    });
  });

  // ============================================
  // Property 19: OTP validation
  // ============================================

  describe('Property 19: OTP validation', () => {
    /**
     * Property 19: OTP validation
     * For any OTP submission, if the OTP does not match the stored OTP
     * for that phone number OR the OTP has expired, authentication SHALL
     * fail and return an error.
     * Validates: Requirements 6.3
     */

    it('should generate OTP with exactly 6 digits', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const otp = generateOtp();
          expect(otp).toHaveLength(AUTH_CONFIG.otpLength);
          expect(otp).toMatch(/^\d{6}$/);
        }),
        PBT_CONFIG
      );
    });

    it('should generate different OTPs on each call', () => {
      const otps = new Set<string>();
      for (let i = 0; i < 100; i++) {
        otps.add(generateOtp());
      }
      // With 6 digits, probability of collision in 100 samples is very low
      // We expect at least 95 unique OTPs
      expect(otps.size).toBeGreaterThanOrEqual(95);
    });

    it('should validate correct OTP format (6 digits)', () => {
      fc.assert(
        fc.property(validOtpGenerator, (otp) => {
          expect(isValidOtpFormat(otp)).toBe(true);
        }),
        PBT_CONFIG
      );
    });

    it('should reject OTP shorter than 6 digits', () => {
      fc.assert(
        fc.property(tooShortOtpGenerator, (otp) => {
          expect(isValidOtpFormat(otp)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should reject OTP longer than 6 digits', () => {
      fc.assert(
        fc.property(tooLongOtpGenerator, (otp) => {
          expect(isValidOtpFormat(otp)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should reject non-numeric OTP', () => {
      fc.assert(
        fc.property(nonNumericOtpGenerator, (otp) => {
          expect(isValidOtpFormat(otp)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should reject empty or null OTP', () => {
      expect(isValidOtpFormat('')).toBe(false);
      expect(isValidOtpFormat(null as any)).toBe(false);
      expect(isValidOtpFormat(undefined as any)).toBe(false);
    });

    it('should calculate OTP expiry correctly', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 60 }), (minutes) => {
          const beforeCalc = Date.now();
          const expiresAt = calculateOtpExpiry(minutes);
          const afterCalc = Date.now();

          const expectedMinMs = beforeCalc + minutes * 60 * 1000;
          const expectedMaxMs = afterCalc + minutes * 60 * 1000;

          expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinMs);
          expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxMs);
        }),
        PBT_CONFIG
      );
    });

    it('should have default OTP expiry of 5 minutes', () => {
      expect(AUTH_CONFIG.otpExpiryMinutes).toBe(5);
      
      const beforeCalc = Date.now();
      const expiresAt = calculateOtpExpiry();
      
      const expectedMs = beforeCalc + 5 * 60 * 1000;
      expect(Math.abs(expiresAt.getTime() - expectedMs)).toBeLessThan(100);
    });

    it('should correctly identify expired OTPs', () => {
      // Past date should be expired
      const pastDate = new Date(Date.now() - 1000);
      expect(isOtpExpired(pastDate)).toBe(true);

      // Future date should not be expired
      const futureDate = new Date(Date.now() + 60000);
      expect(isOtpExpired(futureDate)).toBe(false);
    });

    it('should correctly identify non-expired OTPs', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 60 }), (minutesInFuture) => {
          const expiresAt = new Date(Date.now() + minutesInFuture * 60 * 1000);
          expect(isOtpExpired(expiresAt)).toBe(false);
        }),
        PBT_CONFIG
      );
    });

    it('should have max OTP attempts of 3', () => {
      expect(AUTH_CONFIG.maxOtpAttempts).toBe(3);
    });

    it('should have OTP length of 6', () => {
      expect(AUTH_CONFIG.otpLength).toBe(6);
    });
  });

  // ============================================
  // Authentication configuration tests
  // ============================================

  describe('Authentication configuration', () => {
    it('should have all required configuration values', () => {
      expect(AUTH_CONFIG.otpLength).toBeDefined();
      expect(AUTH_CONFIG.otpExpiryMinutes).toBeDefined();
      expect(AUTH_CONFIG.maxOtpAttempts).toBeDefined();
      expect(AUTH_CONFIG.jwtExpiryDays).toBeDefined();
      expect(AUTH_CONFIG.jwtExpiryMs).toBeDefined();
    });

    it('should have consistent JWT expiry values', () => {
      const daysInMs = AUTH_CONFIG.jwtExpiryDays * 24 * 60 * 60 * 1000;
      expect(AUTH_CONFIG.jwtExpiryMs).toBe(daysInMs);
    });

    it('should have reasonable security defaults', () => {
      // OTP should be at least 6 digits for security
      expect(AUTH_CONFIG.otpLength).toBeGreaterThanOrEqual(6);
      
      // OTP should expire within reasonable time (1-30 minutes)
      expect(AUTH_CONFIG.otpExpiryMinutes).toBeGreaterThanOrEqual(1);
      expect(AUTH_CONFIG.otpExpiryMinutes).toBeLessThanOrEqual(30);
      
      // Max attempts should be limited (1-5)
      expect(AUTH_CONFIG.maxOtpAttempts).toBeGreaterThanOrEqual(1);
      expect(AUTH_CONFIG.maxOtpAttempts).toBeLessThanOrEqual(5);
      
      // JWT should expire within reasonable time (1-30 days)
      expect(AUTH_CONFIG.jwtExpiryDays).toBeGreaterThanOrEqual(1);
      expect(AUTH_CONFIG.jwtExpiryDays).toBeLessThanOrEqual(30);
    });
  });
});
