# Render Free + existing Supabase

React's production build and Express run on one Render Web Service, with the existing Supabase Session pooler. No Render database, disk, worker or paid service is created by `render.yaml`. No frontend API secret or separate Vercel deployment is needed.

## Before publishing

Rotate the database password and OpenAI key previously disclosed in chat, and use a fresh SESSION_SECRET. Enter secrets privately in provider dashboards, never in Git or chat. Update the local backend environment yourself if the database password changes. Render Blueprint generates its own SESSION_SECRET. AI is optional; leave OPENAI_API_KEY unset to deploy the core app without API charges.

Review and push application changes together with the deployment files before connecting Render. Keep .env, tmp/, node_modules/, dist/ and local guidance out of Git. The tracked Supabase CA certificate is public, not a private key.

## Recommended: Blueprint

1. Sign into https://dashboard.render.com (account creation/terms and GitHub permission grants are done by the owner).
2. New → Blueprint → connect `nicky-wrc/short-url-system`, branch `main`, root `render.yaml`.
3. Review the single web service, Node runtime, Singapore region and **Free** plan. Do not select a paid plan or create a new PostgreSQL database.
4. Supply DATABASE_URL privately from Supabase Connect → Session pooler, port 5432, database postgres, using the newly rotated database password with percent-encoding when needed. Do not add URL SSL query parameters; this app configures verified TLS through DATABASE_SSL and its public CA file.
5. Review and deploy. The start script derives PUBLIC_BASE_URL and AUTH_ORIGIN from RENDER_EXTERNAL_URL, runs additive migrations 001–007, then starts Express on Render's PORT/0.0.0.0. Existing rows are preserved. Free services do not require a paid pre-deploy command.
6. After Live, optionally add a fresh server-only OPENAI_API_KEY under Environment and redeploy. Provider API billing is separate from Render's Free plan.

## Manual Web Service equivalent

Connect the repository, use branch main, leave Root Directory empty, choose Node and Free:

| Setting | Value |
|---|---|
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `node scripts/start-render.mjs` |
| Health Check Path | `/api/health` |
| NODE_VERSION | `22` |
| NODE_ENV | `production` |
| DATABASE_URL | private new Supabase Session pooler URI |
| DATABASE_SSL | `true` |
| DATABASE_SSL_CA_FILE | `certs/supabase-ca.crt` |
| SESSION_SECRET | fresh cryptographically random secret, at least 32 characters |
| SESSION_TTL_HOURS | `8` |
| TRUST_PROXY_HOPS | `1` for direct Render routing; reassess if adding another proxy |

Do not copy local PUBLIC_BASE_URL/AUTH_ORIGIN into Render. With no overrides, start-render uses Render's actual HTTPS URL automatically. Do not set PORT manually, TEST_DATABASE_URL or TEST_DATABASE_RESET. For a custom domain later, set both PUBLIC_BASE_URL and AUTH_ORIGIN to that HTTPS origin and redeploy.

## Online acceptance checks

- `/api/health` returns 200 and `{status: "ok", database: "connected"}`.
- Register/login/logout work on HTTPS; Secure/HttpOnly session cookie persists after refresh.
- Create a link with Tags, inspect HTTPS Short URL/QR (no localhost), copy/open and confirm one event.
- Public Preview in an unauthenticated browser shows the destination but no private tags; viewing/refreshing does not count. Continue follows backend redirect.
- Scan the new QR with a phone on internet, check destination and next event.
- Edit metadata/tags, disable/enable and expiry preserve URL/QR and existing events. Disabled/expired/missing/HEAD do not count.
- My links, owner statistics and filtered CSV remain private; test users A/B.
- Redeploy and verify links/history/profile remain in PostgreSQL.

Old PNGs/printed QR codes containing localhost cannot be rewritten: download fresh QR codes for the public deployment. Existing database codes remain unchanged, and newly returned short URLs use the deployed origin.

## Limits and troubleshooting

Free web services spin down after 15 minutes without requests; the next request has a cold start. Do not run test resets against Supabase. Database connection failure: verify the exact Session pooler host/password, port 5432, verified CA path and network restrictions. Startup migration failure: confirm table-owner database permissions; do not bypass TLS validation. Login 403: inspect the actual HTTPS origin and cookie/proxy settings. Build failure: confirm latest files/lockfile and dev dependencies installed for TypeScript/Vite.

## Hosted verification (2026-10-04)

[Live application](https://synerry-link-studio.onrender.com), Render Free Node service, commit `2776383c5f07e2ca5a34bae735354bcf174e3a86`. Render reported **Deploy succeeded / Live**. Build completed on Node 22.23.3; startup log confirmed database migration complete before listening on port 10000.

- HTTPS `/api/health`: 200, `status: ok`, `database: connected`.
- HTTPS `/api/auth/session`: 200; session cookie has Secure, HttpOnly and the `__Host-` prefix. This confirms bootstrap flags, not successful account login or session persistence.
- Public Login UI loaded in the browser; no warning/error console entries were observed.
- Not yet verified online: account login/logout, creation/editing, ownership A/B, Preview/redirect counts, expiry/disabled behavior, CSV, profile, AI, persistence after redeploy, or physical mobile QR scanning. No production test reset was run.

Official references: [Express deployment](https://render.com/docs/deploy-node-express-app), [Blueprint specification](https://render.com/docs/blueprint-spec), [default environment variables](https://render.com/docs/environment-variables), [Free limitations](https://render.com/docs/free), [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

Local preparation evidence (2026-10-04): typecheck and start-script syntax checks passed; the existing production build is current. Render startup script was exercised with production configuration and RENDER_EXTERNAL_URL against separate local shorturl_test on port 3119: additive migrations completed, database health returned 200, auth bootstrap returned 200 with Secure/HttpOnly/__Host cookie behind a simulated trusted HTTPS proxy. The temporary process was stopped. Pattern checks on 77 Git-included candidate files found no OpenAI key or private-key pattern; this is a limited scan, not proof of all possible secrets. Hosted verification is recorded separately above.

### Reviewer provisioning verified — 2026-10-04

สร้างบัญชีผู้ตรวจจาก backend/.env ในฐานข้อมูลที่แอปใช้แล้ว ตรวจ Login ผ่าน HTTPS API ของ https://synerry-link-studio.onrender.com สำเร็จและ displayNameตรง จากนั้นLogout sessionตรวจสำเร็จ204. เป็นสมาชิกปกติ ไม่มีสิทธิ์admin/ข้อมูลของคนอื่น. ไม่บันทึกemail/passwordจริงในเอกสารหรือGit. เป็นAPIcheckเท่านั้น ยังไม่ได้ตรวจbrowserของCEOหรือรับรองflowทั้งหมด. การสร้างบัญชีนี้ไม่ใช่deployment/migration007 verification.
