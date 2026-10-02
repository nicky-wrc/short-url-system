import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { waitForApi } from './wait-api.mjs';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}/api/health`); }
  finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
test('dev startup waits through unavailable API responses until PostgreSQL is ready', async () => {
  let calls = 0;
  await withServer((req,res) => {
    assert.equal(req.method,'GET'); assert.equal(req.url,'/api/health'); calls++;
    res.statusCode = calls < 3 ? 503 : 200;
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify(calls < 3 ? {status:'unavailable',database:'disconnected'} : {status:'ok',database:'connected'}));
  }, async url => { await waitForApi(url,{timeoutMs:1000,intervalMs:5}); assert.equal(calls,3); });
});
test('dev startup has a bounded timeout and does not accept an unrelated HTTP 200 service', async () => {
  await withServer((_req,res) => res.end('{"status":"ok"}'), async url => {
    await assert.rejects(waitForApi(url,{timeoutMs:60,intervalMs:5}), /startup timeout/);
  });
});
test('dev startup bounds each hanging health request', async () => {
  await withServer(()=>{}, async url => {
    await assert.rejects(waitForApi(url,{timeoutMs:60,intervalMs:5,requestTimeoutMs:10}), /startup timeout/);
  });
});
