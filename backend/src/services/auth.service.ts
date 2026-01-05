/**
 * Authentication Service - OTP and JWT based authentication
 * Requirements: 6.1, 6.2, 6.3, 15.2
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../db/pool';
import { config } from '../config/env';
import { logger } from '../config/logger';
import { Worker, OtpRecord } from '../types';

// ============================================
// Constants
// ============================================

export const AUTH_CONFIG = {
  otpLength: 6,
  otpExpiryMinutes: 5,
  maxOtpAttempts: 3,
  jwtExpiryDays: 7,
  jwtExpiryMs: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
} as const;

// ============================================
// Types
// ============================================

export interface OtpGenerationResult {
  otp: string;
  expiresAt: Date;
}

export interface OtpValidationResult {
  isValid: boolean;
  error?: string;
  attemptsRemaining?: number;
}

export interface JwtPayload {
  sub: string; // worker ID or admin ID
  phone?: string;
  role: 'worker' | 'admin';
  iat: number;
  exp: number;
}

export interface TokenGenerationResult {
  token: string;
  expiresAt: Date;
  expiresIn: number; // milliseconds
}

export interface AuthResult {
  success: boolean;
  token?: string;
  worker?: Worker;
  error?: string;
  expiresAt?: Date;
}

// ============================================
// OTP Functions
// ============================================

/**
 * Generate a random OTP
 */
export function generateOtp(length: number = AUTH_CONFIG.otpLength): string {
  // Generate cryptographically secure random digits
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  
  return otp;
}

/**
 * Calculate OTP expiry time
 */
export function calculateOtpExpiry(minutesFromNow: number = AUTH_CONFIG.otpExpiryMinutes): Date {
  return new Date(Date.now() + minutesFromNow * 60 * 1000);
}

/**
 * Check if OTP has expired
 */
export function isOtpExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Validate OTP format
 */
export function isValidOtpFormat(otp: string): boolean {
  if (!otp || typeof otp !== 'string') {
    return false;
  }
  // OTP must be exactly 6 digits
  return /^\d{6}$/.test(otp);
}

// ============================================
// JWT Functions
// ============================================

/**
 * Generate JWT token with 7-day expiry
 * Property 18: JWT token expiry
 */
export function generateJwtToken(
  workerId: string,
  phone: string,
  role: 'worker' | 'admin' = 'worker'
): TokenGenerationResult {
  const now = Date.now();
  const expiresIn = AUTH_CONFIG.jwtExpiryMs;
  const expiresAt = new Date(now + expiresIn);
  
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: workerId,
    phone,
    role
  };

  const token = jwt.sign(payload, config.jwt.secret, {
    expiresIn: `${AUTH_CONFIG.jwtExpiryDays}d`
  });

  return {
    token,
    expiresAt,
    expiresIn
  };
}

/**
 * Verify and decode JWT token
 */
export function verifyJwtToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Check if JWT token is expired
 */
export function isJwtExpired(token: string): boolean {
  const decoded = verifyJwtToken(token);
  if (!decoded) {
    return true;
  }
  return decoded.exp * 1000 < Date.now();
}

/**
 * Get token expiry date from JWT
 */
export function getJwtExpiryDate(token: string): Date | null {
  const decoded = verifyJwtToken(token);
  if (!decoded) {
    return null;
  }
  return new Date(decoded.exp * 1000);
}

/**
 * Calculate days until token expiry
 */
export function getDaysUntilExpiry(token: string): number {
  const expiryDate = getJwtExpiryDate(token);
  if (!expiryDate) {
    return 0;
  }
  const msUntilExpiry = expiryDate.getTime() - Date.now();
  return Math.max(0, Math.floor(msUntilExpiry / (24 * 60 * 60 * 1000)));
}

// ============================================
// Auth Service Implementation
// ============================================

class AuthService {
  /**
   * Request OTP for phone number
   * Requirements: 6.1
   */
  async requestOtp(phone: string): Promise<OtpGenerationResult> {
    // Validate phone format
    if (!this.isValidPhoneFormat(phone)) {
      throw new Error('Invalid phone number format');
    }

    // Check if worker exists
    const workerExists = await this.workerExists(phone);
    if (!workerExists) {
      throw new Error('Worker not found with this phone number');
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = calculateOtpExpiry();

    // Store OTP (upsert)
    await pool.query(
      `INSERT INTO otp_codes (phone, code, expires_at, attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (phone) 
       DO UPDATE SET code = $2, expires_at = $3, attempts = 0`,
      [phone, otp, expiresAt]
    );

    logger.info({ phone }, 'OTP generated');

    // In production, send OTP via SMS
    // For development, log it
    if (config.nodeEnv === 'development') {
      logger.info({ phone, otp }, 'Development OTP (would be sent via SMS)');
    }

    return { otp, expiresAt };
  }

  /**
   * Verify OTP and issue JWT token
   * Requirements: 6.2, 6.3
   * Property 19: OTP validation
   */
  async verifyOtp(phone: string, otp: string): Promise<AuthResult> {
    // Validate OTP format
    if (!isValidOtpFormat(otp)) {
      return {
        success: false,
        error: 'Invalid OTP format. Must be 6 digits.'
      };
    }

    // Get stored OTP
    const otpResult = await pool.query(
      `SELECT code, expires_at, attempts FROM otp_codes WHERE phone = $1`,
      [phone]
    );

    if (otpResult.rows.length === 0) {
      return {
        success: false,
        error: 'No OTP found for this phone number. Please request a new OTP.'
      };
    }

    const storedOtp: OtpRecord = {
      phone,
      code: otpResult.rows[0].code,
      expiresAt: new Date(otpResult.rows[0].expires_at),
      attempts: otpResult.rows[0].attempts
    };

    // Check if max attempts exceeded
    if (storedOtp.attempts >= AUTH_CONFIG.maxOtpAttempts) {
      // Delete the OTP record
      await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
      return {
        success: false,
        error: 'Maximum OTP attempts exceeded. Please request a new OTP.'
      };
    }

    // Check if OTP expired
    if (isOtpExpired(storedOtp.expiresAt)) {
      await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
      return {
        success: false,
        error: 'OTP has expired. Please request a new OTP.'
      };
    }

    // Verify OTP
    if (storedOtp.code !== otp) {
      // Increment attempts
      await pool.query(
        `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`,
        [phone]
      );
      
      const attemptsRemaining = AUTH_CONFIG.maxOtpAttempts - storedOtp.attempts - 1;
      return {
        success: false,
        error: `Invalid OTP. ${attemptsRemaining} attempts remaining.`
      };
    }

    // OTP is valid - delete it and issue token
    await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);

    // Get worker details
    const worker = await this.getWorkerByPhone(phone);
    if (!worker) {
      return {
        success: false,
        error: 'Worker not found'
      };
    }

    // Generate JWT token
    const tokenResult = generateJwtToken(worker.id, phone, 'worker');

    // Update worker's FCM token if needed (done separately)
    
    logger.info({ phone, workerId: worker.id }, 'Worker authenticated successfully');

    return {
      success: true,
      token: tokenResult.token,
      worker,
      expiresAt: tokenResult.expiresAt
    };
  }

  /**
   * Validate OTP without consuming it (for testing)
   * Property 19: OTP validation
   */
  async validateOtp(phone: string, otp: string): Promise<OtpValidationResult> {
    if (!isValidOtpFormat(otp)) {
      return {
        isValid: false,
        error: 'Invalid OTP format'
      };
    }

    const otpResult = await pool.query(
      `SELECT code, expires_at, attempts FROM otp_codes WHERE phone = $1`,
      [phone]
    );

    if (otpResult.rows.length === 0) {
      return {
        isValid: false,
        error: 'No OTP found'
      };
    }

    const storedOtp = otpResult.rows[0];
    const expiresAt = new Date(storedOtp.expires_at);

    if (isOtpExpired(expiresAt)) {
      return {
        isValid: false,
        error: 'OTP expired'
      };
    }

    if (storedOtp.attempts >= AUTH_CONFIG.maxOtpAttempts) {
      return {
        isValid: false,
        error: 'Max attempts exceeded'
      };
    }

    if (storedOtp.code !== otp) {
      return {
        isValid: false,
        error: 'OTP does not match',
        attemptsRemaining: AUTH_CONFIG.maxOtpAttempts - storedOtp.attempts
      };
    }

    return {
      isValid: true,
      attemptsRemaining: AUTH_CONFIG.maxOtpAttempts - storedOtp.attempts
    };
  }

  /**
   * Check if worker exists by phone
   */
  private async workerExists(phone: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM workers WHERE phone = $1 AND is_active = true`,
      [phone]
    );
    return result.rows.length > 0;
  }

  /**
   * Get worker by phone number
   */
  private async getWorkerByPhone(phone: string): Promise<Worker | null> {
    const result = await pool.query(
      `SELECT id, name, phone, assigned_zones, created_at, is_active, fcm_token
       FROM workers WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      assignedZones: row.assigned_zones || [],
      createdAt: new Date(row.created_at),
      isActive: row.is_active,
      fcmToken: row.fcm_token || undefined
    };
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneFormat(phone: string): boolean {
    // Accept 10-15 digit phone numbers
    return /^\d{10,15}$/.test(phone);
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;
