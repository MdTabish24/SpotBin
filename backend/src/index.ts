import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { logger, requestLogger } from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { apiRateLimiter } from './middleware/rateLimiter';
import { xssSanitizer } from './middleware/xssSanitizer';
import { setupSwagger } from './config/swagger';
import { ensureUploadsDir } from './config/localStorage';

// Load environment variables
dotenv.config();

// Ensure uploads directory exists for local storage
ensureUploadsDir();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for accurate IP detection behind load balancers
app.set('trust proxy', 1);

// Request ID middleware (must be first for log correlation)
app.use(requestIdMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Required for Swagger UI
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Request-ID'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS Sanitization middleware (after body parsing, before routes)
app.use(xssSanitizer);

// Compression middleware
app.use(compression());

// Request logging middleware (with request ID correlation)
app.use(requestLogger);

// Setup Swagger API documentation
setupSwagger(app);

// Serve uploaded files locally (for development without S3)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rate limiting middleware (100 requests/minute per IP)
app.use('/api', apiRateLimiter);

// Import health check functions
import { checkDatabaseHealth } from './db/pool';
import { checkRedisHealth } from './config/redis';

// Import routes
import reportRoutes from './routes/report.routes';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';
import citizenRoutes, { getLeaderboard } from './routes/citizen.routes';

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await checkDatabaseHealth();
  const redisHealthy = await checkRedisHealth();
  
  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
  const statusCode = status === 'healthy' ? 200 : 503;
  
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: dbHealthy ? 'healthy' : 'unhealthy',
      redis: redisHealthy ? 'healthy' : 'unhealthy',
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes); // Also mount at v1 for admin panel
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/citizens', citizenRoutes);
app.get('/api/v1/leaderboard', getLeaderboard);
// app.use('/api/v1/workers', workerRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
});

export default app;
