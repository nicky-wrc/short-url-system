import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

// Relative certificate paths resolve from backend/ in both src and dist.
const ca = config.DATABASE_SSL === 'true' && config.DATABASE_SSL_CA_FILE
  ? readFileSync(resolve(fileURLToPath(new URL('../', import.meta.url)), config.DATABASE_SSL_CA_FILE), 'utf8')
  : undefined;
export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: true, ...(ca ? { ca } : {}) } : undefined,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
pool.on('error', err => console.error('Idle database connection failed:', err.message));
