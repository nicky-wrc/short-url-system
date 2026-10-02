import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

export async function waitForApi(url, { timeoutMs = 60_000, intervalMs = 500, requestTimeoutMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.max(1, Math.min(requestTimeoutMs, deadline - Date.now()))) });
      const body = await response.json();
      if (response.ok && body.status === 'ok' && body.database === 'connected') return;
    } catch { /* Retry only this read-only readiness request; never log private errors. */ }
    const remaining = deadline - Date.now();
    if (remaining > 0) await delay(Math.min(intervalMs, remaining));
  }
  throw new Error('Backend was not ready before the startup timeout. Check the API terminal and database connection.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const env = parse(await readFile(new URL('../backend/.env', import.meta.url), 'utf8'));
    const port = Number(process.env.PORT ?? env.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Set a valid backend PORT.');
    console.log('Waiting for backend and PostgreSQL readiness before starting the frontend…');
    await waitForApi(`http://127.0.0.1:${port}/api/health`);
    console.log('Backend is ready. Starting frontend.');
  } catch (reason) { console.error(reason.code === 'ENOENT' ? 'backend/.env is missing. Configure it before starting.' : reason.message); process.exitCode = 1; }
}
