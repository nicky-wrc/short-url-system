import { Router, type RequestHandler } from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Passport } from 'passport';
import { Strategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { csrfSync } from 'csrf-sync';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { pool } from './db.js';
import { config } from './config.js';
import { clock } from './clock.js';

declare global { namespace Express { interface User { id: string; email: string } } }
declare module 'express-session' { interface SessionData { authExpiresAt?: number } }

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
passport.use(new Strategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const found = await pool.query('SELECT id, email, password_hash FROM users WHERE email=$1', [email.toLowerCase()]);
    const user = found.rows[0];
    const valid = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
    done(null, valid && user ? { id: String(user.id), email: user.email } : false);
  } catch (error) { done(error); }
}));
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try { const found = await pool.query('SELECT id, email FROM users WHERE id=$1', [id]);
    done(null, found.rows[0] ? { id: String(found.rows[0].id), email: found.rows[0].email } : false);
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
authRouter.post('/register', limiter(), protectWrite, validateCredentials, async (req, res, next) => {
  const hash = await bcrypt.hash(req.body.password, 12);
  let user: Express.User;
  try { const found = await pool.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id,email', [req.body.email, hash]);
    user = { id: String(found.rows[0].id), email: found.rows[0].email };
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
