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

Limits: no verified emails, password recovery or account deletion. Rate-limit stores are per process, not a distributed defence. Public URLs/Preview are intentionally shareable and do not certify destination safety. Credentials/legacy migration in hosted Supabase are pending explicit approval; local QA accounts are ready and passwords are only in ignored tmp files. Production HTTPS cookies were checked with local proxy simulation, not a deployed HTTPS host. No penetration test or online deployment is claimed.
