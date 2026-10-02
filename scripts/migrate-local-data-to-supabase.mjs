// One-time migration into EMPTY app tables. Leaves the source database untouched.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import pg from 'pg';
import { pool as target } from '../backend/dist/db.js';
const root = fileURLToPath(new URL('../', import.meta.url));
let source;
let from;
let to;
try {
  const backups = (await readdir(resolve(root, 'tmp/supabase-setup')))
    .filter(name => name.startsWith('backend.env.before-supabase-')).sort();
  const last = backups.at(-1);
  if (!last) throw new Error('No previous local environment backup found.');
  const env = dotenv.parse(await readFile(resolve(root, 'tmp/supabase-setup', last)));
  const origin = new URL(env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(origin.hostname) || origin.pathname !== '/shorturl') {
    throw new Error('Expected a local shorturl source database.');
  }
  source = new pg.Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  from = await source.connect();
  to = await target.connect();
  await from.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const links = (await from.query('SELECT * FROM links ORDER BY id')).rows;
  const events = (await from.query('SELECT * FROM click_events ORDER BY id')).rows;
  await to.query('BEGIN');
  await to.query('LOCK TABLE links, click_events IN SHARE ROW EXCLUSIVE MODE');
  const existing = await to.query('SELECT (SELECT COUNT(*) FROM links)::int AS links, (SELECT COUNT(*) FROM click_events)::int AS events');
  if (existing.rows[0].links || existing.rows[0].events) {
    throw new Error('Target tables are not empty. Stopped without overwriting existing data.');
  }
  for (const link of links) {
    await to.query('INSERT INTO links (id, code, original_url, title, created_at, expires_at) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3,$4,$5,$6)',
      [link.id, link.code, link.original_url, link.title, link.created_at, link.expires_at]);
  }
  for (const event of events) {
    await to.query('INSERT INTO click_events (id, link_id, opened_at) OVERRIDING SYSTEM VALUE VALUES ($1,$2,$3)',
      [event.id, event.link_id, event.opened_at]);
  }
  await to.query("SELECT setval(pg_get_serial_sequence('links','id'), COALESCE(MAX(id),1), COUNT(*) > 0) FROM links");
  await to.query("SELECT setval(pg_get_serial_sequence('click_events','id'), COALESCE(MAX(id),1), COUNT(*) > 0) FROM click_events");
  await to.query('COMMIT');
  await from.query('COMMIT');
  console.log(`Migrated ${links.length} links and ${events.length} open events. Source unchanged.`);
} catch (error) {
  await to?.query('ROLLBACK').catch(() => {});
  await from?.query('ROLLBACK').catch(() => {});
  console.error('Migration stopped:', error.code ?? (error.message?.startsWith('Target tables') ? error.message : 'Check source backup and database access.'));
  process.exitCode = 1;
} finally {
  to?.release(); from?.release();
  await target.end();
  await source?.end();
}
