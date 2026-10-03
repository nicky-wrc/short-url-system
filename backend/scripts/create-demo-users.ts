import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { configuredReviewerAccount, createReviewerAccount } from '../src/demo-account.js';

// Deliberate opt-in demo accounts. Never overwrites an existing user's password.
const accounts: string[] = [];
try {
  const reviewer = configuredReviewerAccount(process.env);
  if (reviewer) {
    const created = await createReviewerAccount(reviewer);
    console.log(created ? 'Reviewer account created. Use credentials set privately in backend/.env.' : 'Reviewer email already exists; password and profile unchanged.');
  } else for (const email of ['demo-a@linkstudio.example', 'demo-b@linkstudio.example']) {
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
} catch {
  console.error('Demo account setup failed. Check reviewer environment values and database/schema access. No credentials were printed.');
  process.exitCode = 1;
} finally { await pool.end(); }
