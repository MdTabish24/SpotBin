/**
 * Auth Routes - Admin authentication
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool';
import { logger } from '../config/logger';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Admin Login
 * POST /api/auth/admin/login
 */
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Email and password required' }
      });
    }

    // Find admin by email
    const result = await pool.query(
      'SELECT id, email, password_hash, name, role FROM admins WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const admin = result.rows[0];

    // For development - allow any password if hash is placeholder
    let isValidPassword = false;
    if (admin.password_hash.startsWith('$2a$') || admin.password_hash.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, admin.password_hash);
    } else {
      // Placeholder password - accept 'admin123' for dev
      isValidPassword = password === 'admin123';
    }

    if (!isValidPassword) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info({ email: admin.email }, 'Admin logged in');

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      }
    });
  } catch (error) {
    logger.error({ error }, 'Admin login failed');
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Login failed' }
    });
  }
});

/**
 * Validate Token
 * GET /api/auth/validate
 */
router.get('/validate', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      jwt.verify(token, JWT_SECRET);
      res.json({ valid: true });
    } catch {
      res.status(401).json({ valid: false });
    }
  } catch (error) {
    res.status(500).json({ valid: false });
  }
});

/**
 * Get Admin Profile
 * GET /api/admin/profile
 */
router.get('/admin/profile', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'No token provided' }
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      const result = await pool.query(
        'SELECT id, email, name, role FROM admins WHERE id = $1',
        [decoded.adminId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Admin not found' }
        });
      }

      res.json({ admin: result.rows[0] });
    } catch {
      res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Invalid token' }
      });
    }
  } catch (error) {
    res.status(500).json({
      error: { code: 'SERVER_ERROR', message: 'Failed to get profile' }
    });
  }
});

export default router;
