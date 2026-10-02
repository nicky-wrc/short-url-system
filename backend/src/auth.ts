import { Router, raw, type RequestHandler } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Passport } from 'passport';
import { Strategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { normalizeAvatar } from './avatar.js';
import { csrfSync } from 'csrf-sync';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool } from './db.js';
import { config } from './config.js';
import { clock } from './clock.js';

declare global { namespace Express { interface User { id: string; email: string; displayName: string; avatarUrl: string | null } } }
declare module 'express-session' { interface SessionData { authExpiresAt?: number } }

function profileUser(row: { id: string; email: string; display_name: string; avatar_version?: string | null }): Express.User {
  return { id: String(row.id), email: row.email, displayName: row.display_name, avatarUrl: row.avatar_version ? `/api/auth/avatar?v=${row.avatar_version}` : null };
}

const cookieName = config.NODE_ENV === 'production' ? '__Host-linkstudio.sid' : 'linkstudio.sid';
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: config.NODE_ENV === 'production', path: '/' };
export const sessionStore = new (connectPgSimple(session))({ pool, tableName: 'sessions', disableTouch: true,
  pruneSessionInterval: config.NODE_ENV === 'test' ? false : 900, errorLog: () => console.error('Session store unavailable') });
export const sessionMiddleware = session({ name: cookieName, secret: config.SESSION_SECRET, store: sessionStore,
  resave: false, saveUninitialized: false, rolling: false,
  cookie: { ...cookieOptions, maxAge: config.SESSION_TTL_HOURS * 3_600_000 } });
export const passport = new Passport();
const dummyHash = await bcrypt.hash('dummy-for-equal-work-not-an-account', 12);
const credentials = z.object({ email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(10).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.') }).strict();
const nameField = z.string().trim().min(1).max(80).refine(value => !/[\p{Cc}\p{Cf}]/u.test(value), 'Name must not contain control characters.');
const registration = credentials.extend({ displayName: nameField.optional() }).strict();
passport.use(new Strategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const found = await pool.query('SELECT id, email, display_name, avatar_version, password_hash FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = found.rows[0];
    const valid = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
    done(null, valid && user ? profileUser(user) : false);
  } catch (error) { done(error); }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try { const found = await pool.query('SELECT id, email, display_name, avatar_version FROM users WHERE id=$1', [id]);
    done(null, found.rows[0] ? profileUser(found.rows[0]) : false);
  } catch (error) { done(error); }
});
export const expireSession: RequestHandler = (req, res, next) => {
  if (req.session.authExpiresAt && req.session.authExpiresAt <= clock.now()) {
    req.user = undefined;
    req.session.destroy(error => { if (error) return next(error); res.clearCookie(cookieName, cookieOptions); next(); });
  } else next();
};
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) { res.status(401).json({ error: 'Please log in to access My links.' }); return; }
  next();
};
const { generateToken, csrfSynchronisedProtection } = csrfSync();
export const protectWrite: RequestHandler = (req, res, next) => {
  if (req.get('origin') && req.get('origin') !== config.AUTH_ORIGIN) { res.status(403).json({ error: 'Request origin is not allowed.' }); return; }
  csrfSynchronisedProtection(req, res, next);
};
export const authRouter = Router();
authRouter.get('/session', (req, res) => {
  // An expired session was destroyed; the client can request a fresh token next time.
  if (!req.session) { res.json({ user: null, csrfToken: null, expiresAt: null }); return; }
  res.json({ user: req.user ?? null, csrfToken: generateToken(req), expiresAt: req.user ? req.session.authExpiresAt : null });
});
const limiter = () => rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' } });
const validateCredentials: RequestHandler = (req, res, next) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a valid email and a password of at least 10 characters, at most 72 UTF-8 bytes.' }); return; }
  req.body = parsed.data; next();
};
const completeLogin: RequestHandler = (req, res, next) => {
  // Passport login regenerated the session ID, preventing session fixation.
  req.session.authExpiresAt = clock.now() + config.SESSION_TTL_HOURS * 3_600_000;
  req.session.cookie.maxAge = config.SESSION_TTL_HOURS * 3_600_000;
  const token = generateToken(req, true);
  req.session.save(error => { if (error) return next(error); res.json({ user: req.user, csrfToken: token, expiresAt: req.session.authExpiresAt }); });
};
const validateRegistration: RequestHandler = (req, res, next) => {
  const parsed = registration.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a valid email, password (10+ characters, at most 72 UTF-8 bytes) and name (1–80 characters, without control characters).' }); return; }
  req.body = parsed.data; next();
};
authRouter.post('/register', limiter(), protectWrite, validateRegistration, async (req, res, next) => {
  const hash = await bcrypt.hash(req.body.password, 12);
  let user: Express.User;
  try { const found = await pool.query('INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name,avatar_version', [req.body.email, hash, req.body.displayName ?? '']);
    user = profileUser(found.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === '23505') { res.status(409).json({ error: 'Unable to register with this email. Use another email or log in.' }); return; }
    throw error;
  }
  req.login(user, error => { if (error) return next(error); completeLogin(req, res, next); });
});
authRouter.post('/login', limiter(), protectWrite, validateCredentials, (req, res, next) => {
  passport.authenticate('local', (error: unknown, user: Express.User | false) => {
    if (error) return next(error);
    if (!user) { res.status(401).json({ error: 'Email or password is incorrect.' }); return; }
    req.login(user, loginError => { if (loginError) return next(loginError); completeLogin(req, res, next); });
  })(req, res, next);
});
authRouter.post('/logout', requireAuth, protectWrite, (req, res, next) => {
  req.session.destroy(error => { if (error) return next(error); res.clearCookie(cookieName, cookieOptions); res.status(204).end(); });
});

const displayNameSchema = z.object({ displayName: nameField }).strict();
authRouter.patch('/profile', requireAuth, protectWrite, async (req, res) => {
  const parsed = displayNameSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Enter a name of 1–80 characters without control characters.' }); return; }
  const result = await pool.query('UPDATE users SET display_name=$1 WHERE id=$2 RETURNING id,email,display_name,avatar_version', [parsed.data.displayName, req.user!.id]);
  const row = result.rows[0];
  res.json({ user: profileUser(row) });
});
const passwordSchema = z.object({ currentPassword: credentials.shape.password, newPassword: credentials.shape.password }).strict();
authRouter.post('/password', requireAuth, limiter(), protectWrite, async (req, res, next) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Passwords must have at least 10 characters and at most 72 UTF-8 bytes.' }); return; }
  if (parsed.data.currentPassword === parsed.data.newPassword) { res.status(400).json({ error: 'Choose a different new password.' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT password_hash FROM users WHERE id=$1 FOR UPDATE', [req.user!.id]);
    if (!result.rows[0] || !await bcrypt.compare(parsed.data.currentPassword, result.rows[0].password_hash)) {
      await client.query('ROLLBACK'); res.status(400).json({ error: 'Current password is incorrect.' }); return;
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 12);
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user!.id]);
    await client.query("DELETE FROM sessions WHERE sess->'passport'->>'user'=$1", [req.user!.id]);
    await client.query('COMMIT');
    req.session.destroy(error => { if (error) return next(error); res.clearCookie(cookieName, cookieOptions); res.status(204).end(); });
  } catch (error) { await client.query('ROLLBACK'); next(error); }
  finally { client.release(); }
});

const avatarLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many photo updates. Please try again later.' } });
authRouter.get('/avatar', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT avatar_image FROM users WHERE id=$1', [req.user!.id]);
  res.set('Vary', 'Cookie');
  if (!result.rows[0]?.avatar_image) { res.status(404).json({ error: 'No profile photo.' }); return; }
  res.type('image/webp').set('X-Content-Type-Options', 'nosniff').send(result.rows[0].avatar_image);
});
authRouter.put('/avatar', requireAuth, avatarLimiter, protectWrite, raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '2mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) { res.status(415).json({ error: 'Choose a JPEG, PNG or WebP image.' }); return; }
  let image: Buffer;
  try { image = await normalizeAvatar(req.body, (req.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''); }
  catch { res.status(400).json({ error: 'Choose a valid, still JPEG, PNG or WebP image (up to 2 MB and 16 megapixels).' }); return; }
  const result = await pool.query('UPDATE users SET avatar_image=$1,avatar_version=$2 WHERE id=$3 RETURNING id,email,display_name,avatar_version', [image, randomUUID(), req.user!.id]);
  res.json({ user: profileUser(result.rows[0]) });
});
authRouter.delete('/avatar', requireAuth, avatarLimiter, protectWrite, async (req, res) => {
  const result = await pool.query('UPDATE users SET avatar_image=NULL,avatar_version=NULL WHERE id=$1 RETURNING id,email,display_name,avatar_version', [req.user!.id]);
  res.json({ user: profileUser(result.rows[0]) });
});
