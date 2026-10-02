# Link Studio · SYNERRY Full-Stack Challenge

ระบบ Short URL สำหรับแบบทดสอบสหกิจ SYNERRY: สร้างลิงก์สั้นที่ redirect ได้จริง สร้าง/ดาวน์โหลด QR Code เก็บประวัติและสถิติการเปิด พร้อมหน้าจอ responsive

**Stack:** React 19 + TypeScript + Vite / Node.js 22 + Express 5 + TypeScript / PostgreSQL 17

UI ใช้ palette/typography จาก `DESIGN.md`: warm-black canvas, lime pill CTA และ serif display โดยใช้ local font fallbacks เพื่อไม่พึ่งฟอนต์ภายนอก; `styles.css` ดูแล layout และ `theme.css` ดูแล design tokens

| ข้อกำหนด | Implementation / หลักฐาน |
|---|---|
| Create + redirect | `backend/src/app.ts`, HTTP integration tests และ browser redirect ไป SYNERRY |
| QR จาก short URL | Backend PNG encoder, test ถอดรหัสด้วย jsQR, browser download |
| History + opens | PostgreSQL `links`/`click_events`, ค้นหา/แบ่งหน้า, concurrent GET test |
| DFD / ER / Architecture | `docs/DIAGRAMS.md` |
| Installation / env | README + `.env.example` ทั้ง root/backend/frontend |
| Deploy preparation | Dockerfile, Compose, deployment checklist; ยังไม่มี public deployment |
| Presentation | `docs/PRESENTATION.md` |

GitHub Actions workflow จะรัน typecheck/build/integration tests ด้วย PostgreSQL แยกหลัง push; ยังไม่อ้างว่ารันบน GitHub ผ่านจนกว่าจะมีผล CI จริง

## สิ่งที่ทำได้

- สมัครสมาชิก / Login / Logout และ My links ที่ตรวจ ownership บน backend

- สร้าง Short URL ด้วยรหัสสุ่ม 8 ตัวอักษร (48-bit randomness) และ unique constraint ใน PostgreSQL พร้อม retry เมื่อชนกัน
- เปิด Short URL แล้ว redirect แบบ HTTP 302 ไป URL ต้นฉบับ พร้อมเก็บเหตุการณ์เปิดในฐานข้อมูล
- QR Code เข้ารหัส **Short URL** เพื่อให้การสแกนผ่าน redirect และนับการเปิดเหมือนคลิกลิงก์
- ดู/ดาวน์โหลด PNG 512 × 512, คัดลอกลิงก์, เปิดลิงก์ในแท็บใหม่
- หน้า Preview `/preview/:code` แสดงโดเมน (ASCII), URL เต็ม และสถานะก่อนเปิด โดยไม่ fetch เว็บไซต์ปลายทางและไม่รับรองความปลอดภัย; ดู Preview ไม่นับเปิด ปุ่ม Continue ผ่าน redirect เดิม
- ปุ่มรูปตาในประวัติ/ผลสร้างลิงก์เปิด Preview และปุ่ม Copy preview link ใช้แชร์หน้าตรวจปลายทางได้ Short URL และ QR เดิมยัง redirect โดยตรง
- ประวัติพร้อม URL ต้นฉบับ ชื่อ รหัส วันที่สร้าง สถานะ และจำนวนเปิด ค้นหาและแบ่งหน้า
- สถิติรวม ลิงก์ active จำนวนเปิดวันนี้ และกราฟ 7 วัน (UTC); รีเฟรชทุก 15 วินาทีขณะเปิดหน้า
- ฟีเจอร์เสริม: ชื่อกำกับลิงก์, custom alias, วันหมดอายุ (410 เมื่อหมดอายุ)
- Validation ที่ server, parameterized SQL, Helmet headers, rate limit การสร้าง 30 ครั้ง/นาที/IP และไม่เก็บ IP หรือ User-Agent

**ขอบเขต:** Login จำเป็นสำหรับสร้างลิงก์และ My links ประวัติ คำค้น สถิติ และ CSV แสดงเฉพาะเจ้าของที่ backend ตรวจสิทธิ์ Short URL/Preview/QR ยังเปิดสาธารณะได้ ผู้มี code ดู title, URL เต็ม และ expiry ผ่าน Preview ได้ จึงอย่าใส่ URL ที่มี token/secret ลิงก์เก่า owner_id=NULL ยังเปิด/สแกนได้แต่ไม่ปรากฏใน My links หรืออ้างสิทธิ์โดยบัญชีใหม่ จำนวนเปิดคือทุก successful GET รวม repeat visits และ bot ไม่ใช่จำนวนคนที่ไม่ซ้ำ HEAD/QR preview/expired/missing link ไม่นับเป็นการเปิด

## เริ่มต้นในเครื่อง

ต้องมี Node.js >=22, npm และ PostgreSQL ที่เปิดใช้งานอยู่

```sh
npm ci
```

คัดลอก `backend/.env.example` เป็น `backend/.env` และแก้ `DATABASE_URL`, `TEST_DATABASE_URL` ให้ตรงกับ PostgreSQL ของคุณ ตัวอย่างฐานข้อมูลสำหรับ local development:

```sql
CREATE USER shorturl WITH PASSWORD 'choose-your-own-local-password';
CREATE DATABASE shorturl OWNER shorturl;
CREATE DATABASE shorturl_test OWNER shorturl;
```

อย่าใช้รหัสผ่านตัวอย่างใน environment จริง และอย่า commit `.env`

```dotenv
DATABASE_URL=postgresql://shorturl:YOUR_PASSWORD@localhost:5432/shorturl
TEST_DATABASE_URL=postgresql://shorturl:YOUR_PASSWORD@localhost:5432/shorturl_test
PUBLIC_BASE_URL=http://localhost:3000
PORT=3000
NODE_ENV=development
TRUST_PROXY_HOPS=0
DATABASE_SSL=false
SESSION_SECRET=replace-with-a-generated-random-secret
AUTH_ORIGIN=http://localhost:5173
SESSION_SECRET=REPLACE_WITH_YOUR_GENERATED_RANDOM_SECRET
AUTH_ORIGIN=http://localhost:5173
```

```sh
node scripts/configure-session-secret.mjs
node scripts/configure-session-secret.mjs
npm run db:migrate
npm run dev
```

Frontend: http://localhost:5173 · Backend/Short URL: http://localhost:3000 · health: http://localhost:3000/api/health

Vite proxy `/api` ไป Express จึงไม่ต้องเปิด CORS หรือใส่ database credentials ใน frontend ใน development ลิงก์สั้นจะใช้พอร์ต 3000 ตาม `PUBLIC_BASE_URL`

### Production ในเครื่อง

```sh
npm run build
npm start
```

ตั้ง AUTH_ORIGIN=http://localhost:3000 เมื่อใช้ Express serve UI ในเครื่อง เปิด http://localhost:3000 ได้ทั้ง UI, API และ redirect จาก Express ตัวเดียว ให้เปลี่ยน `NODE_ENV=production` ใน environment เมื่อใช้งาน production จริง

## Docker Compose

คัดลอก root `.env.example` เป็น `.env` กำหนด `POSTGRES_PASSWORD` ด้วยรหัสสุ่มที่ใช้ใน URL ได้ (เช่น hex) และ `PUBLIC_BASE_URL`, สร้าง SESSION_SECRET ด้วย `node scripts/configure-session-secret.mjs --compose`

```sh
docker compose up --build -d
```

เปิด http://localhost:3000 local HTTP ใช้ NODE_ENV=development เพื่อให้ cookie ทำงาน Production ต้องใช้ HTTPS และ NODE_ENV=production ฐานข้อมูลอยู่ใน named volume และไม่ expose database port แอปจะรอ health check ของฐานข้อมูลและ run migration ก่อนเริ่มทำงาน

## Deploy ออนไลน์

ดู [คู่มือ Deploy](docs/DEPLOYMENT.md) เลือก host ที่รัน Node.js หรือ Docker และเชื่อม managed PostgreSQL ได้ ไม่ผูกกับผู้ให้บริการเดียว

- Build: `npm ci && npm run build`
- Pre-deploy: `node backend/dist/migrate.js`
- Start: `node backend/dist/server.js`
- ถ้า host ไม่มี pre-deploy command ให้ใช้ `node backend/dist/migrate.js && node backend/dist/server.js`
- Health check: `/api/health`
- `DATABASE_URL`: จากฐานข้อมูลจริง, `PUBLIC_BASE_URL`: HTTPS origin ของเว็บ, `NODE_ENV=production`, `PORT`: จาก host
- `TRUST_PROXY_HOPS`: ตั้งให้ตรงจำนวน trusted reverse proxies เช่น `1` สำหรับ single proxy เท่านั้น
- `DATABASE_SSL=true` เมื่อ provider ต้องใช้ TLS (ยังตรวจ certificate ไม่ปิด verification)
- ตั้ง secrets ใน dashboard ของ host ห้ามใส่ใน Git

ระบบพร้อมสำหรับ Deploy แต่ repository นี้ไม่ได้ระบุว่าได้เผยแพร่ URL ออนไลน์แล้ว ต้อง provision host/database และทดสอบตาม checklist ก่อนส่งงาน

## ทดสอบ

```sh
npm run typecheck
npm run build
npm test
```

Integration tests ใช้ PostgreSQL จริงผ่าน `TEST_DATABASE_URL` ต้องเป็นฐานข้อมูล local (`localhost`, `127.0.0.1` หรือ `::1`) ชื่อลงท้าย `_test` และตั้ง `TEST_DATABASE_RESET=true` ใน `backend/.env` เมื่อยืนยันว่าเป็นฐานข้อมูลที่ล้างได้แล้วเท่านั้น **Tests จะลบข้อมูลทั้งหมดในตาราง links/click_events ของฐานข้อมูลทดสอบ** ห้ามใช้ฐานข้อมูลใช้งานจริง Tests ปฏิเสธ remote host และ application database เดียวกัน; CI ใช้ฐานข้อมูลชั่วคราวพร้อม `NODE_ENV=test`

ครอบคลุม create → redirect → persistence, เปิดพร้อมกันโดยจำนวนไม่หาย, HEAD ไม่นับ, alias ชนพร้อมกัน, QR PNG, validation, expiry, missing link, pagination/search และสถิติ UTC

Tests ยังถอดรหัส QR กลับเป็น short URL และตรวจ rate limit + `Retry-After`

Suite ปัจจุบันมี 28 tests รวม Preview/refresh/QR ไม่เพิ่ม event, compatibility ของ code เดิม, expiry หลังเปิด Preview, stored URL ที่ผิด validation, query override, hostname จาก URL parser และ error ที่ไม่เปิดเผยรายละเอียดฐานข้อมูล รวมถึง expiry preset ทุกค่าและ boundary โดยควบคุมเวลา

## Preview และการนับเปิด

- `PUBLIC_BASE_URL/preview/:code` เป็นหน้า Preview แบบเลือกใช้ อ่านข้อมูลจาก `/api/links/:code/preview` เท่านั้น การเปิดหรือ refresh ไม่สร้าง event
- `PUBLIC_BASE_URL/:code` เป็น Redirect จริง Short URL และ QR เดิมยังใช้ URL นี้ ปุ่ม Continue ใน Preview ใช้ URL นี้ผ่าน backend เช่นกัน
- Continue ตรวจ expiry ในหน้าเพื่อแสดงสถานะ และ backend อ่านสถานะปัจจุบันอีกครั้งก่อนเขียน event แล้วตอบ 302 เก็บ query/fragment ของปลายทางเดิม ไม่รับ query มาทับ destination
- หน้าจอล็อกการกด Continue ซ้ำระหว่างนำทาง หนึ่ง GET ที่ผ่านการตรวจและบันทึกสำเร็จ = หนึ่ง event ไม่ใช่ unique visitor; การเปิด short URL แยกอีกครั้งยังนับตามนิยามเดิม HEAD, missing, expired, Preview และ QR generation/download ไม่นับ
- แสดง hostname จาก `URL.hostname` (ASCII/punycode ไม่รวม port) และ URL เต็มเป็นข้อความที่ตัดบรรทัดได้ ไม่มี HTML จาก title/URL, iframe หรือการ fetch/โหลด assets ปลายทางอัตโนมัติ Preview ไม่ใช่การตรวจ malware/phishing
- ระบบยังไม่มีสถานะ disabled หรือ endpoint สำหรับ disable จึงไม่อ้างว่าทดสอบสถานะนี้แล้ว

เช็กรายการทดสอบด้วยตนเองและข้อจำกัดใน [TESTING.md](docs/TESTING.md)

## API

### Login + My links

ใช้ [Passport Local](https://www.passportjs.org/packages/passport-local/) ตรวจ email/password, [express-session](https://expressjs.com/en/resources/middleware/session/) และ [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) สำหรับ server-side session ใน PostgreSQL, [bcryptjs](https://github.com/dcodeIO/bcrypt.js) hash cost 12 และ [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync) สำหรับ synchronizer token ไม่เขียน encryption/password hashing เอง ไม่ใช้ MemoryStore หรือเก็บ token/password ใน localStorage

| Method | Endpoint | Contract |
|---|---|---|
| GET | `/api/auth/session` | Public bootstrap: `{user: {id,email} หรือ null, csrfToken, expiresAt}`; no-store |
| POST | `/api/auth/register` | `{email,password}` + `X-CSRF-Token`; 200 และ Login หลังสมัคร, 400 invalid, 409 สมัครไม่ได้, 429 rate limit |
| POST | `/api/auth/login` | `{email,password}` + token; 200, 401 generic incorrect credentials, 429 rate limit |
| POST | `/api/auth/logout` | Login + token; 204 ลบ session ใน DB และ clear cookie |

เริ่มจาก GET session เพื่อรับ cookie และ CSRF token แล้วส่ง token ใน header ทุก POST รวม Login/Register ป้องกัน login CSRF Login สำเร็จเปลี่ยน session ID และ token ให้ใช้ token ใหม่; token ผิด/ไม่มี หรือ Origin ผิดตอบ 403 API caller ต้องเก็บ cookie jar ด้วย ถ้า session หมดอายุให้ bootstrap และ Login ใหม่ ไม่มี bearer-token endpoint

Password อย่างน้อย 10 ตัวอักษรและไม่เกิน 72 UTF-8 bytes เพื่อป้องกัน bcrypt truncation; email lowercase Login ไม่แยกข้อความว่า email ไม่มีหรือ password ผิด จำกัด Login/Register อย่างละ 20 ครั้ง/15 นาที/IP ด้วย in-process store; หลาย instance ยังต้องใช้ shared rate-limit store ก่อนเปิดใช้งานขนาดใหญ่

Cookie: HttpOnly, SameSite=Lax, Path=/, ไม่มี Domain; production ใช้ Secure และชื่อ `__Host-linkstudio.sid` ต้อง HTTPS/ตั้ง trusted proxy ถูกต้อง Session หมดอายุแบบ absolute 8 ชั่วโมง (`SESSION_TTL_HOURS` 1–168) ไม่ต่ออายุจากการเปิดหน้า Logout ยกเลิกที่ DB ทันที SESSION_SECRET >=32 ตัวอักษรจาก random generator เก็บใน backend เท่านั้น เปลี่ยน secret จะยกเลิก cookie เดิม

Migration `002_auth.sql` เพิ่ม users/sessions และ nullable owner_id (FK ON DELETE SET NULL) โดยไม่ลบ/มอบเจ้าของให้ข้อมูลเก่า เปิด RLS แบบไม่มี client policies เพื่อไม่ให้ Supabase Data API roles อ่านตารางเหล่านี้ Backend ต้องใช้ table-owner/migration role หรือ role ที่อนุญาต bypass RLS; ทุก private query กรอง owner จาก session ไม่รับ owner จาก frontend

Private: POST links, GET links/search, GET stats, GET CSV และ GET links/:code Public: health, auth bootstrap, `/:code`, `/preview/:code`, preview metadata และ QR ผู้มี code ดูปลายทาง/title ได้สาธารณะ แต่ไม่มี counts, owner email หรือรายการส่วนตัว ไม่มี password reset, social login, email verification, account deletion หรือ claim legacy link

### บัญชี demo สำหรับผู้ตรวจ

หลัง migration บนฐานข้อมูลที่ได้รับอนุญาต รัน `npm run demo:users` สร้าง `demo-a@linkstudio.example` และ `demo-b@linkstudio.example` ด้วยรหัสสุ่ม บันทึกรหัสจริงเฉพาะ `tmp/demo-accounts-<timestamp>.txt` ที่ gitignore ไม่พิมพ์รหัสใน console ไม่เปลี่ยนรหัสบัญชีเดิม ส่ง credentials ให้ผู้ตรวจผ่านช่องทางส่วนตัวเมื่อพร้อม ไม่มีรหัส demo จริงใน Git

รอบนี้สร้าง demo ใน **local QA database** ที่ `http://localhost:3111` เท่านั้น ฐานข้อมูล Supabase ยังไม่ได้ migration หรือสร้าง demo เพราะ automatic approval review ปฏิเสธการเปลี่ยน schema/RLS ของฐานข้อมูลใช้งานจริง ต้องได้รับอนุมัติก่อน SQL ที่จะใช้คือ `backend/migrations/002_auth.sql`

### ดาวน์โหลดประวัติ CSV

ปุ่ม **ดาวน์โหลด CSV** ในส่วนประวัติส่งออก **My links ของผู้ใช้ที่ Login** ทุกหน้าตามคำค้นปัจจุบัน ไม่ใช่เฉพาะหน้าที่โหลดอยู่ ต้อง Login และยังไม่มีตัวกรองเพิ่มเติมนอกเหนือจากคำค้น ปุ่มรอให้คำค้นโหลดเสร็จก่อน export พร้อม loading, ป้องกันกดซ้ำ, timeout 30 วินาที และข้อความ error

`GET /api/links/export.csv?q=keyword` รับ `q` string ไม่เกิน 120 ตัวอักษร (trim) เงื่อนไขเดียวกับประวัติ: ค้น title, original URL หรือ code แบบ case-insensitive และค้น `%`, `_`, `\` เป็นอักขระจริง ไม่ใช่ wildcard Query อื่นหรือ q หลายค่าตอบ 400

- เรียง `created_at DESC, id DESC` คงที่ อ่านข้อมูลกับจำนวน event ใน PostgreSQL statement เดียว ส่งออกได้สูงสุด **10,000 รายการ** หากเกินตอบ **413 JSON** ให้ลดคำค้น ไม่ส่งไฟล์บางส่วน
- มี 7 คอลัมน์: ชื่อลิงก์, URL ต้นฉบับ, Short URL, วันที่สร้าง (UTC), วันหมดอายุ (UTC), สถานะ (`Active`/`Expired`) และจำนวนครั้งที่เปิด ไม่ส่ง id, secrets หรือข้อมูลฐานข้อมูลภายใน
- วันที่เป็น ISO 8601 UTC ลงท้าย `Z`; expiry ว่างเมื่อไม่หมดอายุ สถานะประเมินจากเวลา backend ตอนเริ่ม export โดย `now >= expiresAt` เป็น Expired จำนวนครั้งที่เปิดเป็นตัวเลข decimal ไม่ใส่ apostrophe หรือ quote
- รูปแบบ UTF-8 พร้อม BOM, คั่น comma, จบแถว CRLF, quote ข้อความและเพิ่ม double quote เมื่อมี `"` รองรับ comma/newline ใน cell
- ป้องกัน formula injection โดยเติม apostrophe ที่จุดเริ่มต้นของ text cell เมื่อพบ `=`, `+`, `-`, `@` หลัง whitespace/Unicode separator/control/format characters; ข้อมูลข้อความเสี่ยงใน CSV จึงอาจมี apostrophe เพิ่มจากต้นฉบับ การ quote อย่างเดียวไม่ใช่การป้องกัน
- ผลลัพธ์ว่างยังตอบ **200 พร้อมไฟล์ header อย่างเดียว** UI แจ้งพฤติกรรมนี้หลังเริ่มดาวน์โหลด
- Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="my-links-YYYY-MM-DD.csv"` และ `Cache-Control: no-store`; ชื่อไฟล์มาจากวัน UTC ไม่รับจากผู้ใช้ Export/HEAD ไม่สร้าง click event

ตรวจไฟล์ดาวน์โหลดผ่าน browser แล้ว แต่ **ยังไม่ได้เปิดใน Excel จริง** Excel อาจแสดงวันที่/URL ตามการตั้งค่า locale ของเครื่อง หากต้องการคงรูปแบบข้อความให้ใช้ Data → From Text/CSV และตรวจชนิดคอลัมน์ก่อนทำรายงาน

| Method | Endpoint | ผลลัพธ์ |
|---|---|---|
| GET | `/api/health` | Database connectivity: 200/503 |
| POST | `/api/links` | ต้อง Login + CSRF; สร้างลิงก์: 201, invalid: 400, alias ซ้ำ: 409, rate limit: 429 |
| GET | `/api/links?page=1&limit=10&q=keyword` | My links ของเจ้าของที่ Login (limit 1–50); anonymous: 401 |
| GET | `/api/links/export.csv?q=keyword` | ดาวน์โหลดMy links ของผู้ใช้ที่ Loginทุกหน้าตามคำค้น; 400 invalid, 413 เกิน 10,000 รายการ |
| GET | `/api/stats` | สถิติของเจ้าของที่ Login และ 7 วัน (UTC); anonymous: 401 |
| GET | `/api/links/:code` | รายละเอียด/จำนวนคลิกเฉพาะเจ้าของ; ของผู้อื่น: 404, anonymous: 401 |
| GET | `/api/links/:code/qr` | QR PNG; เพิ่ม `?download=1` เพื่อดาวน์โหลด |
| GET | `/api/links/:code/preview` | Metadata ปลายทางและ active/expired; ไม่พบ: 404; ไม่นับเปิด |
| GET | `/preview/:code` | หน้า Preview: 200 active, 404 missing, 410 expired; ไม่นับเปิด |
| GET | `/:code` | 302 redirect, 404 ไม่พบ, 410 หมดอายุ |
| HEAD | `/:code` | ตรวจปลายทางโดยไม่นับเปิด |

ตัวอย่าง request:

```json
{
  "originalUrl": "https://www.synerry.com",
  "title": "SYNERRY website",
  "customAlias": "synerry-demo",
  "expiresAt": "2030-12-31T23:59:00+07:00"
}
```

ส่งเพียง `originalUrl` ก็ได้ field ที่เหลือ optional

### Expiry contract (backward compatible)

ฟอร์มเริ่มต้นเป็น **ไม่หมดอายุ** และเลือกเร็วได้ 1 ชั่วโมง, 1 วัน, 7 วัน หรือกำหนดเอง ส่ง `expiryPreset` เป็นหนึ่งใน `none`, `1h`, `1d`, `7d`, `custom` เท่านั้น

| Request | ความหมาย |
|---|---|
| ไม่ส่ง expiry fields หรือ `expiryPreset: "none"` | `expiresAt: null` ไม่หมดอายุ |
| `expiryPreset: "1h"` / `"1d"` / `"7d"` | backend ตั้ง expiry เป็น `createdAt` + 3,600 / 86,400 / 604,800 วินาที ตอนบันทึก ไม่ใช้เวลาตอนเปิดฟอร์ม; 1 วัน = 24 ชั่วโมง |
| `expiryPreset: "custom"` พร้อม `expiresAt` | ต้องเป็น ISO 8601 ที่มี `Z` หรือ UTC offset และอยู่ในอนาคตตามเวลา backend |
| `expiresAt` อย่างเดียว | API เดิมยังรองรับ ตรวจเวลาอนาคตเหมือน custom |

Preset ระยะเวลา/`none` พร้อม `expiresAt`, custom ที่ไม่มีเวลา, enum ที่ไม่รองรับ หรือเวลา <= เวลาสร้าง ตอบ 400 ไม่บันทึกลิงก์ ไม่มีการเปลี่ยน schema/ข้อมูลเก่า API response ใช้ `createdAt`/`expiresAt` เดิม

ตัวอย่าง: `{ "originalUrl": "https://example.com", "expiryPreset": "7d" }` หรือ `{ "originalUrl": "https://example.com", "expiryPreset": "custom", "expiresAt": "2030-12-31T23:59:00+07:00" }`

Frontend กำหนดเองใน timezone ของ browser (แสดงชื่อ เช่น `Asia/Bangkok`) แล้วแปลงเป็น UTC ก่อนส่ง PostgreSQL ใช้ `TIMESTAMPTZ` และ API serialize UTC (`Z`) ผลสร้าง ประวัติ และ Preview ใช้ formatter เดียวกันพร้อมชื่อ timezone เมื่อเวลาปัจจุบัน >= expiry backend ตอบ 410 และไม่สร้าง event แม้ Preview เคยเปิดตอน active

## โครงสร้างและเอกสาร

```text
backend/
  src/             Express API, config, PostgreSQL pool, migration, server
  migrations/      SQL schema และ indexes
  test/            Integration tests กับ PostgreSQL จริง
frontend/
  src/             React UI, typed API client, responsive CSS
docs/
  DIAGRAMS.md       DFD Level 0, ER Diagram, Architecture Diagram
  DEPLOYMENT.md     Environment และ checklist ก่อนส่ง URL
  PRESENTATION.md   ลำดับสาธิตและอธิบายการตัดสินใจ
  TESTING.md        วิธีทดสอบและขอบเขตหลักฐาน
```

Diagram แสดงได้บน GitHub ผ่าน Mermaid: [DFD, ER และ Architecture](docs/DIAGRAMS.md)

## การตัดสินใจสำคัญ

- **Modular monolith:** แยก UI/API/database ชัดเจน แต่ deploy แอปหนึ่ง service เพื่อให้เหมาะกับเวลาสามวัน ไม่อ้างว่าเป็น microservices คะแนนเสริมข้อนี้ยังไม่ได้ทำ
- **302 + no-store:** การเปิดแต่ละครั้งมาถึง server จึงบันทึกจำนวนได้ ไม่ใช้ permanent redirect ที่ browser อาจ cache
- **Click events แทน read-modify-write counter:** แต่ละ GET insert event อิสระ ไม่เกิด lost update จาก concurrent requests และนำไปทำกราฟรายวันได้
- **QR จาก backend:** ผู้ใช้ดาวน์โหลดได้โดยไม่เรียกบริการ QR ภายนอก ไม่มี third-party tracking
- **เวลา:** เก็บ `TIMESTAMPTZ` ใน DB, แสดงวันที่ตามเครื่องผู้ใช้, สถิติรายวันกำหนด UTC ชัดเจน
- **ความล้มเหลว DB:** ถ้าบันทึก event ไม่สำเร็จ ระบบตอบ error แทน redirect เพื่อไม่รายงานว่าการเปิดที่ไม่นับถูกบันทึกแล้ว; ระบบระดับใหญ่ควรใช้ queue และกำหนดนโยบายความแม่นยำเพิ่มเติม
- **ความปลอดภัย:** รับเฉพาะ http(s) ไม่รับ credential ใน URL ไม่ fetch destination ที่ server จึงไม่สร้าง SSRF จากการตรวจลิงก์ ไม่ใช้ Host header สร้าง Short URL แต่ใช้ origin ที่ตั้งค่าไว้

## ก่อนส่งงาน

1. Push repository ที่ผู้ตรวจเข้าถึงได้ (ตรวจว่า `.env` และ database files ไม่ถูก track)
2. ตั้งค่าและทดสอบระบบที่ HTTPS URL จริง
3. ตรวจ QR ด้วยมือถือและยืนยันว่าจำนวนเปิดเพิ่มในประวัติ
4. ส่ง repository URL + live URL; ระบบนี้ไม่มี login จึงไม่ต้องส่ง username/password
5. เตรียมสาธิตตาม [PRESENTATION.md](docs/PRESENTATION.md) ไม่เกิน 30 นาที
