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
import { linkStatus } from './link-status.js';
import { clock } from './clock.js';
import { CSV_EXPORT_LIMIT, linksCsv } from './csv.js';
import { sessionMiddleware, passport, expireSession, authRouter, requireAuth, protectWrite } from './auth.js';
import { createAssistantRouter } from './assistant.js';
import { tagSchema, tagsSchema } from './tags.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY_HOPS);
app.use(helmet({ contentSecurityPolicy: {
  directives: { 'img-src': ["'self'", 'data:'], 'upgrade-insecure-requests': config.NODE_ENV === 'production' ? [] : null },
} }));
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api', sessionMiddleware, passport.initialize(), passport.session(), expireSession);
app.use('/api/auth', authRouter);
app.use('/api/assistant', createAssistantRouter());

const codePattern = /^[A-Za-z0-9_-]{4,32}$/;
const reserved = new Set(['api', 'health', 'assets', 'index', 'favicon', 'robots', 'links', 'preview']);
function parseHttpDestination(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.href.length > 2048) {
    throw new Error('Invalid stored destination');
  }
  return url;
}
const destinationSchema = z.string().trim().min(1).max(2048).refine(value => {
    try { parseHttpDestination(value); return true; }
    catch { return false; }
  }, 'Enter a valid http:// or https:// URL without credentials (maximum 2048 characters after encoding).');
const titleSchema = z.string().trim().max(120);
const editSchema = z.object({ originalUrl: destinationSchema.optional(), title: titleSchema.optional(), tags: tagsSchema.optional() }).strict()
  .refine(value => value.originalUrl !== undefined || value.title !== undefined || value.tags !== undefined, 'Send a title, destination or tags to update.');
const createSchema = z.object({
  originalUrl: destinationSchema,
  title: titleSchema.default(''),
  tags: tagsSchema.default([]),
  customAlias: z.string().trim().regex(codePattern, 'Use 4–32 letters, numbers, hyphens or underscores.').optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
  expiryPreset: z.enum(['none', '1h', '1d', '7d', 'custom']).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.expiryPreset === 'custom' && !value.expiresAt) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Choose a future date and time for custom expiry.' });
  }
  if (value.expiryPreset && value.expiryPreset !== 'custom' && value.expiresAt !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['expiryPreset'], message: 'Send either a duration preset or expiresAt, not both.' });
  }
});
const expiryDurations = { '1h': 3_600_000, '1d': 86_400_000, '7d': 604_800_000 };
const searchSchema = z.string().trim().max(120).default('');
const historyFilter = 'WHERE owner_id = $2 AND (title ILIKE $1 OR original_url ILIKE $1 OR code ILIKE $1) AND ($3::text IS NULL OR tags @> ARRAY[$3::text])';
const searchPattern = (q: string) => `%${q.replace(/[\\%_]/g, '\\$&')}%`;

const shapeLink = (row: Record<string, unknown>) => ({
  id: String(row.id), code: row.code, originalUrl: row.original_url,
  title: row.title, createdAt: row.created_at, expiresAt: row.expires_at,
  tags: row.tags ?? [],
  isActive: row.is_active, status: linkStatus(row.is_active, row.expires_at as Date | null, clock.now()),
  clicks: Number(row.clicks ?? 0), shortUrl: `${config.PUBLIC_BASE_URL}/${row.code}`,
});

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch { res.status(503).json({ status: 'unavailable', database: 'disconnected' }); }
});

app.post('/api/links', requireAuth, protectWrite, rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many links created. Please try again in a minute.' },
}), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }
  const { originalUrl, title, tags, customAlias, expiresAt, expiryPreset } = parsed.data;
  if (customAlias && reserved.has(customAlias.toLowerCase())) { res.status(400).json({ error: 'This alias is reserved.' }); return; }
  const destination = new URL(originalUrl);
  // Prevent chains and loops through this service's short links.
  if (destination.origin === config.PUBLIC_BASE_URL) { res.status(400).json({ error: 'Use a destination outside this short-link service.' }); return; }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = customAlias ?? randomBytes(6).toString('base64url');
    if (reserved.has(code.toLowerCase())) continue;
    try {
      // Compute immediately before insertion, including retries; never use the form-open time.
      const createdAt = clock.now();
      const duration = expiryPreset && expiryPreset in expiryDurations ? expiryDurations[expiryPreset as keyof typeof expiryDurations] : undefined;
      const expiryDate = duration ? new Date(createdAt + duration) : expiresAt ? new Date(expiresAt) : null;
      if (expiryDate && expiryDate.getTime() <= createdAt) { res.status(400).json({ error: 'Expiry must be in the future.' }); return; }
      const result = await pool.query('INSERT INTO links (code, original_url, title, expires_at, created_at, owner_id, tags) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [code, destination.href, title, expiryDate, new Date(createdAt), req.user!.id, tags]);
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

app.get('/api/links', requireAuth, async (req, res) => {
  const parsed = z.object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    q: searchSchema,
    tag: tagSchema.optional(),
  }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid pagination or search parameters.' }); return; }
  const { page, limit, q } = parsed.data;
  const search = searchPattern(q);
  const filter = historyFilter;
  const [items, total] = await Promise.all([
    pool.query(`SELECT l.*, (SELECT COUNT(*) FROM click_events c WHERE c.link_id = l.id) AS clicks FROM links l ${filter} ORDER BY created_at DESC, id DESC LIMIT $4 OFFSET $5`, [search, req.user!.id, parsed.data.tag ?? null, limit, (page - 1) * limit]),
    pool.query(`SELECT COUNT(*) AS count FROM links ${filter}`, [search, req.user!.id, parsed.data.tag ?? null]),
  ]);
  res.json({ items: items.rows.map(shapeLink), total: Number(total.rows[0].count), page, limit });
});

app.get('/api/tags', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT DISTINCT unnest(tags) AS name FROM links WHERE owner_id=$1 ORDER BY name', [req.user!.id]);
  res.json({ tags: result.rows.map(row => row.name) });
});

app.get('/api/links/export.csv', requireAuth, async (req, res) => {
  const parsed = z.object({ q: searchSchema, tag: tagSchema.optional() }).strict().safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid export search parameters.' }); return; }
  const now = clock.now();
  // One statement provides a consistent PostgreSQL snapshot; +1 detects overflow
  // without silently truncating or a separate count/read race.
  const result = await pool.query(`SELECT l.title, l.original_url, l.code, l.created_at, l.expires_at, l.is_active,
    (SELECT COUNT(*) FROM click_events c WHERE c.link_id = l.id) AS clicks
    FROM links l ${historyFilter} ORDER BY created_at DESC, id DESC LIMIT $4`,
    [searchPattern(parsed.data.q), req.user!.id, parsed.data.tag ?? null, CSV_EXPORT_LIMIT + 1]);
  if (result.rows.length > CSV_EXPORT_LIMIT) {
    res.status(413).json({ error: `Export exceeds ${CSV_EXPORT_LIMIT.toLocaleString('en')} links. Narrow your search and try again.` }); return;
  }
  const filename = `my-links-${new Date(now).toISOString().slice(0, 10)}.csv`;
  if (req.method === 'GET') await pool.query('INSERT INTO csv_exports(owner_id,search,tag,row_count,filename) VALUES($1,$2,$3,$4,$5)', [req.user!.id,parsed.data.q,parsed.data.tag ?? null,result.rows.length,filename]);
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('text/csv').send(linksCsv(result.rows, config.PUBLIC_BASE_URL, now));
});

app.get('/api/stats', requireAuth, async (req, res) => {
  const [links, clicks, daily] = await Promise.all([
    pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_active AND (expires_at IS NULL OR expires_at > NOW())) AS active FROM links WHERE owner_id=$1', [req.user!.id]),
    pool.query("SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE opened_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS today FROM click_events WHERE link_id IN (SELECT id FROM links WHERE owner_id=$1)", [req.user!.id]),
    pool.query(`SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COUNT(c.id)::int AS clicks
      FROM generate_series((NOW() AT TIME ZONE 'UTC')::date - 6, (NOW() AT TIME ZONE 'UTC')::date, INTERVAL '1 day') AS days(day)
      LEFT JOIN click_events c ON c.link_id IN (SELECT id FROM links WHERE owner_id=$1) AND (c.opened_at AT TIME ZONE 'UTC')::date = days.day::date
      GROUP BY days.day ORDER BY days.day`, [req.user!.id]),
  ]);
  res.json({ totalLinks: Number(links.rows[0].total), activeLinks: Number(links.rows[0].active), totalClicks: Number(clicks.rows[0].total), todayClicks: Number(clicks.rows[0].today), daily: daily.rows, timezone: 'UTC' });
});

const publicMetadataLimit = rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many metadata requests. Please try again later.'}});
app.get('/api/links/:code/qr', publicMetadataLimit, async (req, res) => {
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const found = await pool.query('SELECT id, code FROM links WHERE code = $1', [req.params.code]);
  if (!found.rowCount) { res.status(404).json({ error: 'Link not found.' }); return; }
  const payload = `${config.PUBLIC_BASE_URL}/${req.params.code}`;
  const cached = await pool.query('SELECT png FROM qr_codes WHERE link_id=$1 AND payload=$2', [found.rows[0].id,payload]);
  let png: Buffer = cached.rows[0]?.png;
  if (!png) {
    png = await QRCode.toBuffer(payload, { width: 512, margin: 4, errorCorrectionLevel: 'M' });
    if (req.method === 'GET') await pool.query('INSERT INTO qr_codes(link_id,payload,png) VALUES($1,$2,$3) ON CONFLICT(link_id,payload) DO NOTHING', [found.rows[0].id,payload,png]);
  }
  res.type('png');
  if (req.query.download === '1') res.set('Content-Disposition', `attachment; filename="link-${req.params.code}.png"`);
  res.send(png);
});

// Read stored metadata only; never fetch the destination or record an opening.
app.get('/api/links/:code/preview', publicMetadataLimit, async (req, res) => {
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const found = await pool.query('SELECT id, code, title, original_url, expires_at, is_active FROM links WHERE code = $1', [req.params.code]);
  const link = found.rows[0];
  if (!link) { res.status(404).json({ error: 'Link not found.' }); return; }
  const destinationHost = parseHttpDestination(link.original_url).hostname;
  if (req.method === 'GET') await pool.query('INSERT INTO preview_events(link_id,status) VALUES($1,$2)', [link.id,linkStatus(link.is_active,link.expires_at,clock.now())]);
  res.json({
    code: link.code, title: link.title, originalUrl: link.original_url,
    destinationHost,
    shortUrl: `${config.PUBLIC_BASE_URL}/${link.code}`,
    previewUrl: `${config.PUBLIC_BASE_URL}/preview/${link.code}`,
    expiresAt: link.expires_at,
    isActive: link.is_active, status: linkStatus(link.is_active, link.expires_at, clock.now()),
  });
});

app.get('/api/links/:code', requireAuth, async (req, res) => {
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const found = await pool.query('SELECT l.*, (SELECT COUNT(*) FROM click_events c WHERE c.link_id=l.id) AS clicks FROM links l WHERE code=$1 AND owner_id=$2', [req.params.code, req.user!.id]);
  if (!found.rowCount) { res.status(404).json({ error: 'Link not found.' }); return; }
  res.json(shapeLink(found.rows[0]));
});
// Only supplied fields change; owner filtering and PostgreSQL's row lock apply atomically.
app.patch('/api/links/:code', requireAuth, protectWrite, rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many link edits. Please try again in a minute.' },
}), async (req, res) => {
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }); return; }
  const destination = parsed.data.originalUrl === undefined ? null : new URL(parsed.data.originalUrl);
  if (destination?.origin === config.PUBLIC_BASE_URL) { res.status(400).json({ error: 'Use a destination outside this short-link service.' }); return; }
  const result = await pool.query(`UPDATE links SET original_url=COALESCE($1,original_url), title=COALESCE($2,title), tags=COALESCE($5::text[],tags)
    WHERE code=$3 AND owner_id=$4
    RETURNING links.*, (SELECT COUNT(*) FROM click_events c WHERE c.link_id=links.id) AS clicks`,
    [destination?.href ?? null, parsed.data.title ?? null, req.params.code, req.user!.id, parsed.data.tags ?? null]);
  if (!result.rowCount) { res.status(404).json({ error: 'Link not found.' }); return; }
  res.json(shapeLink(result.rows[0]));
});

// Explicit target state makes retries idempotent. Owner filter is part of the UPDATE.
app.patch('/api/links/:code/status', requireAuth, protectWrite, async (req, res) => {
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).json({ error: 'Link not found.' }); return; }
  const parsed = z.object({ isActive: z.boolean() }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Send only isActive as true or false.' }); return; }
  const result = await pool.query(`UPDATE links SET is_active=$1 WHERE code=$2 AND owner_id=$3
    RETURNING links.*, (SELECT COUNT(*) FROM click_events c WHERE c.link_id=links.id) AS clicks`, [parsed.data.isActive, req.params.code, req.user!.id]);
  if (!result.rowCount) { res.status(404).json({ error: 'Link not found.' }); return; }
  res.json(shapeLink(result.rows[0]));
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });

const frontend = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
if (existsSync(frontend)) app.use(express.static(frontend, { index: false }));
app.get('/', (_req, res) => {
  if (existsSync(frontend)) res.sendFile(`${frontend}/index.html`);
  else res.type('text').send('Link Studio API is running. Start the frontend on http://localhost:5173');
});

app.get('/preview/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let status = 404;
  if (codePattern.test(req.params.code)) {
    const result = await pool.query('SELECT expires_at, is_active FROM links WHERE code = $1', [req.params.code]);
    const link = result.rows[0];
    if (link) status = linkStatus(link.is_active, link.expires_at, clock.now()) === 'active' ? 200 : 410;
  }
  if (existsSync(frontend)) res.status(status).sendFile(`${frontend}/index.html`);
  else res.status(503).type('text').send('Build the frontend to view link previews.');
});

app.get('/:code', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (typeof req.params.code !== 'string' || !codePattern.test(req.params.code)) { res.status(404).type('text').send('This short link does not exist.'); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Share lock serializes status updates with validation + event creation.
    const result = await client.query('SELECT id, original_url, expires_at, is_active FROM links WHERE code = $1 FOR SHARE', [req.params.code]);
    const link = result.rows[0];
    if (!link) { await client.query('ROLLBACK'); res.status(404).type('text').send('This short link does not exist.'); return; }
    const status = linkStatus(link.is_active, link.expires_at, clock.now());
    if (status !== 'active') {
      await client.query('ROLLBACK');
      res.status(410).type('text').send(status === 'disabled' ? 'This short link has been disabled by its owner.' : 'This short link has expired.'); return;
    }
    parseHttpDestination(link.original_url);
    if (req.method === 'GET') await client.query('INSERT INTO click_events (link_id) VALUES ($1)', [link.id]);
    await client.query('COMMIT');
    res.redirect(302, link.original_url);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
});
app.use((_req, res) => { res.status(404).type('text').send('Page not found.'); });

const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error.code === 'EBADCSRFTOKEN') { res.status(403).json({ error: 'Your session token is invalid. Refresh and try again.' }); return; }
  if (error instanceof URIError && (error as { status?: number }).status === 400) { res.status(400).json({ error: 'Invalid URL path.' }); return; }
  if (error.type === 'entity.parse.failed') { res.status(400).json({ error: 'Invalid JSON body.' }); return; }
  if (error.type === 'entity.too.large') { res.status(413).json({ error: 'Request body is too large.' }); return; }
  console.error('Request failed:', error.code ?? error.name ?? 'unknown');
  res.status(500).json({ error: 'The service is temporarily unavailable. Please try again.' });
};
app.use(handleError);
export { app };
