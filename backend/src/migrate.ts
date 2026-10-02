import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

export async function migrate() {
  const sql = await Promise.all(['001_initial.sql', '002_auth.sql'].map(file => readFile(new URL(`../migrations/${file}`, import.meta.url), 'utf8')));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(735119)");
    for (const migration of sql) await client.query(migration);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  migrate().then(() => console.log('Database migration complete.')).catch(() => {
    console.error('Migration failed. Check database access and schema permissions.');
    process.exitCode = 1;
  }).finally(() => pool.end());
}
