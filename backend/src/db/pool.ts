import { Pool, PoolConfig } from 'pg';
import { config } from '../config/env';
import { logger } from '../config/logger';

const poolConfig: PoolConfig = {
  connectionString: config.database.url,
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Use connection string if available, otherwise use individual params
const pool = new Pool(
  config.database.url 
    ? { connectionString: config.database.url, max: config.database.poolMax }
    : poolConfig
);

// Log pool events
pool.on('connect', () => {
  logger.debug('New client connected to PostgreSQL');
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

// Health check function
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
};

// Graceful shutdown
export const closePool = async (): Promise<void> => {
  await pool.end();
  logger.info('PostgreSQL pool closed');
};

export default pool;
