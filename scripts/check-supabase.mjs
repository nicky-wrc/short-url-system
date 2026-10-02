// Non-destructive smoke check: keeps one clearly named demo link; never truncates tables.
import assert from 'node:assert/strict';
import request from 'supertest';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { app } from '../backend/dist/app.js';
import { pool } from '../backend/dist/db.js';
try {
  await request(app).get('/api/health').expect(200);
  const created = await request(app).post('/api/links').send({
    originalUrl: 'https://www.synerry.com/', title: 'Supabase smoke test',
  }).expect(201);
  const { id, code, shortUrl } = created.body;
  const redirect = await request(app).get(`/${code}`).expect(302);
  assert.equal(redirect.headers.location, 'https://www.synerry.com/');
  await request(app).head(`/${code}`).expect(302);
  const qr = await request(app).get(`/api/links/${code}/qr?download=1`).expect(200);
  const png = PNG.sync.read(qr.body);
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, shortUrl);
  const opens = await pool.query('SELECT COUNT(*)::int AS count FROM click_events WHERE link_id=$1', [id]);
  assert.equal(opens.rows[0].count, 1);
  const history = await request(app).get(`/api/links?q=${code}`).expect(200);
  assert.equal(history.body.items[0].clicks, 1);
  await request(app).post('/api/links').send({ originalUrl: 'javascript:alert(1)' }).expect(400);
  const counts = await pool.query('SELECT (SELECT COUNT(*) FROM links)::int AS links, (SELECT COUNT(*) FROM click_events)::int AS events');
  console.log(JSON.stringify({ result: 'PASS', checks: ['TLS database connectivity', 'create', '302 redirect', 'HEAD not counted', 'QR decoded to short URL', 'persisted opens', 'history', 'invalid URL rejected'], totals: counts.rows[0], demoCode: code }));
} catch (error) {
  console.error('Supabase check failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally { await pool.end(); }
