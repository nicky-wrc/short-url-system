# Authentication / ownership review

Passport Local authenticates email/password, bcryptjs hashes at cost 12, express-session signs the session ID cookie and connect-pg-simple stores session state in PostgreSQL. Official references are linked in README. No password encryption, JWT implementation, OAuth, reset or email verification was added.

| Endpoint | Access / boundary |
|---|---|
| POST /api/links | Session + CSRF required. owner_id comes only from req.user.id; caller owner fields rejected |
| GET /api/links (+ search) | owner_id=session user AND parameterized search |
| GET /api/stats | Link counts, event totals/today and daily chart all filtered by owner |
| GET /api/links/export.csv | Same owner/search filter; limit applies only to this owner |
| GET /api/links/:code | Owner-only details/count. Other owner or orphan returns 404 |
| /:code, /preview/:code, preview metadata, QR | Public including orphan legacy links; metadata intentionally shares title/full URL/expiry, not owner/email/count |
| POST auth/register, auth/login | CSRF and origin checks, separate 20/15min/IP rate limits; password 10+ characters and <=72 UTF-8 bytes |
| POST auth/logout | Session + CSRF, destroys PostgreSQL session and clears cookie |

Session regeneration on successful authentication prevents fixation. CSRF token rotates with it. Cookie HttpOnly/SameSite=Lax, Secure in production, __Host- prefix, Path=/ and no Domain. 8h absolute lifetime is enforced server-side; store touch does not extend it. Login unknown-email uses dummy bcrypt work and the same generic response as incorrect password. DB failures return generic JSON and logs omit credentials/query text. The browser never stores password/token in localStorage.

Migration 002 adds nullable ownership without rewriting legacy rows. No claiming endpoint exists. RLS is enabled with no client-facing policies on users/sessions/links/click_events; server uses the database table-owner role to perform its own ownership checks. Supabase anon/authenticated Data API roles cannot use these tables directly. Access through the public redirect/preview/QR routes still works. No destructive schema changes or auto-reset occur on app start.

Local tests require a disposable loopback _test database and TEST_DATABASE_RESET=true; production/remote URLs are rejected before migration/TRUNCATE. Tests now clear users/sessions as well as links/events only in that isolated DB. Auth regressions cover A/B, anonymous access, forged owner input, private code/ID lookup, CSRF/cross-origin, session ID rotation, generic login errors, hashing, logout replay, expiry and migration from the original schema.

Limits: no verified emails, password recovery or account deletion. Rate-limit stores are per process, not a distributed defence. Public URLs/Preview are intentionally shareable and do not certify destination safety. Hosted migrations completed on Render on 2026-10-04. HTTPS auth bootstrap was checked online with Secure/HttpOnly/__Host cookie flags; successful account login/logout and A/B isolation on the deployed host remain unverified. Local QA credentials remain in ignored tmp only; no production demo credentials are claimed. No penetration test is claimed. See RENDER.md for dated evidence.

## Profile / password update

`003_profile.sql` adds `users.display_name VARCHAR(80) NOT NULL DEFAULT ''` without deleting existing data. Session/login/register user responses include displayName. PATCH `/api/auth/profile` is authenticated and CSRF-protected, accepts only displayName (trimmed, 1–80 characters, no Unicode control/format characters), and updates only req.user.id. Email remains read-only.

POST `/api/auth/password` is authenticated, CSRF-protected and limited to 20 requests per 15 minutes per IP. A strict body accepts currentPassword/newPassword only; existing password length/UTF-8 bounds apply. A transaction locks the current user's row, verifies bcrypt, hashes the new different password with cost 12, and deletes all PostgreSQL sessions of this user before commit. The current cookie is cleared and 204 returned. Other users, links and events are preserved. The client shows a sign-in message and clears password fields. No account identifiers or arbitrary user IDs are accepted.

## Owner-only link status

PATCH `/api/links/:code/status`: authenticated session + synchronizer CSRF + configured origin validation. Strict body `{ isActive: boolean }`; UPDATE links uses both code and req.user.id. Non-owner, unknown and ownerless legacy links uniformly return 404; unauthenticated/expired session 401, bad CSRF 403, invalid body 400. Repeating the same target state is idempotent. Response contains the existing Link contract plus isActive and status. No owner ID or expiry update is accepted. Public Preview/QR/redirect remain unauthed reads, with disabled redirect denied (410, no events).

## Registration name and confirmation

Create account requires a display name and matching Password/Confirm password fields. The frontend
checks equality before sending a request; confirmation is not sent or stored. POST `/api/auth/register`
accepts `{ email, password, displayName? }`, with the same trimmed 1–80 character name validation as
Profile. Unknown fields and Unicode control/format characters are rejected. The name is stored together
with the bcrypt password hash and returned in session/login responses. Omitting displayName remains
supported for existing API clients (empty default); Login continues to accept email/password only.
No migration is needed because users.display_name already exists.

## Private profile photo

- `PUT /api/auth/avatar`: authenticated + same-origin + X-CSRF-Token; raw image bytes with Content-Type image/jpeg, image/png or image/webp (not multipart). Maximum 2 MiB; only valid still images up to 16,777,216 pixels. Returns `{user}` including nullable `avatarUrl`.
- `GET /api/auth/avatar?v=<version>`: authenticated user's own photo only, image/webp with Cache-Control no-store and Vary Cookie. Returns 404 if absent; version is a refresh hint, not an account identifier or public grant.
- `DELETE /api/auth/avatar`: authenticated + CSRF; idempotently clears own photo and returns `{user}` with avatarUrl null.
- PUT/DELETE share a 20 requests / 15 minutes / IP limiter. Anonymous or expired sessions receive 401; missing CSRF 403; invalid image 400; unsupported MIME 415; oversized body 413; rate limit 429. Errors use the existing sanitized error handler.
- Client-supplied user IDs never select another account. PostgreSQL stores normalized 256×256 WebP bytes and a random version UUID, bounded by migration 005. No original file name or EXIF is retained. Photos do not appear on public links/Preview. Sharp is a backend dependency; no new environment keys are required.
