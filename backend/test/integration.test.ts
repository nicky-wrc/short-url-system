import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import dotenv from 'dotenv';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';

dotenv.config({ path: '.env', quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !new URL(testUrl).pathname.endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated database whose name ends in _test. Tests delete all its links.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
// Local test database is independent from the hosted database's TLS settings.
process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL ?? 'false';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
const { app } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { migrate } = await import('../src/migrate.js');
before(async () => { await migrate(); await pool.query('TRUNCATE links, click_events RESTART IDENTITY CASCADE'); });
after(async () => { await pool.query('TRUNCATE links, click_events RESTART IDENTITY CASCADE'); await pool.end(); });

test('health reports PostgreSQL connectivity', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.database, 'connected');
});
test('create → real HTTP redirect → stored history and accurate concurrent opens', async () => {
  const created = await request(app).post('/api/links').send({ originalUrl: 'https://www.synerry.com/?utm_source=demo#about', title: 'SYNERRY demo' }).expect(201);
  const { code, shortUrl } = created.body;
  assert.match(code, /^[A-Za-z0-9_-]{8}$/);
  assert.equal(shortUrl, `http://localhost:3000/${code}`);
  await request(app).head(`/${code}`).expect(302);
  const first = await request(app).get(`/${code}`).expect(302);
  assert.equal(first.headers.location, 'https://www.synerry.com/?utm_source=demo#about');
  assert.equal(first.headers['cache-control'], 'no-store');
  await Promise.all(Array.from({ length: 12 }, () => request(app).get(`/${code}`).expect(302)));
  const list = await request(app).get('/api/links?q=SYNERRY%20demo').expect(200);
  assert.equal(list.body.total, 1);
  assert.equal(list.body.items[0].clicks, 13);
  const persisted = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id = $1', [created.body.id]);
  assert.equal(persisted.rows[0].count, 13);
});
test('QR is PNG, downloadable, and does not count as an opening', async () => {
  const created = await request(app).post('/api/links').send({ originalUrl: 'https://example.com/qr', customAlias: 'qr-demo' }).expect(201);
  const qr = await request(app).get('/api/links/qr-demo/qr?download=1').expect(200);
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
  const responses = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/api/links').send({ originalUrl: 'https://example.com', customAlias: 'unique-alias' })));
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
  ]) await request(app).post('/api/links').send(body).expect(400);
  await request(app).post('/api/links').set('Content-Type', 'application/json').send('{bad json').expect(400);
});
test('missing and expired links do not record opens', async () => {
  await request(app).get('/no-such-link').expect(404);
  await request(app).get('/api/links/missing-link/qr').expect(404);
  const inserted = await pool.query("INSERT INTO links(code, original_url, expires_at) VALUES ('expired-link', 'https://example.com', NOW() - INTERVAL '1 day') RETURNING id");
  await request(app).get('/expired-link').expect(410);
  const count = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [inserted.rows[0].id]);
  assert.equal(count.rows[0].count, 0);
});
test('pagination, literal search and UTC stats work', async () => {
  const page = await request(app).get('/api/links?page=1&limit=2').expect(200);
  assert.equal(page.body.items.length, 2);
  await request(app).get('/api/links?page=-1').expect(400);
  await request(app).get('/api/links?limit=100').expect(400);
  const literal = await request(app).get('/api/links?q=%25').expect(200);
  assert.equal(literal.body.total, 0);
  const stats = await request(app).get('/api/stats').expect(200);
  assert.equal(stats.body.totalClicks, 13);
  assert.equal(stats.body.daily.length, 7);
  assert.equal(stats.body.timezone, 'UTC');
  assert.equal(stats.body.activeLinks, stats.body.totalLinks - 1);
});
test('API errors have JSON bodies and unknown routes are 404', async () => {
  const response = await request(app).get('/api/unknown').expect(404);
  assert.ok(response.body.error);
  await request(app).get('/path/that/does/not/exist').expect(404);
});

test('creation rate limit responds with JSON and Retry-After', async () => {
  let limited = false;
  for (let i = 0; i < 31; i++) {
    const response = await request(app).post('/api/links').send({});
    if (response.status === 429) {
      assert.ok(response.headers['retry-after']);
      assert.match(response.body.error, /Too many/);
      limited = true; break;
    }
    assert.equal(response.status, 400);
  }
  assert.ok(limited);
});
