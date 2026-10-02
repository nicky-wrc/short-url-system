import { test, after, before } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import request from 'supertest';
import dotenv from 'dotenv';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import sharp from 'sharp';

dotenv.config({ path: '.env', quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
const testDatabase = testUrl ? new URL(testUrl) : null;
const mainDatabase = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (!testDatabase || !['localhost', '127.0.0.1', '[::1]'].includes(testDatabase.hostname) ||
    !testDatabase.pathname.endsWith('_test') || process.env.TEST_DATABASE_RESET !== 'true') {
  throw new Error('Use a disposable local database ending in _test and explicitly set TEST_DATABASE_RESET=true. Tests delete its links.');
}
if (mainDatabase && ['localhost', '127.0.0.1', '[::1]'].includes(mainDatabase.hostname) && mainDatabase.pathname === testDatabase.pathname &&
    (mainDatabase.port || '5432') === (testDatabase.port || '5432') && process.env.NODE_ENV !== 'test') {
  throw new Error('Refusing to reset the application database. CI may share a disposable DB only with NODE_ENV=test.');
}
process.env.SESSION_SECRET = 'isolated-tests-only-session-key-at-least-32-characters';
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
// Local test database is independent from the hosted database's TLS settings.
process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL ?? 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { migrate } = await import('../src/migrate.js');
const { sessionStore } = await import('../src/auth.js');
let fixtureCookie = ''; let fixtureCsrf = ''; let fixtureUserId = '';
function signedRequest() {
  const base = request(app);
  return { get: (path: string) => base.get(path).set('Cookie', fixtureCookie),
    head: (path: string) => base.head(path).set('Cookie', fixtureCookie),
    post: (path: string) => base.post(path).set('Cookie', fixtureCookie).set('X-CSRF-Token', fixtureCsrf) };
}
const { clock } = await import('../src/clock.js');
const { csvText, linksCsv, CSV_EXPORT_LIMIT } = await import('../src/csv.js');

// Small independent CSV reader to verify quoted commas/newlines and escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && c === ',') { row.push(field); field = ''; }
    else if (!quoted && c === '\r' && input[i + 1] === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; }
    else field += c;
  }
  assert.equal(quoted, false, 'CSV quotes must balance');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
before(async () => {
  await migrate(); await pool.query('TRUNCATE links, click_events, users, sessions RESTART IDENTITY CASCADE');
  const anonymous = await request(app).get('/api/auth/session').expect(200);
  const response = await request(app).post('/api/auth/register').set('Cookie', anonymous.headers['set-cookie']).set('X-CSRF-Token', anonymous.body.csrfToken)
    .send({ email: 'fixtures@example.test', password: 'Fixture-only-password-123' }).expect(200);
  fixtureCookie = (response.headers['set-cookie'] as unknown as string[]).map(value => value.split(';')[0]).join('; ');
  fixtureCsrf = response.body.csrfToken; fixtureUserId = response.body.user.id;
  // Baseline expiry tests advance the clock to 2030+. This isolated test session
  // must outlive those fixture clocks; auth expiry itself has separate real tests.
  await pool.query(`UPDATE sessions SET sess = jsonb_set(jsonb_set(sess::jsonb, '{authExpiresAt}', '4102444800000'), '{cookie,expires}', '"2100-01-01T00:00:00.000Z"')::json, expire='2100-01-01'`);
});
after(async () => { await sessionStore.close(); await pool.query('TRUNCATE links, click_events, users, sessions RESTART IDENTITY CASCADE'); await pool.end(); });

test('health reports PostgreSQL connectivity', async () => {
  const response = await signedRequest().get('/api/health').expect(200);
  assert.equal(response.body.database, 'connected');
});
test('create → real HTTP redirect → stored history and accurate concurrent opens', async () => {
  const created = await signedRequest().post('/api/links').send({ originalUrl: 'https://www.synerry.com/?utm_source=demo#about', title: 'SYNERRY demo' }).expect(201);
  const { code, shortUrl } = created.body;
  assert.match(code, /^[A-Za-z0-9_-]{8}$/);
  assert.equal(shortUrl, `http://localhost:3000/${code}`);
  await signedRequest().head(`/${code}`).expect(302);
  const first = await signedRequest().get(`/${code}`).expect(302);
  assert.equal(first.headers.location, 'https://www.synerry.com/?utm_source=demo#about');
  assert.equal(first.headers['cache-control'], 'no-store');
  await Promise.all(Array.from({ length: 12 }, () => signedRequest().get(`/${code}`).expect(302)));
  const list = await signedRequest().get('/api/links?q=SYNERRY%20demo').expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].clicks, 13);
  const persisted = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id = $1', [created.body.id]);
  assert.equal(persisted.rows[0].count, 13);
});
test('QR is PNG, downloadable, and does not count as an opening', async () => {
  const created = await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com/qr', customAlias: 'qr-demo' }).expect(201);
  const qr = await signedRequest().get('/api/links/qr-demo/qr?download=1').expect(200);
  assert.match(qr.headers['content-type'], /image\/png/);
  assert.match(qr.headers['content-disposition'], /attachment/);
  assert.equal(qr.body.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const png = PNG.sync.read(qr.body);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.equal(decoded?.data, created.body.shortUrl, 'QR must encode the short URL, not the destination');
  const result = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [created.body.id]);
  assert.equal(result.rows[0].count, 0);
});
test('custom aliases are unique, including simultaneous requests', async () => {
  const responses = await Promise.all(Array.from({ length: 3 }, () => signedRequest().post('/api/links').send({ originalUrl: 'https://example.com', customAlias: 'unique-alias' })));
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409, 409]);
});
test('invalid destinations, aliases, expiry and own-service loops are rejected', async () => {
  for (const body of [
    { originalUrl: 'javascript:alert(1)' }, { originalUrl: 'not a url' },
    { originalUrl: 'ftp://example.com/file' }, { originalUrl: 'https://user:pass@example.com' },
    { originalUrl: 'http://localhost:3000/demo' },
    { originalUrl: 'https://example.com/' + 'ก'.repeat(500) },
    { originalUrl: 'https://example.com', customAlias: 'assets' },
    { originalUrl: 'https://example.com', customAlias: 'a b c' },
    { originalUrl: 'https://example.com', expiresAt: '2020-01-01T00:00:00Z' },
  ]) await signedRequest().post('/api/links').send(body).expect(400);
  await signedRequest().post('/api/links').set('Content-Type', 'application/json').send('{bad json').expect(400);
});
test('missing and expired links do not record opens', async () => {
  await signedRequest().get('/no-such-link').expect(404);
  await signedRequest().get('/api/links/missing-link/qr').expect(404);
  const inserted = await pool.query("INSERT INTO links(code, original_url, expires_at) VALUES ('expired-link', 'https://example.com', NOW() - INTERVAL '1 day') RETURNING id");
  await signedRequest().get('/expired-link').expect(410);
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [inserted.rows[0].id]);
  assert.equal(count.rows[0].count, 0);
});
test('pagination, literal search and UTC stats work', async () => {
  const page = await signedRequest().get('/api/links?page=1&limit=2').expect(200);
  assert.equal(page.body.items.length, 2);
  await signedRequest().get('/api/links?page=-1').expect(400);
  await signedRequest().get('/api/links?limit=100').expect(400);
  const literal = await signedRequest().get('/api/links?q=%25').expect(200);
  assert.equal(literal.body.total, 0);
  const stats = await signedRequest().get('/api/stats').expect(200);
  assert.equal(stats.body.totalClicks, 13);
  assert.equal(stats.body.daily.length, 7);
  assert.equal(stats.body.timezone, 'UTC');
  assert.equal(stats.body.activeLinks, 3);
  assert.equal(stats.body.totalLinks, 3, 'the orphan expired fixture is excluded from My stats');
});
test('API errors have JSON bodies and unknown routes are 404', async () => {
  const response = await signedRequest().get('/api/unknown').expect(404);
  assert.ok(response.body.error);
  await signedRequest().get('/path/that/does/not/exist').expect(404);
});

test('preview preserves destination, does not count GET/HEAD, and only continue records an opening', async () => {
  const destination = 'https://example.com/a%2Fb?tag=one&tag=two&next=%2Fhome#section';
  const inserted = await pool.query('INSERT INTO links(code, original_url, title) VALUES ($1, $2, $3) RETURNING id',
    ['preview-demo', destination, '<script>alert("title")</script>']);
  try {
    for (let i = 0; i < 3; i++) {
      const preview = await signedRequest().get('/api/links/preview-demo/preview').expect(200);
      assert.equal(preview.body.originalUrl, destination);
      assert.equal(preview.body.destinationHost, 'example.com');
      assert.equal(preview.body.status, 'active');
      assert.equal(preview.body.previewUrl, 'http://localhost:3000/preview/preview-demo');
      assert.equal(preview.headers['cache-control'], 'no-store');
      assert.equal(preview.body.title, '<script>alert("title")</script>');
    }
    await signedRequest().head('/api/links/preview-demo/preview').expect(200);
    const page = await signedRequest().get('/preview/preview-demo').expect(200);
    assert.match(page.headers['content-type'], /text\/html/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.ok(!page.text.includes('<script>alert("title")</script>'), 'HTML shell must not interpolate stored content');
    await signedRequest().head('/preview/preview-demo').expect(200);
    const before = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [inserted.rows[0].id]);
    assert.equal(before.rows[0].count, 0);
    const redirect = await signedRequest().get('/preview-demo').expect(302);
    assert.equal(redirect.headers.location, destination);
    const after = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [inserted.rows[0].id]);
    assert.equal(after.rows[0].count, 1);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [inserted.rows[0].id]); }
});

test('preview handles invalid, missing and expired links without recording events', async () => {
  for (const code of ['bad!', 'preview-missing']) {
    await signedRequest().get(`/api/links/${code}/preview`).expect(404);
    await signedRequest().get(`/preview/${code}`).expect(404);
  }
  const inserted = await pool.query("INSERT INTO links(code, original_url, expires_at) VALUES ('preview-expired', 'https://example.com', NOW() - INTERVAL '1 day') RETURNING id");
  try {
    const preview = await signedRequest().get('/api/links/preview-expired/preview').expect(200);
    assert.equal(preview.body.status, 'expired');
    await signedRequest().get('/preview/preview-expired').expect(410);
    await signedRequest().head('/preview/preview-expired').expect(410);
    await signedRequest().get('/preview-expired').expect(410);
    const count = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [inserted.rows[0].id]);
    assert.equal(count.rows[0].count, 0);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [inserted.rows[0].id]); }
});

test('legacy short links and QR still redirect directly; preview and QR reads never count', async () => {
  // A pre-existing code may now be reserved for new creation. It must still resolve.
  const inserted = await pool.query("INSERT INTO links(code, original_url) VALUES ('preview', 'https://example.com/legacy?keep=1#old') RETURNING id");
  try {
    for (let i = 0; i < 3; i++) {
      await signedRequest().get('/preview/preview').expect(200);
      await signedRequest().get('/api/links/preview/preview').expect(200);
      await signedRequest().get('/api/links/preview/qr').expect(200);
      const qr = await signedRequest().get('/api/links/preview/qr?download=1').expect(200);
      const png = PNG.sync.read(qr.body);
      assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, 'http://localhost:3000/preview');
    }
    await signedRequest().head('/preview').expect(302);
    await signedRequest().head('/api/links/preview/qr').expect(200);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [inserted.rows[0].id])).rows[0].n, 0);
    const response = await signedRequest().get('/preview?destination=https://attacker.example&url=https://attacker.example').expect(302);
    assert.equal(response.headers.location, 'https://example.com/legacy?keep=1#old');
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [inserted.rows[0].id])).rows[0].n, 1);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [inserted.rows[0].id]); }
});

test('backend rechecks expiry after preview; HEAD and expired redirect never count', async () => {
  const inserted = await pool.query("INSERT INTO links(code, original_url, expires_at) VALUES ('expiry-race', 'https://example.com', NOW()+INTERVAL '1 hour') RETURNING id");
  try {
    assert.equal((await signedRequest().get('/api/links/expiry-race/preview').expect(200)).body.status, 'active');
    // Deterministically simulate time advancing after preview; no timing-dependent sleep.
    await pool.query("UPDATE links SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [inserted.rows[0].id]);
    await signedRequest().get('/expiry-race').expect(410);
    await signedRequest().head('/expiry-race').expect(410);
    await signedRequest().head('/preview/expiry-race').expect(410);
    await signedRequest().head('/missing-preview').expect(404);
    await signedRequest().head('/preview/missing-preview').expect(404);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [inserted.rows[0].id])).rows[0].n, 0);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [inserted.rows[0].id]); }
});

test('preview uses parsed hostname, ignores destination overrides, and never fetches target', async () => {
  let destinationRequests = 0;
  const target = createServer((_req, res) => { destinationRequests++; res.end('Target must not be fetched by preview'); });
  await new Promise<void>(resolve => target.listen(0, '127.0.0.1', resolve));
  const address = target.address();
  assert.ok(address && typeof address !== 'string');
  const destination = `http://127.0.0.1:${address.port}/long?value=%3Cscript%3E#details`;
  let id: string | undefined;
  try {
    const result = await pool.query('INSERT INTO links(code, original_url, title) VALUES ($1,$2,$3) RETURNING id', ['no-fetch-preview', destination, '<img src=x onerror=alert(1)>']);
    id = result.rows[0].id;
    const preview = await signedRequest().get('/api/links/no-fetch-preview/preview?destination=https://attacker.example').expect(200);
    assert.equal(preview.body.destinationHost, '127.0.0.1', 'hostname excludes port and is obtained through URL parsing');
    assert.equal(preview.body.originalUrl, destination);
    assert.equal(preview.body.title, '<img src=x onerror=alert(1)>');
    await signedRequest().get('/preview/no-fetch-preview?url=https://attacker.example').expect(200);
    await signedRequest().get('/api/links/no-fetch-preview/qr?download=1').expect(200);
    assert.equal(destinationRequests, 0);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [id])).rows[0].n, 0);
  } finally {
    if (id) await pool.query('DELETE FROM links WHERE id=$1', [id]);
    await new Promise<void>((resolve, reject) => target.close(error => error ? reject(error) : resolve()));
  }
});

test('invalid imported destinations and preview database errors do not expose internals or count', async () => {
  const inserted = await pool.query("INSERT INTO links(code, original_url) VALUES ('bad-stored-url', 'javascript:alert(1)') RETURNING id");
  try {
    for (const path of ['/api/links/bad-stored-url/preview', '/bad-stored-url']) {
      const response = await signedRequest().get(path).expect(500);
      assert.deepEqual(response.body, { error: 'The service is temporarily unavailable. Please try again.' });
      assert.equal(response.headers.location, undefined);
    }
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [inserted.rows[0].id])).rows[0].n, 0);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [inserted.rows[0].id]); }
  await signedRequest().get('/preview/%E0%A4%A').expect(400);
  const originalQuery = pool.query;
  // Inject a DB read failure in this isolated app instance; never touch production.
  pool.query = (() => { throw Object.assign(new Error('private database details'), { code: 'TEST_DB_FAILURE' }); }) as typeof pool.query;
  try {
    const response = await signedRequest().get('/api/links/preview-demo/preview').expect(500);
    assert.deepEqual(response.body, { error: 'The service is temporarily unavailable. Please try again.' });
    assert.ok(!JSON.stringify(response.body).includes('private'));
  } finally { pool.query = originalQuery; }
});

test('creation rate limit responds with JSON and Retry-After', async () => {
  let limited = false;
  for (let i = 0; i < 31; i++) {
    const response = await signedRequest().post('/api/links').send({});
    if (response.status === 429) {
      assert.ok(response.headers['retry-after']);
      assert.match(response.body.error, /Too many/);
      limited = true; break;
    }
    assert.equal(response.status, 400);
  }
  assert.ok(limited);
});

test('duration presets use creation time on backend, persist UTC, and default to no expiry', async t => {
  // Move Date too so this isolated request window does not inherit the rate-limit test.
  const now = Date.parse('2030-01-01T00:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  t.mock.method(clock, 'now', () => Date.now());
  for (const [preset, duration] of [['1h', 3_600_000], ['1d', 86_400_000], ['7d', 604_800_000]] as const) {
    // Simulate a form left open: creation must use the advanced server time.
    t.mock.timers.tick(120_000);
    const response = await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com/preset', expiryPreset: preset }).expect(201);
    assert.equal(response.body.createdAt, new Date(clock.now()).toISOString());
    assert.equal(Date.parse(response.body.expiresAt) - Date.parse(response.body.createdAt), duration);
    const stored = await pool.query('SELECT created_at, expires_at FROM links WHERE id=$1', [response.body.id]);
    assert.equal(stored.rows[0].expires_at.toISOString(), response.body.expiresAt);
    const preview = await signedRequest().get(`/api/links/${response.body.code}/preview`).expect(200);
    assert.equal(preview.body.expiresAt, response.body.expiresAt);
    const list = await signedRequest().get(`/api/links?q=${response.body.code}`).expect(200);
    assert.equal(list.body.items[0].expiresAt, response.body.expiresAt);
  }
  for (const fields of [{}, { expiryPreset: 'none' }]) {
    const response = await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com/never', ...fields }).expect(201);
    assert.equal(response.body.expiresAt, null);
  }
  for (const fields of [{ expiresAt: '2030-01-02T07:00:00+07:00' }, { expiryPreset: 'custom', expiresAt: '2030-01-02T07:00:00+07:00' }]) {
    const response = await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com/custom', ...fields }).expect(201);
    assert.equal(response.body.expiresAt, '2030-01-02T00:00:00.000Z', 'legacy/custom offsets normalize to UTC');
  }
});

test('expiry contract rejects invalid presets, conflicting fields and non-future custom time', async t => {
  const now = Date.parse('2031-01-01T00:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  t.mock.method(clock, 'now', () => now);
  const before = await pool.query('SELECT COUNT(*)::int AS n FROM links');
  for (const fields of [
    { expiryPreset: '2h' }, { expiryPreset: 'custom' },
    { expiryPreset: '1h', expiresAt: '2032-01-01T00:00:00Z' },
    { expiryPreset: 'none', expiresAt: '2032-01-01T00:00:00Z' },
    { expiryPreset: 'custom', expiresAt: 'invalid' },
    { expiryPreset: 'custom', expiresAt: '2031-01-01T01:00:00' },
    { expiryPreset: 'custom', expiresAt: '2030-12-31T23:59:59Z' },
    { expiryPreset: 'custom', expiresAt: '2031-01-01T00:00:00Z' },
    { expiresAt: '2031-01-01T00:00:00Z' },
  ]) await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com', ...fields }).expect(400);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM links')).rows[0].n, before.rows[0].n);
});

test('exact expiry boundary blocks GET and HEAD after an active preview without counting', async t => {
  let now = Date.parse('2032-01-01T00:00:00.000Z');
  t.mock.timers.enable({ apis: ['Date'], now });
  t.mock.method(clock, 'now', () => now);
  const created = await signedRequest().post('/api/links').send({ originalUrl: 'https://example.com/boundary?keep=1#fragment', expiryPreset: '1h' }).expect(201);
  now = Date.parse(created.body.expiresAt) - 1;
  assert.equal((await signedRequest().get(`/api/links/${created.body.code}/preview`).expect(200)).body.status, 'active');
  await signedRequest().head(`/${created.body.code}`).expect(302);
  now++;
  assert.equal((await signedRequest().get(`/api/links/${created.body.code}/preview`).expect(200)).body.status, 'expired');
  await signedRequest().get(`/preview/${created.body.code}`).expect(410);
  await signedRequest().get(`/${created.body.code}`).expect(410);
  await signedRequest().head(`/${created.body.code}`).expect(410);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [created.body.id])).rows[0].n, 0);
});

test('CSV preserves Thai, commas, quotes, newlines, UTC dates, numeric counts and expiry status without events', async t => {
  const now = Date.parse('2033-01-01T00:00:00Z'); t.mock.method(clock, 'now', () => now);
  const title = 'รายงาน, "ทดสอบ"\nบรรทัดใหม่';
  const inserted = await pool.query(`INSERT INTO links(code, original_url, title, created_at, expires_at) VALUES
    ('csv-thai', 'https://example.com/report?a=1,b=2#part', $1, '2032-12-31T23:00:00Z', '2033-01-01T00:00:00Z'),
    ('csv-no-expiry', 'https://example.com/never', 'csv fixture', '2032-12-30T00:00:00Z', NULL) RETURNING id`, [title]);
  try {
    await pool.query('UPDATE links SET owner_id=$1 WHERE id=ANY($2::bigint[])', [fixtureUserId, inserted.rows.map(r => r.id)]);
    await pool.query('INSERT INTO click_events(link_id) VALUES ($1),($1)', [inserted.rows[0].id]);
    const response = await signedRequest().get('/api/links/export.csv?q=csv-').expect(200);
    assert.match(response.headers['content-type'], /text\/csv; charset=utf-8/);
    assert.equal(response.headers['content-disposition'], 'attachment; filename="my-links-2033-01-01.csv"');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(Buffer.from(response.text).subarray(0, 3).toString('hex'), 'efbbbf');
    const rows = parseCsv(response.text); assert.equal(rows.length, 3);
    assert.equal(rows[0].length, 7); assert.equal(rows[0][0], 'ชื่อลิงก์');
    assert.deepEqual(rows[1], [title, 'https://example.com/report?a=1,b=2#part', 'http://localhost:3000/csv-thai', '2032-12-31T23:00:00.000Z', '2033-01-01T00:00:00.000Z', 'Expired', '2']);
    assert.equal(rows[2][4], ''); assert.equal(rows[2][5], 'Active'); assert.equal(rows[2][6], '0');
    assert.ok(response.text.includes(',2\r\n'), 'count stays unquoted numeric digits');
    await signedRequest().head('/api/links/export.csv?q=csv-').expect(200);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=ANY($1::bigint[])', [inserted.rows.map(r => r.id)])).rows[0].n, 2);
  } finally { await pool.query('DELETE FROM links WHERE id=ANY($1::bigint[])', [inserted.rows.map(r => r.id)]); }
});

test('CSV neutralizes spreadsheet formulas after whitespace/control characters in every untrusted text field', () => {
  for (const prefix of ['', ' ', '\t', '\r\n', '\u0000', '\u001f', '\u00a0', '\uFEFF', '\u200b', '\u2028', ' \t\u200b']) {
    for (const operator of ['=', '+', '-', '@']) {
      const value = `${prefix}${operator}SUM(1,2)`;
      assert.equal(parseCsv(csvText(value) + '\r\n')[0][0], `'${value}`);
      const text = linksCsv([{ title: value, original_url: value, code: 'code', created_at: new Date(0), expires_at: null, clicks: '0' }], value, 0);
      const row = parseCsv(text)[1];
      assert.equal(row[0], `'${value}`); assert.equal(row[1], `'${value}`);
      assert.equal(row[2], `'${value}/code`, 'even configured short URL text is sanitized');
    }
  }
  assert.equal(parseCsv(csvText('ไทย, "ปกติ"\nnext') + '\r\n')[0][0], 'ไทย, "ปกติ"\nnext');
});

test('CSV search matches history across all pages with deterministic ordering and literal wildcard handling', async () => {
  const inserted = await pool.query(`INSERT INTO links(code, original_url, title, created_at)
    SELECT 'csv-page-' || n, 'https://example.com', 'csv page %_ fixture', '2030-01-01T00:00:00Z' FROM generate_series(1,8) n RETURNING id`);
  try {
    await pool.query('UPDATE links SET owner_id=$1 WHERE id=ANY($2::bigint[])', [fixtureUserId, inserted.rows.map(r => r.id)]);
    const first = await signedRequest().get('/api/links?q=%25_&page=1&limit=6').expect(200);
    const second = await signedRequest().get('/api/links?q=%25_&page=2&limit=6').expect(200);
    assert.equal(first.body.total, 8); assert.equal(second.body.items.length, 2);
    const response = await signedRequest().get('/api/links/export.csv?q=%25_').expect(200);
    assert.deepEqual(parseCsv(response.text).slice(1).map(row => row[2]), [...first.body.items, ...second.body.items].map(link => link.shortUrl));
    for (const query of ['q=' + 'x'.repeat(121), 'q=a&q=b', 'page=1', 'status=disabled']) await signedRequest().get('/api/links/export.csv?' + query).expect(400);
    const empty = await signedRequest().get('/api/links/export.csv').query({ q: "' OR 1=1 --" }).expect(200);
    assert.equal(parseCsv(empty.text).length, 1, 'parameterized search does not interpret SQL');
  } finally { await pool.query('DELETE FROM links WHERE id=ANY($1::bigint[])', [inserted.rows.map(r => r.id)]); }
});

test('CSV empty search results download headers only', async () => {
  const response = await signedRequest().get('/api/links/export.csv?q=no-csv-results-xyz').expect(200);
  assert.equal(parseCsv(response.text).length, 1);
  assert.equal(parseCsv(response.text)[0].length, 7);
});

test('CSV accepts exactly the limit but rejects overflow without a partial download', async () => {
  await pool.query(`INSERT INTO links(code, original_url, title)
    SELECT 'csv-cap-' || n, 'https://example.com', 'csv cap fixture' FROM generate_series(1,$1::int) n`, [CSV_EXPORT_LIMIT + 1]);
  try {
    await pool.query("UPDATE links SET owner_id=$1 WHERE title='csv cap fixture'", [fixtureUserId]);
    const overflow = await signedRequest().get('/api/links/export.csv?q=csv-cap-').expect(413);
    assert.match(overflow.body.error, /10,000/); assert.equal(overflow.headers['content-disposition'], undefined);
    await pool.query('DELETE FROM links WHERE code=$1', [`csv-cap-${CSV_EXPORT_LIMIT + 1}`]);
    const response = await signedRequest().get('/api/links/export.csv?q=csv-cap-').expect(200);
    assert.equal(parseCsv(response.text).length, CSV_EXPORT_LIMIT + 1);
  } finally { await pool.query("DELETE FROM links WHERE title='csv cap fixture'"); }
});

async function account(email: string) {
  const agent = request.agent(app);
  const initial = await agent.get('/api/auth/session').expect(200);
  const registered = await agent.post('/api/auth/register').set('X-CSRF-Token', initial.body.csrfToken)
    .send({ email, password: 'Test-only-password-12345' }).expect(200);
  return { agent, token: registered.body.csrfToken as string, user: registered.body.user as { id: string; email: string },
    cookie: (registered.headers['set-cookie'] as unknown as string[]).map(value => value.split(';')[0]).join('; ') };
}

test('A/B ownership is enforced for creation, history, search, stats, CSV and private code lookup; public flows remain open', async () => {
  const a = await account('owner-a@example.test'); const b = await account('owner-b@example.test');
  const made = await a.agent.post('/api/links').set('X-CSRF-Token', a.token).send({ originalUrl: 'https://example.com/private?keep=1#frag', title: 'Owner A only' }).expect(201);
  const code = made.body.code;
  await request(app).get(`/api/links/${code}/preview`).expect(200);
  await request(app).get(`/preview/${code}`).expect(200);
  await request(app).get(`/api/links/${code}/qr`).expect(200);
  await request(app).head(`/${code}`).expect(302);
  const redirect = await request(app).get(`/${code}`).expect(302);
  assert.equal(redirect.headers.location, 'https://example.com/private?keep=1#frag');
  const mine = await a.agent.get('/api/links').expect(200); assert.equal(mine.body.total, 1); assert.equal(mine.body.items[0].clicks, 1);
  for (const path of ['/api/links', '/api/links?q=Owner', `/api/links?q=${code}`]) assert.equal((await b.agent.get(path).expect(200)).body.total, 0);
  const bStats = (await b.agent.get('/api/stats').expect(200)).body;
  assert.equal(bStats.totalLinks, 0); assert.equal(bStats.totalClicks, 0); assert.ok(bStats.daily.every((day: { clicks: number }) => day.clicks === 0));
  assert.equal((await a.agent.get('/api/stats').expect(200)).body.totalClicks, 1);
  assert.equal(parseCsv((await b.agent.get('/api/links/export.csv').expect(200)).text).length, 1);
  assert.equal(parseCsv((await a.agent.get('/api/links/export.csv').expect(200)).text).length, 2);
  await b.agent.get(`/api/links/${code}`).expect(404); await b.agent.get(`/api/links/${made.body.id}`).expect(404);
  await a.agent.get(`/api/links/${code}`).expect(200);
  await b.agent.post('/api/links').set('X-CSRF-Token', b.token).send({ originalUrl: 'https://example.com', owner_id: a.user.id }).expect(400);
  for (const path of ['/api/links', '/api/stats', '/api/links/export.csv', `/api/links/${code}`]) await request(app).get(path).expect(401);
  await request(app).post('/api/links').send({ originalUrl: 'https://example.com' }).expect(401);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1', [made.body.id])).rows[0].n, 1);
});

test('CSRF, credential errors, password hash, session rotation and logout invalidation', async () => {
  const a = await account('auth-check@example.test');
  const hash = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [a.user.id])).rows[0].password_hash;
  assert.match(hash, /^\$2[ab]\$12\$/); assert.notEqual(hash, 'Test-only-password-12345');
  assert.ok(!JSON.stringify(a.user).includes('password'));
  await a.agent.post('/api/links').send({ originalUrl: 'https://example.com' }).expect(403);
  await a.agent.post('/api/links').set('X-CSRF-Token', fixtureCsrf).send({ originalUrl: 'https://example.com' }).expect(403);
  await a.agent.post('/api/links').set('Origin', 'https://attacker.example').set('X-CSRF-Token', a.token).send({ originalUrl: 'https://example.com' }).expect(403);
  const stranger = request.agent(app); const initial = await stranger.get('/api/auth/session').expect(200);
  for (const email of ['auth-check@example.test', 'does-not-exist@example.test']) {
    const failed = await stranger.post('/api/auth/login').set('X-CSRF-Token', initial.body.csrfToken).send({ email, password: 'Wrong-password-12345' }).expect(401);
    assert.deepEqual(failed.body, { error: 'Email or password is incorrect.' });
  }
  const login = await stranger.post('/api/auth/login').set('X-CSRF-Token', initial.body.csrfToken).send({ email: 'AUTH-CHECK@example.test', password: 'Test-only-password-12345' }).expect(200);
  assert.notEqual(login.body.csrfToken, initial.body.csrfToken);
  assert.notEqual(login.headers['set-cookie'][0].split(';')[0], initial.headers['set-cookie'][0].split(';')[0]);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/); assert.match(login.headers['set-cookie'][0], /SameSite=Lax/);
  await a.agent.post('/api/auth/logout').set('X-CSRF-Token', a.token).expect(204);
  await request(app).get('/api/links').set('Cookie', a.cookie).expect(401);
  await a.agent.get('/api/links').expect(401);
  assert.equal((await a.agent.get('/api/auth/session').expect(200)).body.user, null);
});

test('absolute session expiry revokes server state and blocks private APIs', async t => {
  const a = await account('expiring-session@example.test');
  const expiry = (await pool.query("SELECT (sess->>'authExpiresAt')::bigint AS expires FROM sessions WHERE sess->'passport'->>'user'=$1", [a.user.id])).rows[0].expires;
  t.mock.method(clock, 'now', () => Number(expiry));
  await request(app).get('/api/links').set('Cookie', a.cookie).expect(401);
  await request(app).post('/api/links').set('Cookie', a.cookie).set('X-CSRF-Token', a.token).send({ originalUrl: 'https://example.com' }).expect(401);
  assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM sessions WHERE sess->'passport'->>'user'=$1", [a.user.id])).rows[0].n, 0);
});

test('auth migration preserves old links/events and leaves legacy ownership unclaimed', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN'); await client.query('CREATE SCHEMA auth_upgrade_check'); await client.query('SET LOCAL search_path TO auth_upgrade_check');
    await client.query(await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8'));
    await client.query("INSERT INTO links(code, original_url) VALUES('old-link', 'https://example.com/old'); INSERT INTO click_events(link_id) SELECT id FROM links");
    const sql = await readFile(new URL('../migrations/002_auth.sql', import.meta.url), 'utf8'); await client.query(sql); await client.query(sql);
    await client.query("INSERT INTO users(email,password_hash) VALUES('legacy-owner@example.test','legacy-hash')");
    const profileSql = await readFile(new URL('../migrations/003_profile.sql', import.meta.url), 'utf8');
    await client.query(profileSql); await client.query(profileSql);
    assert.deepEqual((await client.query('SELECT email,password_hash,display_name FROM users')).rows[0], { email: 'legacy-owner@example.test', password_hash: 'legacy-hash', display_name: '' });
    const statusSql = await readFile(new URL('../migrations/004_link_status.sql', import.meta.url), 'utf8');
    await client.query(statusSql); assert.equal((await client.query('SELECT is_active FROM links')).rows[0].is_active,true); await client.query('UPDATE links SET is_active=false'); await client.query(statusSql);
    assert.equal((await client.query('SELECT is_active FROM links')).rows[0].is_active,false);
    const row = (await client.query('SELECT code, original_url, owner_id, (SELECT COUNT(*)::int FROM click_events) AS events FROM links')).rows[0];
    assert.deepEqual(row, { code: 'old-link', original_url: 'https://example.com/old', owner_id: null, events: 1 });
  } finally { await client.query('ROLLBACK'); client.release(); }
  const old = await pool.query("INSERT INTO links(code, original_url) VALUES('legacy-auth', 'https://example.com/old') RETURNING id");
  try {
    await request(app).get('/legacy-auth').expect(302); await request(app).get('/api/links/legacy-auth/qr').expect(200);
    await request(app).get('/api/links/legacy-auth/preview').expect(200);
    assert.equal((await signedRequest().get('/api/links?q=legacy-auth').expect(200)).body.total, 0);
    assert.equal(parseCsv((await signedRequest().get('/api/links/export.csv?q=legacy-auth').expect(200)).text).length, 1);
    await signedRequest().get('/api/links/legacy-auth').expect(404);
    assert.equal((await pool.query('SELECT owner_id FROM links WHERE id=$1', [old.rows[0].id])).rows[0].owner_id, null);
  } finally { await pool.query('DELETE FROM links WHERE id=$1', [old.rows[0].id]); }
});

test('profile update is private, validated, CSRF-protected and persists without changing ownership', async () => {
  const a = await account('profile-a@example.test'); const b = await account('profile-b@example.test');
  await request(app).patch('/api/auth/profile').send({ displayName: 'Anonymous' }).expect(401);
  await a.agent.patch('/api/auth/profile').send({ displayName: 'Missing CSRF' }).expect(403);
  for (const body of [{ displayName: '' }, { displayName: 'x'.repeat(81) }, { displayName: 'bad\u0000name' }, { displayName: 'Name', id: b.user.id }]) {
    await a.agent.patch('/api/auth/profile').set('X-CSRF-Token', a.token).send(body).expect(400);
  }
  const result = await a.agent.patch('/api/auth/profile').set('X-CSRF-Token', a.token).send({ displayName: '  Nicky <script> & Thai  ' }).expect(200);
  assert.equal(result.body.user.displayName, 'Nicky <script> & Thai');
  assert.equal(result.body.user.id, a.user.id); assert.equal(result.body.user.email, a.user.email);
  assert.equal((await a.agent.get('/api/auth/session').expect(200)).body.user.displayName, 'Nicky <script> & Thai');
  assert.equal((await b.agent.get('/api/auth/session').expect(200)).body.user.displayName, '');
});

test('password change validates current credentials, revokes all own sessions and preserves links and other users', async () => {
  const a = await account('password-a@example.test'); const b = await account('password-b@example.test');
  const second = request.agent(app); const bootstrap = await second.get('/api/auth/session').expect(200);
  await second.post('/api/auth/login').set('X-CSRF-Token', bootstrap.body.csrfToken).send({ email: a.user.email, password: 'Test-only-password-12345' }).expect(200);
  const made = await a.agent.post('/api/links').set('X-CSRF-Token', a.token).send({ originalUrl: 'https://example.com/password-change?keep=1#frag' }).expect(201);
  const write = (body: unknown) => a.agent.post('/api/auth/password').set('X-CSRF-Token', a.token).send(body as object);
  await request(app).post('/api/auth/password').send({}).expect(401);
  await a.agent.post('/api/auth/password').send({}).expect(403);
  await write({ currentPassword: 'wrong-password-1234', newPassword: 'New-test-password-1234' }).expect(400);
  await write({ currentPassword: 'Test-only-password-12345', newPassword: 'short' }).expect(400);
  await write({ currentPassword: 'Test-only-password-12345', newPassword: 'x'.repeat(73) }).expect(400);
  await write({ currentPassword: 'Test-only-password-12345', newPassword: 'Test-only-password-12345' }).expect(400);
  await write({ currentPassword: 'Test-only-password-12345', newPassword: 'New-test-password-1234', id: b.user.id }).expect(400);
  await write({ currentPassword: 'Test-only-password-12345', newPassword: 'New-test-password-1234' }).expect(204);
  await a.agent.get('/api/links').expect(401); await second.get('/api/links').expect(401);
  await request(app).get('/api/links').set('Cookie', a.cookie).expect(401);
  await b.agent.get('/api/links').expect(200);
  const anon = await a.agent.get('/api/auth/session').expect(200);
  await a.agent.post('/api/auth/login').set('X-CSRF-Token', anon.body.csrfToken).send({ email: a.user.email, password: 'Test-only-password-12345' }).expect(401);
  const logged = await a.agent.post('/api/auth/login').set('X-CSRF-Token', anon.body.csrfToken).send({ email: a.user.email, password: 'New-test-password-1234' }).expect(200);
  const link = await a.agent.get(`/api/links/${made.body.code}`).expect(200); assert.equal(link.body.clicks, 0);
  await request(app).get(`/api/links/${made.body.code}/qr`).expect(200);
  await request(app).get(`/${made.body.code}`).expect(302).expect('Location', 'https://example.com/password-change?keep=1#frag');
  assert.ok(logged.body.user.id === a.user.id);
});

test('owner-only explicit link status preserves QR, opens and ownership; disabled flows never count', async () => {
  const a = await account('status-a@example.test'); const b = await account('status-b@example.test');
  const originalUrl = 'https://example.com/status?keep=1#fragment';
  const made = (await a.agent.post('/api/links').set('X-CSRF-Token', a.token).send({ originalUrl, title: 'Status link' }).expect(201)).body;
  assert.equal(made.isActive, true); assert.equal(made.status, 'active');
  const patch = (value: unknown) => a.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token', a.token).send(value as object);
  const qrBefore = await request(app).get(`/api/links/${made.code}/qr`).expect(200);
  const previewBefore = await request(app).get(`/api/links/${made.code}/preview`).expect(200);
  await request(app).get(`/${made.code}`).expect(302).expect('Location', originalUrl);
  await request(app).patch(`/api/links/${made.code}/status`).send({ isActive: false }).expect(401);
  await b.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token', b.token).send({ isActive: false }).expect(404);
  await a.agent.patch(`/api/links/${made.code}/status`).send({ isActive: false }).expect(403);
  await a.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token', b.token).send({ isActive: false }).expect(403);
  await a.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token', a.token).set('Origin', 'https://evil.example').send({ isActive: false }).expect(403);
  for (const body of [{}, { isActive: 'false' }, { isActive: 0 }, { isActive: null }, { isActive: true, owner_id: b.user.id }, { toggle: true }]) await patch(body).expect(400);
  const unchanged = (await pool.query('SELECT is_active,owner_id FROM links WHERE id=$1',[made.id])).rows[0];
  assert.equal(unchanged.is_active,true); assert.equal(String(unchanged.owner_id),a.user.id);
  for (let i=0;i<2;i++) { const disabled = await patch({ isActive: false }).expect(200); assert.equal(disabled.body.status,'disabled'); assert.equal(disabled.body.clicks,1); }
  const preview = await request(app).get(`/api/links/${made.code}/preview`).expect(200);
  assert.equal(preview.body.status,'disabled'); assert.equal(preview.body.isActive,false);
  await request(app).get(`/preview/${made.code}`).expect(410);
  for (const method of ['get','head'] as const) { const result = await request(app)[method](previewBefore.body.shortUrl.replace('http://localhost:3000','')).expect(410); assert.equal(result.headers.location,undefined); }
  const qrAfter = await request(app).get(`/api/links/${made.code}/qr?download=1`).expect(200); assert.deepEqual(qrAfter.body,qrBefore.body);
  const png = PNG.sync.read(qrAfter.body); assert.equal(jsQR(new Uint8ClampedArray(png.data),png.width,png.height)?.data,made.shortUrl);
  const detail = (await a.agent.get(`/api/links/${made.code}`).expect(200)).body; assert.equal(detail.status,'disabled'); assert.equal(detail.clicks,1);
  const history = (await a.agent.get('/api/links?q=Status%20link').expect(200)).body; assert.equal(history.items[0].status,'disabled');
  const csv = parseCsv((await a.agent.get('/api/links/export.csv?q=Status%20link').expect(200)).text); assert.equal(csv[1][5],'Disabled'); assert.equal(csv[1][6],'1');
  const stats = (await a.agent.get('/api/stats').expect(200)).body; assert.equal(stats.activeLinks,0); assert.equal(stats.totalClicks,1);
  for (let i=0;i<2;i++) { const enabled = await patch({ isActive: true }).expect(200); assert.equal(enabled.body.status,'active'); assert.equal(enabled.body.shortUrl,made.shortUrl); assert.equal(enabled.body.expiresAt,made.expiresAt); }
  await request(app).get(previewBefore.body.shortUrl.replace('http://localhost:3000','')).expect(302).expect('Location',originalUrl);
  assert.equal((await a.agent.get(`/api/links/${made.code}`).expect(200)).body.clicks,2);
  const orphan = (await pool.query("INSERT INTO links(code,original_url) VALUES('status-orphan','https://example.com/legacy') RETURNING id")).rows[0];
  await a.agent.patch('/api/links/status-orphan/status').set('X-CSRF-Token',a.token).send({ isActive:false }).expect(404);
  assert.equal((await pool.query('SELECT is_active FROM links WHERE id=$1',[orphan.id])).rows[0].is_active,true);
  await request(app).get('/status-orphan').expect(302);
});

test('expired sessions cannot change status; disabled precedes expiry and enabling never extends it', async t => {
  const a = await account('status-expiry@example.test');
  const expiresAt = new Date(clock.now()+60_000).toISOString();
  const made = (await a.agent.post('/api/links').set('X-CSRF-Token',a.token).send({ originalUrl:'https://example.com/status-expiry', expiresAt }).expect(201)).body;
  await a.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token',a.token).send({ isActive:false }).expect(200);
  t.mock.method(clock,'now',()=>new Date(expiresAt).getTime());
  assert.equal((await request(app).get(`/api/links/${made.code}/preview`).expect(200)).body.status,'disabled');
  assert.equal(parseCsv((await a.agent.get('/api/links/export.csv?q=status-expiry').expect(200)).text)[1][5],'Disabled');
  const enabled = await a.agent.patch(`/api/links/${made.code}/status`).set('X-CSRF-Token',a.token).send({ isActive:true }).expect(200);
  assert.equal(enabled.body.status,'expired'); assert.equal(enabled.body.expiresAt,expiresAt);
  assert.equal((await request(app).get(`/api/links/${made.code}/preview`).expect(200)).body.status,'expired');
  assert.equal(parseCsv((await a.agent.get('/api/links/export.csv?q=status-expiry').expect(200)).text)[1][5],'Expired');
  await request(app).get(`/${made.code}`).expect(410); await request(app).head(`/${made.code}`).expect(410);
  assert.equal((await a.agent.get(`/api/links/${made.code}`).expect(200)).body.clicks,0);
  const expiry = (await pool.query("SELECT (sess->>'authExpiresAt')::bigint AS expires FROM sessions WHERE sess->'passport'->>'user'=$1",[a.user.id])).rows[0].expires;
  t.mock.method(clock,'now',()=>Number(expiry));
  await request(app).patch(`/api/links/${made.code}/status`).set('Cookie',a.cookie).set('X-CSRF-Token',a.token).send({ isActive:false }).expect(401);
  assert.equal((await pool.query('SELECT is_active FROM links WHERE id=$1',[made.id])).rows[0].is_active,true);
});

test('redirect waits for an in-flight status update and never records after a committed disable', async () => {
  const made = (await signedRequest().post('/api/links').send({ originalUrl:'https://example.com/status-race' }).expect(201)).body;
  const client = await pool.connect();
  let redirect: Promise<request.Response> | undefined;
  try {
    await client.query('BEGIN'); await client.query('UPDATE links SET is_active=false WHERE id=$1',[made.id]);
    redirect = request(app).get(`/${made.code}`).then(value=>value);
    // Wait for PostgreSQL to confirm the real request is blocked on the row lock.
    let blocked = false;
    for (let i=0;i<100;i++) {
      const rows = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id, original_url, expires_at, is_active FROM links%'");
      if (rows.rowCount) { blocked=true; break; }
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok(blocked,'redirect must acquire a share lock before deciding/counting');
    await client.query('COMMIT'); const result = await redirect; assert.equal(result.status,410); assert.equal(result.headers.location,undefined);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM click_events WHERE link_id=$1',[made.id])).rows[0].n,0);
  } finally { await client.query('ROLLBACK'); client.release(); if(redirect) await redirect; }
});

test('registration validates and persists display name without changing legacy credentials contract', async t => {
  // A fresh auth limiter window keeps validation independent from earlier login tests.
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 16 * 60_000 });
  const agent = request.agent(app);
  const initial = await agent.get('/api/auth/session').expect(200);
  const email = 'named-registration@example.test';
  const password = 'registration-test-password';
  for (const displayName of ['   ', 'x'.repeat(81), 'bad\u0000name']) {
    await agent.post('/api/auth/register').set('X-CSRF-Token', initial.body.csrfToken)
      .send({ email, password, displayName }).expect(400);
  }
  await agent.post('/api/auth/register').set('X-CSRF-Token', initial.body.csrfToken)
    .send({ email, password, displayName: 'Name', ownerId: fixtureUserId }).expect(400);
  assert.equal((await pool.query('SELECT id FROM users WHERE email=$1', [email])).rowCount, 0);
  const registered = await agent.post('/api/auth/register').set('X-CSRF-Token', initial.body.csrfToken)
    .send({ email, password, displayName: '  นิกกี้ Link Studio  ' }).expect(200);
  assert.equal(registered.body.user.displayName, 'นิกกี้ Link Studio');
  const stored = (await pool.query('SELECT display_name,password_hash FROM users WHERE email=$1', [email])).rows[0];
  assert.equal(stored.display_name, 'นิกกี้ Link Studio');
  assert.notEqual(stored.password_hash, password);
  assert.ok(stored.password_hash.startsWith('$2'));
  assert.equal((await agent.get('/api/auth/session').expect(200)).body.user.displayName, 'นิกกี้ Link Studio');
  await agent.post('/api/auth/logout').set('X-CSRF-Token', registered.body.csrfToken).expect(204);
  const fresh = await agent.get('/api/auth/session').expect(200);
  const login = await agent.post('/api/auth/login').set('X-CSRF-Token', fresh.body.csrfToken).send({ email, password }).expect(200);
  assert.equal(login.body.user.displayName, 'นิกกี้ Link Studio');
});

test('profile photos normalize pixels, persist across login and remain owner-only', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 32 * 60_000 });
  const a = await account('avatar-a@example.test'); const b = await account('avatar-b@example.test');
  const png = await sharp({ create: { width: 12, height: 8, channels: 3, background: '#c8ed86' } }).png().toBuffer();
  await request(app).put('/api/auth/avatar').type('image/png').send(png).expect(401);
  await request(app).get('/api/auth/avatar').expect(401);
  await request(app).delete('/api/auth/avatar').expect(401);
  await a.agent.put('/api/auth/avatar').type('image/png').send(png).expect(403);
  await a.agent.get('/api/auth/avatar').expect(404);
  const added = await a.agent.put('/api/auth/avatar').set('X-CSRF-Token', a.token).type('image/png').send(png).expect(200);
  assert.ok(added.body.user.avatarUrl.startsWith('/api/auth/avatar?v='));
  const stored = (await pool.query('SELECT avatar_image,avatar_version FROM users WHERE id=$1', [a.user.id])).rows[0];
  const metadata = await sharp(stored.avatar_image).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 256); assert.equal(metadata.height, 256);
  assert.equal(metadata.exif, undefined); assert.ok(stored.avatar_image.length <= 262144);
  const photo = await a.agent.get(added.body.user.avatarUrl).expect(200);
  assert.equal(photo.headers['content-type'], 'image/webp'); assert.ok(photo.headers['cache-control'].includes('no-store'));
  assert.equal(photo.headers['x-content-type-options'], 'nosniff');
  await b.agent.get(added.body.user.avatarUrl + '&userId=' + a.user.id).expect(404);
  await b.agent.put('/api/auth/avatar?userId=' + a.user.id).set('X-CSRF-Token', b.token).type('image/png').send(png).expect(200);
  await b.agent.delete('/api/auth/avatar?userId=' + a.user.id).set('X-CSRF-Token', b.token).expect(200);
  assert.equal((await pool.query('SELECT avatar_version FROM users WHERE id=$1', [a.user.id])).rows[0].avatar_version, stored.avatar_version);
  const rename = await a.agent.patch('/api/auth/profile').set('X-CSRF-Token', a.token).send({ displayName: 'Avatar owner' }).expect(200);
  assert.equal(rename.body.user.avatarUrl, added.body.user.avatarUrl);
  const jpeg = await sharp(png).jpeg().withExif({ IFD0: { Artist: 'test metadata' } }).toBuffer();
  const replaced = await a.agent.put('/api/auth/avatar').set('X-CSRF-Token', a.token).type('image/jpeg').send(jpeg).expect(200);
  assert.notEqual(replaced.body.user.avatarUrl, added.body.user.avatarUrl);
  const after = (await pool.query('SELECT avatar_image FROM users WHERE id=$1', [a.user.id])).rows[0];
  assert.equal((await sharp(after.avatar_image).metadata()).exif, undefined);
  assert.equal((await a.agent.get('/api/auth/session')).body.user.avatarUrl, replaced.body.user.avatarUrl);
  await a.agent.post('/api/auth/logout').set('X-CSRF-Token', a.token).expect(204);
  const anonymous = await a.agent.get('/api/auth/session');
  const relogin = await a.agent.post('/api/auth/login').set('X-CSRF-Token', anonymous.body.csrfToken)
    .send({ email: 'avatar-a@example.test', password: 'Test-only-password-12345' }).expect(200);
  assert.equal(relogin.body.user.avatarUrl, replaced.body.user.avatarUrl);
  const removed = await a.agent.delete('/api/auth/avatar').set('X-CSRF-Token', relogin.body.csrfToken).expect(200);
  assert.equal(removed.body.user.avatarUrl, null); await a.agent.get('/api/auth/avatar').expect(404);
  await a.agent.delete('/api/auth/avatar').set('X-CSRF-Token', relogin.body.csrfToken).expect(200);
});

test('invalid, oversized and expired-session photo uploads cannot replace saved photos', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 48 * 60_000 });
  const a = await account('avatar-validation@example.test');
  const put = (type: string, bytes: Buffer) => a.agent.put('/api/auth/avatar').set('X-CSRF-Token', a.token).type(type).send(bytes);
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer();
  const valid = await put('image/png', png).expect(200); const version = valid.body.user.avatarUrl;
  await put('image/jpeg', png).expect(400);
  await put('image/png', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).expect(400);
  await put('image/png', png.subarray(0, 20)).expect(400);
  await put('image/png', Buffer.alloc(0)).expect(400);
  await put('image/svg+xml', Buffer.from('<svg/>')).expect(415);
  await put('image/png', Buffer.alloc(2 * 1024 * 1024 + 1)).expect(413);
  const huge = await sharp({ create: { width: 4097, height: 4097, channels: 3, background: '#123456' } }).png().toBuffer();
  await put('image/png', huge).expect(400);
  assert.equal((await a.agent.get('/api/auth/session')).body.user.avatarUrl, version);
  await pool.query("UPDATE sessions SET sess=jsonb_set(sess::jsonb,'{authExpiresAt}','1'::jsonb)::json WHERE sess->'passport'->>'user'=$1", [a.user.id]);
  await put('image/png', png).expect(401);
  await a.agent.delete('/api/auth/avatar').set('X-CSRF-Token', a.token).expect(401);
  assert.equal((await pool.query('SELECT avatar_version FROM users WHERE id=$1',[a.user.id])).rows[0].avatar_version, version.split('=')[1]);
});

test('login and register have bounded request rates', async () => {
  const agent = request.agent(app); const initial = await agent.get('/api/auth/session').expect(200);
  for (const endpoint of ['login', 'register']) {
    let limited = false;
    for (let i = 0; i < 21; i++) {
      const response = await agent.post(`/api/auth/${endpoint}`).set('X-CSRF-Token', initial.body.csrfToken).send({});
      if (response.status === 429) { assert.ok(response.headers['retry-after']); limited = true; break; }
      assert.equal(response.status, 400);
    }
    assert.ok(limited);
  }
});
