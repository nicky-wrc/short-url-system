import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { pool } from './db.js';
import { config } from './config.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.use(helmet({ contentSecurityPolicy: {
  directives: { 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': config.NODE_ENV === 'production' ? [] : null },
} }));
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const codePattern = /^[A-Za-z0-9_-]{4,32}$/;
const reserved = new Set(['api', 'health', 'assets', 'index', 'favicon', 'robots', 'links']);
const createSchema = z.object({
  originalUrl: z.string().trim().min(1).max(2048).refine(value => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.href.length <= 2048; }
    catch { return false; }
  }, 'Enter a valid http:// or https:// URL without credentials (maximum 2048 characters after encoding).'),
  title: z.string().trim().max(120).default(''),
  customAlias: z.string().trim().regex(codePattern, 'Use 4–32 letters, numbers, hyphens or underscores.').optional(),
  expiresAt: z.iso.datetime({ offset: true }).refine(value => new Date(value).getTime() > Date.now(), 'Expiry must be in the future.').optional(),
}).strict();

const shapeLink = (row: Record<string, unknown>) => ({
  id: String(row.id), code: row.code, originalUrl: row.original_url,
  title: row.title, createdAt: row.created_at, expiresAt: row.expires_at,
  clicks: Number(row.clicks ?? 0), shortUrl: `${config.PUBLIC_BASE_URL}/${row.code}`,
});

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
});

app.post('/api/links', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many links created. Please try again in a minute.' },
}), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }
  const { originalUrl, title, customAlias, expiresAt } = parsed.data;
  if (customAlias && reserved.has(customAlias.toLowerCase())) { res.status(400).json({ error: 'This alias is reserved.' }); return; }
  const destination = new URL(originalUrl);
  // Prevent chains and loops through this service's short links.
  if (destination.origin === config.PUBLIC_BASE_URL) { res.status(400).json({ error: 'Use a destination outside this short-link service.' }); return; }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = customAlias ?? randomBytes(6).toString('base64url');
    if (reserved.has(code.toLowerCase())) continue;
    try {
      const result = await pool.query('INSERT INTO links (code, original_url, title, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [code, destination.href, title, expiresAt ?? null]);
      res.status(201).json(shapeLink(result.rows[0])); return;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        if (customAlias) { res.status(409).json({ error: 'This alias is already in use. Choose another one.' }); return; }
        continue;
      }
      throw error;
    }
  }
  res.status(503).json({ error: 'Could not allocate a short link. Please retry.' });
});

app.get('/api/links', async (req, res) => {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    q: z.string().trim().max(120).default(''),
  }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid pagination or search parameters.' }); return; }
  const { page, limit, q } = parsed.data;
  const search = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const filter = "WHERE title ILIKE $1 OR original_url ILIKE $1 OR code ILIKE $1";
  const [items, total] = await Promise.all([
    pool.query(`SELECT l.*, (SELECT COUNT(*) FROM click_events c WHERE c.link_id = l.id) AS clicks FROM links l ${filter} ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`, [search, limit, (page - 1) * limit]),
    pool.query(`SELECT COUNT(*) AS count FROM links ${filter}`, [search]),
  ]);
  res.json({ items: items.rows.map(shapeLink), total: Number(total.rows[0].count), page, limit });
});

app.get('/api/stats', async (_req, res) => {
  const [links, clicks, daily] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE expires_at IS NULL OR expires_at > NOW()) AS active FROM links'),
    pool.query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE opened_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS today FROM click_events"),
    pool.query(`SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COUNT(c.id)::int AS clicks
      FROM generate_series((NOW() AT TIME ZONE 'UTC')::date - 6, (NOW() AT TIME ZONE 'UTC')::date, INTERVAL '1 day') AS days(day)
      LEFT JOIN click_events c ON (c.opened_at AT TIME ZONE 'UTC')::date = days.day::date
      GROUP BY days.day ORDER BY days.day`),
  ]);
  res.json({ totalLinks: Number(links.rows[0].total), activeLinks: Number(links.rows[0].active), totalClicks: Number(clicks.rows[0].total), todayClicks: Number(clicks.rows[0].today), daily: daily.rows, timezone: 'UTC' });
});

app.get('/api/links/:code/qr', async (req, res) => {
  if (!codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const found = await pool.query('SELECT code FROM links WHERE code = $1', [req.params.code]);
  if (!found.rowCount) { res.status(404).json({ error: 'Link not found.' }); return; }
  const png = await QRCode.toBuffer(`${config.PUBLIC_BASE_URL}/${req.params.code}`, { width: 512, margin: 4, errorCorrectionLevel: 'M' });
  res.type('png');
  if (req.query.download === '1') res.set('Content-Disposition', `attachment; filename="link-${req.params.code}.png"`);
  res.send(png);
});

app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });

const frontend = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
if (existsSync(frontend)) app.use(express.static(frontend, { index: false }));
app.get('/', (_req, res) => {
  if (existsSync(frontend)) res.sendFile(`${frontend}/index.html`);
  else res.type('text').send('Link Studio API is running. Start the frontend on http://localhost:5173');
});

app.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!codePattern.test(req.params.code)) { res.status(404).type('text').send('This short link does not exist.'); return; }
  const result = await pool.query('SELECT id, original_url, expires_at FROM links WHERE code = $1', [req.params.code]);
  const link = result.rows[0];
  if (!link) { res.status(404).type('text').send('This short link does not exist.'); return; }
  if (link.expires_at && new Date(link.expires_at) <= new Date()) { res.status(410).type('text').send('This short link has expired.'); return; }
  // HEAD checks availability, but does not count as an opening. Every successful GET is recorded.
  if (req.method === 'GET') await pool.query('INSERT INTO click_events (link_id) VALUES ($1)', [link.id]);
  res.redirect(302, link.original_url);
});
app.use((_req, res) => { res.status(404).type('text').send('Page not found.'); });

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
  if (error.type === 'entity.too.large') { res.status(413).json({ error: 'Request body is too large.' }); return; }
  console.error('Request failed:', error.code ?? error.name ?? 'unknown');
  res.status(500).json({ error: 'The service is temporarily unavailable. Please try again.' });
};
app.use(handleError);
export { app };
