import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const schema = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
  PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DATABASE_SSL_CA_FILE: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  AUTH_ORIGIN: z.url().optional(),
  // Optional: the rest of Link Studio runs normally without an AI key.
  OPENAI_API_KEY: z.string().trim().default(''),
  OPENAI_MODEL: z.string().trim().regex(/^[A-Za-z0-9._-]{1,80}$/).default('gpt-5-mini'),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
const base = new URL(parsed.data.PUBLIC_BASE_URL);
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
  throw new Error('PUBLIC_BASE_URL must be an http(s) origin without credentials, path, query or fragment');
}
const authOrigin = new URL(parsed.data.AUTH_ORIGIN ?? base.origin);
if (!['http:', 'https:'].includes(authOrigin.protocol) || authOrigin.origin !== authOrigin.href.replace(/\/$/, '')) throw new Error('AUTH_ORIGIN must be an http(s) origin');
if (parsed.data.SESSION_SECRET.startsWith('replace-')) throw new Error('Replace the SESSION_SECRET placeholder with a random secret');
export const config = { ...parsed.data, PUBLIC_BASE_URL: base.origin, AUTH_ORIGIN: authOrigin.origin };
