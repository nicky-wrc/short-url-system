import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const path = new URL(process.argv.includes('--compose') ? '../.env' : '../backend/.env', import.meta.url);
const text = await readFile(path, 'utf8');
const current = text.match(/^SESSION_SECRET=(.*)$/m)?.[1]?.trim();
if (current && current.length >= 32 && !current.startsWith('replace-')) {
  console.log('Existing session secret retained.');
} else {
  const line = 'SESSION_SECRET=' + randomBytes(48).toString('hex');
  await writeFile(path, /^SESSION_SECRET=/m.test(text) ? text.replace(/^SESSION_SECRET=.*$/m, line) : text + '\n' + line + '\n', { mode: 0o600 });
  console.log('Random session secret saved to ignored environment file; value not printed.');
}
