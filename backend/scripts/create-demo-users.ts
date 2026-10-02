import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

// Deliberate opt-in demo accounts. Never overwrites an existing user's password.
const accounts: string[] = [];
try {
  for (const email of ['demo-a@linkstudio.example', 'demo-b@linkstudio.example']) {
    const password = randomBytes(18).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    const inserted = await pool.query('INSERT INTO users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id', [email, hash]);
    if (inserted.rowCount) accounts.push(`Email: ${email}\nPassword: ${password}\n`);
    else console.log(`${email}: exists; password unchanged.`);
  }
  if (accounts.length) {
    const directory = new URL('../../tmp/', import.meta.url);
    await mkdir(directory, { recursive: true });
    const file = new URL(`demo-accounts-${Date.now()}.txt`, directory);
    await writeFile(file, 'LOCAL REVIEWER CREDENTIALS — NEVER COMMIT OR UPLOAD THIS FILE\n\n' + accounts.join('\n'), { mode: 0o600 });
    console.log(`Created ${accounts.length} demo accounts. Credentials saved only to ignored tmp/${file.pathname.split('/').pop()}`);
  }
} finally { await pool.end(); }
