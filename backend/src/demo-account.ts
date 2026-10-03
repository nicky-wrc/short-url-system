import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

export function configuredReviewerAccount(env: NodeJS.ProcessEnv) {
  const email = env.DEMO_REVIEWER_EMAIL?.trim() ?? '';
  const password = env.DEMO_REVIEWER_PASSWORD ?? '';
  const displayName = env.DEMO_REVIEWER_NAME?.trim() || 'Reviewer';
  if (!email && !password) return null;
  const parsed = z.object({
    email: z.email().max(254).transform(value => value.toLowerCase()),
    password: z.string().min(10).refine(value => Buffer.byteLength(value,'utf8') <= 72),
    displayName: z.string().min(1).max(80).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value)),
  }).safeParse({email,password,displayName});
  // Never interpolate environment values or Zod input in an error.
  if (!parsed.success) throw new Error('Set a valid DEMO_REVIEWER_EMAIL, password of at least 10 characters / at most 72 UTF-8 bytes, and name of 1-80 characters.');
  return parsed.data;
}
export async function createReviewerAccount(account: {email:string;password:string;displayName:string}) {
  const hash = await bcrypt.hash(account.password,12);
  const result = await pool.query('INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id', [account.email,hash,account.displayName]);
  return !!result.rowCount;
}
