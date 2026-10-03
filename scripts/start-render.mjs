// Render supplies the public HTTPS origin. Explicit overrides support custom domains.
const origin = process.env.PUBLIC_BASE_URL?.trim() || process.env.RENDER_EXTERNAL_URL;
let validOrigin = false;
try { validOrigin = !!origin && new URL(origin).protocol === 'https:'; } catch { /* Report no secret-bearing URL. */ }
if (!validOrigin) {
  console.error('Render startup requires a public HTTPS origin. Check PUBLIC_BASE_URL or RENDER_EXTERNAL_URL.');
  process.exit(1);
}
process.env.PUBLIC_BASE_URL = origin;
process.env.AUTH_ORIGIN = process.env.AUTH_ORIGIN?.trim() || origin;

let pool;
try {
  ({ pool } = await import('../backend/dist/db.js'));
  const { migrate } = await import('../backend/dist/migrate.js');
  await migrate();
  console.log('Database migration complete. Starting Link Studio.');
  await import('../backend/dist/server.js');
} catch {
  console.error('Render startup failed. Check build output, environment, database connection and schema permissions.');
  await pool?.end();
  process.exitCode = 1;
}
