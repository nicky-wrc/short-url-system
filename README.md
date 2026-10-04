# Link Studio · SYNERRY Full-Stack Challenge

ระบบจัดการ Short URL แบบมีบัญชีส่วนตัวสำหรับแบบทดสอบสหกิจ SYNERRY: สร้าง/แก้ชื่อและปลายทาง, Tags, expiry, เปิด/ปิดลิงก์, QR, Preview, My links, Analytics, CSV, Profile และ AI assistant แบบ optional

**Stack:** React 19 + TypeScript + Vite / Node.js 22 + Express 5 + TypeScript / PostgreSQL 17

**Dark / Light Mode:** สลับได้จากสวิตช์ทรงแคปซูลพระจันทร์/ดวงอาทิตย์ที่มุมขวาบน ทั้ง desktop, มือถือ, Login/Register และ Preview ค่าเริ่มต้นเป็น Dark Mode และจดจำใน browser เดิมด้วย `localStorage` (`linkstudio.theme`) แท็บใน origin เดียวกันเปลี่ยนตามกัน ไม่ผูกกับบัญชีและไม่ซิงก์ข้ามอุปกรณ์ หาก browser ปิดการเข้าถึง storage ยังสลับได้จน refresh ปุ่ม primary ใช้เขียวอ่อนเดิมทั้งสองโหมด ส่วนสีข้อความ/focus ปรับให้เหมาะกับพื้นหลัง ตรวจ regression ได้ด้วย `npm run test:theme` (รวมใน `npm test`)

**ภาษาไทย / English:** เลือกภาษาได้ที่มุมขวาบนคู่กับสวิตช์ธีม ทั้งหน้าทำงาน Login/Register และ Preview ค่าเริ่มต้นเป็น English และจำด้วย `localStorage` (`linkstudio.language`) ใน browser/origin เดิม แท็บใน origin เดียวกันเปลี่ยนตามกัน สลับภาษาได้โดยไม่ล้างฟอร์มหรือออกจากระบบ ชื่อผู้ใช้ ชื่อลิงก์ URL แท็ก และข้อความแชทคงตามที่ผู้ใช้กรอก ปุ่มคำถามแนะนำ AI ใช้ภาษาที่เลือก แต่ไม่ได้แปลประวัติแชทหรือกำหนดภาษาคำตอบของโมเดล ไฟล์ CSV และ API ใช้รูปแบบเดิม ภาษาไทยใช้ Noto Sans Thai แบบ self-hosted (SIL OFL) ตรวจด้วย `npm run test:i18n` (รวมใน `npm test`)

Login/Register ใช้ข้อความแนะนำแบบ CharacterV1 ที่ปรับให้เคลื่อนที่เบา รองรับภาษาไทยและ reduced motion โดยเลือก scroll/entrance ตามระยะเลื่อนจริง ดู [รายละเอียดและผลตรวจ](docs/TEXT-ANIMATION.md)

ตัวเลือกภาษาเป็นปุ่มแคปซูลเปิดเมนู English/ไทยที่ใช้สีตาม Dark/Light Mode พร้อมเครื่องหมายภาษาปัจจุบัน ใช้ Enter/Space เปิด, ลูกศรขึ้น/ลงหรือ Home/End เลือก, Enter ยืนยัน, Escape ปิดและคืนโฟกัส; Tab หรือคลิกด้านนอกปิดเมนู ปุ่มนี้ใช้ store เดิม ไม่เพิ่ม API หรือ database column

UI ของ Link Studio ใช้ neutral charcoal, off-white, lime เฉพาะ actions สำคัญ, system sans-serif สำหรับ English และ Noto Sans Thai แบบ self-hosted สำหรับไทย โดยไม่เรียกบริการฟอนต์ภายนอก: `frontend/src/theme.css` เป็น tokens กลาง และ `frontend/src/styles.css` ดูแล layout/states; Overview เน้น recent owned links และข้อมูลจริงจาก API เดิม, mobile/tablet ใช้ navigation แบบเปิด/ปิดและประวัติแบบรายการ ดูผลตรวจและข้อจำกัดที่ [UI verification](docs/UI-VERIFICATION.md)

Daily opens ใน Overview/Analytics และฟอร์ม Create link ใช้พื้นที่กึ่งกลางกว้างสูงสุด 820px ภายใน workspace Navigation ใช้แนว Sterling Gate: desktop มีแถบไอคอนซ้าย 76px และปุ่ม Menu เปิดเมนูซ้อนจากซ้ายกว้างสูงสุด 470px; มือถือเปิดจากปุ่มข้างโลโก้ เมนูมีพื้นหลังสามชั้น ชื่อเมนูทยอยเข้ามา และรูปทรงสีตามธีมเมื่อชี้หรือโฟกัส ใช้เมนูจริงทั้งห้าหน้าและ Logout เดิม ปิดด้วย Escape หรือพื้นที่ภายนอก พร้อม focus trap, คืนโฟกัส และล็อกพื้นหลัง เปลี่ยนหน้าด้วย entrance สั้น รองรับ `prefers-reduced-motion` โดยไม่เพิ่ม GSAP/Tailwind/shadcn และไม่เปลี่ยน API

| ข้อกำหนด | Implementation / หลักฐาน |
|---|---|
| Create + redirect | `backend/src/app.ts`, HTTP integration tests และ browser redirect ไป SYNERRY |
| QR จาก short URL | Backend PNG encoder, test ถอดรหัสด้วย jsQR, browser download |
| History + opens | PostgreSQL `links`/`click_events`, ค้นหา/แบ่งหน้า, concurrent GET test |
| DFD / ER / Architecture | `docs/DIAGRAMS.md` |
| Installation / env | README + `.env.example` ทั้ง root/backend/frontend |
| Deployment | Render Free + Supabase: https://synerry-link-studio.onrender.com; build, migration, health และหน้า Login ตรวจแล้ว ส่วน flow หลัง Login ยังต้องตรวจออนไลน์ |
| Presentation | `docs/PRESENTATION.md` |

GitHub Actions workflow จะรัน typecheck/build/integration tests ด้วย PostgreSQL แยกหลัง push; ยังไม่อ้างว่ารันบน GitHub ผ่านจนกว่าจะมีผล CI จริง

## เอกสารระบบสำหรับผู้ตรวจ

| เอกสาร | เนื้อหา |
|---|---|
| [System design](docs/SYSTEM.md) | ขอบเขตทุกฟังก์ชัน, architecture, privacy และนิยามสถิติ |
| [DFD / ER / Architecture / sequences](docs/DIAGRAMS.md) | กระบวนการและ data flows; source `.mmd` ใน docs/diagrams |
| [Database design](docs/DATABASE.md) | 9 ตาราง, ทุก column/type/PK/FK/default/index และ migrations 001–007 |
| [API reference](docs/API.md) | ทุก endpoint จริง, access/CSRF, validation และ response contract |
| [Testing](docs/TESTING.md) / [Render](docs/RENDER.md) | แยก local checks, online checks และสิ่งที่ยังไม่ได้ยืนยัน |
| [Presentation](docs/PRESENTATION.md) | ลำดับ demo และเหตุผลการออกแบบ |

ตรวจเทียบโค้ดวันที่ 2026-10-04; Diagram อธิบาย implementation ไม่ใช่คำรับรองว่า deployment ผ่านทุก flow แล้ว

## สิ่งที่ทำได้

- ผู้ช่วย AI สำหรับสมาชิก: ถามวิธีใช้งาน/คิดชื่อลิงก์ พร้อมปุ่มลัดและเลือกอนุญาตส่งเฉพาะยอดรวมของตัวเอง ต้องตั้ง OpenAI API key ฝั่ง Backend ก่อนตอบจริง ดู [ขั้นตอนเปิดใช้และ API contract](docs/AI-ASSISTANT.md)

- สมัครสมาชิกด้วยชื่อและยืนยันรหัสผ่าน / Login / Logout; My links ตรวจ ownership บน backend
- Profile: เปลี่ยนชื่อ รูปโปรไฟล์ และรหัสผ่าน; เปลี่ยนรหัสยกเลิกทุก session ของเจ้าของ
- แก้ title/ปลายทาง/private Tags และเปิด/ปิดลิงก์โดยคง code, expiry และสถิติเดิม
- เลือกหรือพิมพ์ Tags; ค้นหาและกรองประวัติ; CSV ทุกหน้าที่ตรงตัวกรอง

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

**ขอบเขต:** Login จำเป็นสำหรับสร้างลิงก์และ My links ประวัติ คำค้น สถิติ และ CSV แสดงเฉพาะเจ้าของที่ backend ตรวจสิทธิ์ Short URL/Preview/QR ยังเปิดสาธารณะได้ ผู้มี code ดู title, URL เต็ม และ expiry ผ่าน Preview ได้ จึงอย่าใส่ URL ที่มี token/secret ลิงก์เก่า owner_id=NULL ยังเปิด/สแกนได้แต่ไม่ปรากฏใน My links หรืออ้างสิทธิ์โดยบัญชีใหม่ จำนวนเปิดคือทุก successful GET รวม repeat visits และ bot ไม่ใช่จำนวนคนที่ไม่ซ้ำ HEAD/QR preview/disabled/expired/missing link ไม่นับเป็นการเปิด

## Clone แล้วรัน: เลือกวิธีให้ตรงฐานข้อมูล

Prerequisites: Git, Node.js22+ และ npm. Docker Desktop จำเป็นเฉพาะวิธี Docker; ถ้า DATABASE_URL ชี้ Supabase/PostgreSQL ที่เปิดอยู่ ใช้ npm ได้โดยไม่เปิด Docker.

### วิธี A — npm + PostgreSQL หรือ Supabase ที่มีอยู่ (แนะนำสำหรับ development)

รัน PowerShell:

```powershell
git clone https://github.com/nicky-wrc/short-url-system.git
cd short-url-system
npm ci
Copy-Item backend/.env.example backend/.env
```

เปิด backend/.env ใน editor และตั้ง DATABASE_URL ของตัวเอง ห้ามใช้ credentials ของผู้พัฒนา. ถ้าเป็น PostgreSQL local ต้องสร้าง role/database ก่อนตาม SQL ด้านล่าง; ถ้าเป็น Supabase ใช้ Session pooler URI5432 ตั้ง DATABASE_SSL=true และ CA ตาม docs/RENDER.md. ค่า PUBLIC_BASE_URL=http://localhost:3000, PORT=3000, AUTH_ORIGIN=http://localhost:5173 ใช้ local defaults เดิม. ไม่ต้องสร้าง frontend/.env เมื่อใช้ Vite proxy ปกติ.

```powershell
node scripts/configure-session-secret.mjs
npm run db:migrate
npm run dev
```

เปิด **http://localhost:5173** แล้ว Create account ของตัวเอง. Backend/Short URL ใช้ **http://localhost:3000**; readiness http://localhost:3000/api/health. npm run dev รัน backend และรอ health ก่อนเริ่ม frontendใน terminalเดียว. Stop ด้วย Ctrl+C. หลังเปิดคอมใหม่ หากฐานข้อมูลพร้อมและ env เดิมอยู่ รัน npm run dev ได้เลย. Vite ใช้ --strictPort: ถ้าพอร์ต5173ถูกใช้ คำสั่งจะหยุด ให้ปิดโปรเซสที่ใช้พอร์ตหรือเปลี่ยนพอร์ต dev และ AUTH_ORIGIN ให้ตรงกันก่อน restart.

npm run db:migrate เพิ่ม schema001–007 แบบ additive ไม่ reset ข้อมูล; Render startup ก็ migrateก่อนรับrequest; local npm run dev ต้องรัน db:migrate เองเมื่อเปลี่ยน schema. ถ้า migration/health error ตรวจฐานข้อมูลและTLS ก่อนเปิดUI.

### วิธี B — Docker Compose รันทั้งระบบ

ต้องเปิด Docker Desktop:

```powershell
Copy-Item .env.example .env
```

ตั้ง POSTGRES_PASSWORD ใน root .env ด้วยรหัสส่วนตัวที่ใช้ใน URI ได้ (เช่น hex) แล้ว:

```powershell
node scripts/configure-session-secret.mjs --compose
docker compose up --build -d
```

เปิด **http://localhost:3000** (UI/API/redirectบริการเดียว). ข้อมูลอยู่ใน postgres-data volume. ครั้งถัดไปใช้ docker compose up -d; Stop ใช้ docker compose stop. ไม่ใช้ down -v เพราะลบข้อมูล. อย่ารัน npm backend บน3000ซ้อนกับ Compose.

### Checks และฐานข้อมูลทดสอบ

```powershell
npm run typecheck
npm run build
```

npm test **ล้างข้อมูล test DB**: สร้าง PostgreSQL local แยกชื่อท้าย _test แล้วตั้ง TEST_DATABASE_URL ให้ตรง และ TEST_DATABASE_RESET=true ใน backend/.env เท่านั้น. ห้ามชี้ production/Supabase; test guard ยอมรับ loopbackและชื่อท้าย_testเท่านั้น. Test runner เปลี่ยน DATABASE_URL เป็น test DBและปิด OpenAI keyภายในprocess. ไม่จำเป็นต้องตั้งTEST_DATABASE_RESET=trueเพื่อรันdev.

```powershell
npm test
```

Production local: npm run build แล้ว npm start; ตั้ง AUTH_ORIGIN=http://localhost:3000 ให้ตรงหน้าUI. การ Deploy Render ใช้ docs/RENDER.md; secrets localไม่ถูกส่งขึ้นRenderผ่านGit. ฟีเจอร์AIต้องมี keyฝั่งbackendและเครดิตAPI; appเดิมใช้ได้เมื่อไม่มีkey.

### Persistence ที่เพิ่ม

ฐานข้อมูลปัจจุบันมี9ตารางหลังmigration007: 4ตารางหลัก + chat_conversations/chat_messages, qr_codes, csv_exports, preview_events. แชตสำเร็จอ่านต่อ/ลบเฉพาะเจ้าของ; QRเก็บPNGcacheตามShortURL; CSVเก็บข้อมูลการส่งออกไม่เก็บไฟล์; Previewเก็บmetadataGETและสถานะไม่เก็บIP. ทั้งหมดไม่เพิ่ม click_events. ไม่มีประวัติย้อนหลังของกิจกรรมก่อนmigration; ยังไม่มีautomatic retentionสำหรับaudit/cache. สถานะ schema บน Render ต้องตรวจ migration logs และตารางจริงหลัง deploy; การตรวจ schema ในเอกสารอ้างอิง migrations ของ repository ไม่ใช่การตรวจ production database รอบนี้.

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
SESSION_TTL_HOURS=8
AUTH_ORIGIN=http://localhost:5173
```

```sh
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

เผยแพร่บน https://synerry-link-studio.onrender.com แล้วเมื่อ 2026-10-04 ตรวจ build, migration, database health และหน้า Login บน HTTPS แล้ว ยังต้องทดสอบ flow หลัง Login และสแกน QR ด้วยมือถือจริงตาม checklist ก่อนส่งงาน

## ทดสอบ

```sh
npm run typecheck
npm run build
npm test
```

Integration tests ใช้ PostgreSQL จริงผ่าน `TEST_DATABASE_URL` ต้องเป็นฐานข้อมูล local (`localhost`, `127.0.0.1` หรือ `::1`) ชื่อลงท้าย `_test` และตั้ง `TEST_DATABASE_RESET=true` ใน `backend/.env` เมื่อยืนยันว่าเป็นฐานข้อมูลที่ล้างได้แล้วเท่านั้น **Tests จะลบข้อมูลทั้งหมดในตาราง links/click_events/users/sessions ของฐานข้อมูลทดสอบ** ห้ามใช้ฐานข้อมูลใช้งานจริง Tests ปฏิเสธ remote host และ application database เดียวกัน; CI ใช้ฐานข้อมูลชั่วคราวพร้อม `NODE_ENV=test`

ครอบคลุม create → redirect → persistence, เปิดพร้อมกันโดยจำนวนไม่หาย, HEAD ไม่นับ, alias ชนพร้อมกัน, QR PNG, validation, expiry, missing link, pagination/search และสถิติ UTC

Tests ยังถอดรหัส QR กลับเป็น short URL และตรวจ rate limit + `Retry-After`

Suite ปัจจุบันมี 52 backend tests รวม Preview/refresh/QR ไม่เพิ่ม event, compatibility ของ code เดิม, expiry หลังเปิด Preview, stored URL ที่ผิด validation, query override, hostname จาก URL parser และ error ที่ไม่เปิดเผยรายละเอียดฐานข้อมูล รวมถึง expiry preset ทุกค่าและ boundary โดยควบคุมเวลา และการจัดการรูปโปรไฟล์

## Preview และการนับเปิด

- `PUBLIC_BASE_URL/preview/:code` เป็นหน้า Preview แบบเลือกใช้ อ่านข้อมูลจาก `/api/links/:code/preview` เท่านั้น การเปิดหรือ refresh ไม่สร้าง event
- `PUBLIC_BASE_URL/:code` เป็น Redirect จริง Short URL และ QR เดิมยังใช้ URL นี้ ปุ่ม Continue ใน Preview ใช้ URL นี้ผ่าน backend เช่นกัน
- Continue ตรวจ expiry ในหน้าเพื่อแสดงสถานะ และ backend อ่านสถานะปัจจุบันอีกครั้งก่อนเขียน event แล้วตอบ 302 เก็บ query/fragment ของปลายทางเดิม ไม่รับ query มาทับ destination
- หน้าจอล็อกการกด Continue ซ้ำระหว่างนำทาง หนึ่ง GET ที่ผ่านการตรวจและบันทึกสำเร็จ = หนึ่ง event ไม่ใช่ unique visitor; การเปิด short URL แยกอีกครั้งยังนับตามนิยามเดิม HEAD, missing, expired, Preview และ QR generation/download ไม่นับ
- แสดง hostname จาก `URL.hostname` (ASCII/punycode ไม่รวม port) และ URL เต็มเป็นข้อความที่ตัดบรรทัดได้ ไม่มี HTML จาก title/URL, iframe หรือการ fetch/โหลด assets ปลายทางอัตโนมัติ Preview ไม่ใช่การตรวจ malware/phishing
- เจ้าของเปิด/ปิดลิงก์ได้ผ่าน API ที่ตรวจ session, ownership และ CSRF; disabled ไม่ redirect และไม่เพิ่ม event

เช็กรายการทดสอบด้วยตนเองและข้อจำกัดใน [TESTING.md](docs/TESTING.md)

## API

รายละเอียดรวมทุก endpoint อยู่ใน [API reference](docs/API.md) และโครงสร้างฐานข้อมูลใน [Data Dictionary](docs/DATABASE.md)

### Login + My links

ใช้ [Passport Local](https://www.passportjs.org/packages/passport-local/) ตรวจ email/password, [express-session](https://expressjs.com/en/resources/middleware/session/) และ [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) สำหรับ server-side session ใน PostgreSQL, [bcryptjs](https://github.com/dcodeIO/bcrypt.js) hash cost 12 และ [csrf-sync](https://github.com/Psifi-Solutions/csrf-sync) สำหรับ synchronizer token ไม่เขียน encryption/password hashing เอง ไม่ใช้ MemoryStore หรือเก็บ token/password ใน localStorage

| Method | Endpoint | Contract |
|---|---|---|
| GET | `/api/auth/session` | Public bootstrap: `{user: {id,email,displayName,avatarUrl} หรือ null, csrfToken, expiresAt}`; no-store |
| POST | `/api/auth/register` | `{email,password,displayName?}` + `X-CSRF-Token`; 200 และ Login หลังสมัคร, 400 invalid, 409 สมัครไม่ได้, 429 rate limit |
| POST | `/api/auth/login` | `{email,password}` + token; 200, 401 generic incorrect credentials, 429 rate limit |
| POST | `/api/auth/logout` | Login + token; 204 ลบ session ใน DB และ clear cookie |

เริ่มจาก GET session เพื่อรับ cookie และ CSRF token แล้วส่ง token ใน header ทุก POST รวม Login/Register ป้องกัน login CSRF Login สำเร็จเปลี่ยน session ID และ token ให้ใช้ token ใหม่; token ผิด/ไม่มี หรือ Origin ผิดตอบ 403 API caller ต้องเก็บ cookie jar ด้วย ถ้า session หมดอายุให้ bootstrap และ Login ใหม่ ไม่มี bearer-token endpoint

Password อย่างน้อย 10 ตัวอักษรและไม่เกิน 72 UTF-8 bytes เพื่อป้องกัน bcrypt truncation; email lowercase Login ไม่แยกข้อความว่า email ไม่มีหรือ password ผิด จำกัด Login/Register อย่างละ 20 ครั้ง/15 นาที/IP ด้วย in-process store; หลาย instance ยังต้องใช้ shared rate-limit store ก่อนเปิดใช้งานขนาดใหญ่

Cookie: HttpOnly, SameSite=Lax, Path=/, ไม่มี Domain; production ใช้ Secure และชื่อ `__Host-linkstudio.sid` ต้อง HTTPS/ตั้ง trusted proxy ถูกต้อง Session หมดอายุแบบ absolute 8 ชั่วโมง (`SESSION_TTL_HOURS` 1–168) ไม่ต่ออายุจากการเปิดหน้า Logout ยกเลิกที่ DB ทันที SESSION_SECRET >=32 ตัวอักษรจาก random generator เก็บใน backend เท่านั้น เปลี่ยน secret จะยกเลิก cookie เดิม

Migration `002_auth.sql` เพิ่ม users/sessions และ nullable owner_id (FK ON DELETE SET NULL) โดยไม่ลบ/มอบเจ้าของให้ข้อมูลเก่า เปิด RLS แบบไม่มี client policies เพื่อไม่ให้ Supabase Data API roles อ่านตารางเหล่านี้ Backend ต้องใช้ table-owner/migration role หรือ role ที่อนุญาต bypass RLS; ทุก private query กรอง owner จาก session ไม่รับ owner จาก frontend

Private: POST links, GET links/search, GET stats, GET CSV และ GET links/:code Public: health, auth bootstrap, `/:code`, `/preview/:code`, preview metadata และ QR ผู้มี code ดูปลายทาง/title ได้สาธารณะ แต่ไม่มี counts, owner email หรือรายการส่วนตัว ไม่มี password reset, social login, email verification, account deletion หรือ claim legacy link

### บัญชี demo สำหรับผู้ตรวจ

กำหนดบัญชีเฉพาะ CEO/ผู้ตรวจได้ใน backend/.env บนเครื่อง (ไม่ commit):

```dotenv
DEMO_REVIEWER_EMAIL=reviewer@example.com
DEMO_REVIEWER_PASSWORD=SET_A_PRIVATE_PASSWORD_HERE
DEMO_REVIEWER_NAME=CEO Reviewer
```

เปลี่ยน email/name และรหัส placeholder เป็นค่าจริงใน editor. Password อย่างน้อย10ตัวอักษรและไม่เกิน72UTF-8bytes. แล้วรัน:

```powershell
npm run db:migrate
npm run demo:users
```

Script ใช้ DATABASE_URL ในbackend/.env: ถ้าชี้SupabaseเดียวกับRender บัญชีจะใช้เว็บออนไลน์นั้นได้. ไม่พิมพ์/เขียนรหัสที่กำหนดในenvไปconsole/tmp และเก็บในusersเป็นbcrypthash. บัญชีReviewerเป็นสมาชิกปกติ ไม่มีadminสิทธิ์หรือสิทธิ์ดูMy linksของคนอื่น. Emailที่มีอยู่จะไม่เปลี่ยนชื่อ/รหัส; แก้envไม่เปลี่ยนรหัสบัญชีที่สร้างแล้ว. ไม่อ่านenvเป็นบัญชีLoginพิเศษและไม่สร้างทุกครั้งที่startup. ลบDEMO_REVIEWER_PASSWORDจากenvได้หลังสร้าง โดยบัญชียังLoginได้. ค่านี้ไม่ต้องใส่Renderถ้ารันscriptจากเครื่องที่เชื่อมฐานข้อมูลเดียวกัน. ถ้าใช้DBคนละตัว บัญชีจะมีเฉพาะDBที่รันscript.

ถ้าไม่กำหนดDEMO_REVIEWER_EMAIL/PASSWORD ทั้งคู่ scriptยังใช้โหมดสุ่มสองบัญชีด้านล่าง:


หลัง migration บนฐานข้อมูลที่ได้รับอนุญาต รัน `npm run demo:users` สร้าง `demo-a@linkstudio.example` และ `demo-b@linkstudio.example` ด้วยรหัสสุ่ม บันทึกรหัสจริงเฉพาะ `tmp/demo-accounts-<timestamp>.txt` ที่ gitignore ไม่พิมพ์รหัสใน console ไม่เปลี่ยนรหัสบัญชีเดิม ส่ง credentials ให้ผู้ตรวจผ่านช่องทางส่วนตัวเมื่อพร้อม ไม่มีรหัส demo จริงใน Git

บัญชี demo ที่มีหลักฐานก่อนหน้าอยู่ใน local QA เท่านั้น ไม่ยืนยันว่ามีบัญชี demo บน production. Render startup เคยรัน migrations 001–006 สำเร็จเมื่อ 2026-10-04; migration007ยังต้องdeployหรือรันเอง; ยังไม่ได้ตรวจ Login และ demo credentials จริงบนเว็บออนไลน์ ไม่บันทึกรหัสผ่านผู้ตรวจใน repository

### ดาวน์โหลดประวัติ CSV

ปุ่ม **ดาวน์โหลด CSV** ในส่วนประวัติส่งออก **My links ของผู้ใช้ที่ Login** ทุกหน้าตามคำค้นและ Tag ปัจจุบัน ไม่ใช่เฉพาะหน้าที่โหลดอยู่ ต้อง Login ปุ่มรอให้คำค้นโหลดเสร็จก่อน export พร้อม loading, ป้องกันกดซ้ำ, timeout 30 วินาที และข้อความ error

`GET /api/links/export.csv?q=keyword&tag=campaign` รับ `q` string ไม่เกิน 120 ตัวอักษร (trim) เงื่อนไขเดียวกับประวัติ: ค้น title, original URL หรือ code แบบ case-insensitive และค้น `%`, `_`, `\` เป็นอักขระจริง ไม่ใช่ wildcard รับ optional `tag` ชื่อเดียวตาม [Tags contract](docs/TAGS.md) ร่วมกับคำค้นแบบ AND; query อื่นหรือ q/tag หลายค่าตอบ 400

- เรียง `created_at DESC, id DESC` คงที่ อ่านข้อมูลกับจำนวน event ใน PostgreSQL statement เดียว ส่งออกได้สูงสุด **10,000 รายการ** หากเกินตอบ **413 JSON** ให้ลดคำค้น ไม่ส่งไฟล์บางส่วน
- มี 7 คอลัมน์: ชื่อลิงก์, URL ต้นฉบับ, Short URL, วันที่สร้าง (UTC), วันหมดอายุ (UTC), สถานะ (`Active`/`Disabled`/`Expired`) และจำนวนครั้งที่เปิด ไม่ส่ง id, secrets หรือข้อมูลฐานข้อมูลภายใน
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
| PATCH | `/api/links/:code` | เจ้าของ + CSRF; แก้ `title`, `originalUrl` และ/หรือ private `tags`; 200, invalid 400, auth 401/403, not owned/missing 404, rate limit 429; คง Short URL/QR/expiry/events ดู [Edit link](docs/LINK-EDITING.md) |
| GET | `/api/links?page=1&limit=10&q=keyword&tag=campaign` | My links ของเจ้าของที่ Login (limit 1–50); anonymous: 401 |
| GET | `/api/links/export.csv?q=keyword&tag=campaign` | ดาวน์โหลดMy links ของผู้ใช้ที่ Loginทุกหน้าตามคำค้นและ Tag; 400 invalid, 413 เกิน 10,000 รายการ |
| GET | `/api/tags` | ต้อง Login; คืน Tags ของเจ้าของเท่านั้น |
| PATCH | `/api/links/:code/status` | เจ้าของ + CSRF; `{isActive:true/false}` แบบ explicit; คง expiry/events |
| GET | `/api/stats` | สถิติของเจ้าของที่ Login และ 7 วัน (UTC); anonymous: 401 |
| GET | `/api/links/:code` | รายละเอียด/จำนวนคลิกเฉพาะเจ้าของ; ของผู้อื่น: 404, anonymous: 401 |
| GET | `/api/links/:code/qr` | QR PNG; เพิ่ม `?download=1` เพื่อดาวน์โหลด |
| GET | `/api/links/:code/preview` | Metadata ปลายทางและ active/disabled/expired; ไม่พบ: 404; ไม่นับเปิด |
| GET | `/preview/:code` | หน้า Preview: 200 active, 404 missing, 410 disabled/expired; ไม่นับเปิด |
| GET | `/:code` | 302 redirect, 404 ไม่พบ, 410 ปิดใช้งานหรือหมดอายุ |
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
  SYSTEM.md         ขอบเขตฟังก์ชันและการออกแบบระบบปัจจุบัน
  DATABASE.md       Data Dictionary, PK/FK/index และ migrations
  API.md            ทุก endpoint จริงและ access contract
  DIAGRAMS.md       DFD Level 0, ER Diagram, Architecture Diagram
  diagrams/         Mermaid sources และ SVG สำหรับนำเสนอ
  DEPLOYMENT.md     Environment และ checklist ก่อนส่ง URL
  PRESENTATION.md   ลำดับสาธิตและอธิบายการตัดสินใจ
  TESTING.md        วิธีทดสอบและขอบเขตหลักฐาน
```

Diagram แสดงได้บน GitHub ผ่าน Mermaid: [DFD, ER และ Architecture](docs/DIAGRAMS.md)

## การตัดสินใจสำคัญ

- **Modular monolith:** แยก UI/API/database ชัดเจน แต่ deploy แอปหนึ่ง service เพื่อให้ดูแลและส่งมอบได้ง่าย ไม่อ้างว่าเป็น microservices
- **302 + no-store:** การเปิดแต่ละครั้งมาถึง server จึงบันทึกจำนวนได้ ไม่ใช้ permanent redirect ที่ browser อาจ cache
- **Click events แทน read-modify-write counter:** แต่ละ GET insert event อิสระ ไม่เกิด lost update จาก concurrent requests และนำไปทำกราฟรายวันได้
- **QR จาก backend:** ผู้ใช้ดาวน์โหลดได้โดยไม่เรียกบริการ QR ภายนอก ไม่มี third-party tracking
- **เวลา:** links/users/events เก็บ `TIMESTAMPTZ`, แสดงวันที่ตามเครื่องผู้ใช้, CSV/สถิติรายวันใช้ UTC; `sessions.expire` ใช้ `TIMESTAMP(6)` without time zone ตาม session store
- **ความล้มเหลว DB:** ถ้าบันทึก event ไม่สำเร็จ ระบบตอบ error แทน redirect เพื่อไม่รายงานว่าการเปิดที่ไม่นับถูกบันทึกแล้ว; ระบบระดับใหญ่ควรใช้ queue และกำหนดนโยบายความแม่นยำเพิ่มเติม
- **ความปลอดภัย:** รับเฉพาะ http(s) ไม่รับ credential ใน URL ไม่ fetch destination ที่ server จึงไม่สร้าง SSRF จากการตรวจลิงก์ ไม่ใช้ Host header สร้าง Short URL แต่ใช้ origin ที่ตั้งค่าไว้

## ก่อนส่งงาน

1. Push repository ที่ผู้ตรวจเข้าถึงได้ (ตรวจว่า `.env` และ database files ไม่ถูก track)
2. ตั้งค่าและทดสอบระบบที่ HTTPS URL จริง
3. ตรวจ QR ด้วยมือถือและยืนยันว่าจำนวนเปิดเพิ่มในประวัติ
4. ส่ง repository URL + live URL และบัญชี demo ให้ผู้ตรวจผ่านช่องทางส่วนตัว ระบบมี Login; ไม่ commit รหัสผ่านจริง และยังไม่ยืนยันว่าบัญชี demo บน production ถูกจัดเตรียมแล้ว
5. เตรียมสาธิตตาม [PRESENTATION.md](docs/PRESENTATION.md) ไม่เกิน 30 นาที

## Workspace และ Profile

เมนูแยกเป็น `/#overview` (สรุปและทางลัด), `/#create` (ฟอร์มสร้างลิงก์), `/#links` (ค้นหา/ประวัติ/CSV), `/#analytics` (สถิติของเจ้าของและกราฟ 7 วัน UTC) และ `/#profile` (รายละเอียดบัญชี/เปลี่ยนรหัสผ่าน) ใช้ hash navigation จึงไม่ชนกับ short code และรองรับ refresh/back/forward

Profile แก้ชื่อที่แสดงได้ 1–80 ตัวอักษร ไม่รับ control characters; email เป็นตัวระบุ Login ที่อ่านอย่างเดียว ชื่อถูก render เป็นข้อความ ไม่ใช่ HTML ชื่อเดิมเป็นค่าว่างและ UI ใช้ชื่อ workspace/email แทน

ก่อนรันเวอร์ชันนี้ ให้หยุด backend แล้วรัน `npm run db:migrate` ตามด้วย `npm run dev` Migration `003_profile.sql` เพิ่ม `users.display_name` แบบ additive ไม่ลบสมาชิก ลิงก์ หรือ click events

| API | Contract |
|---|---|
| PATCH /api/auth/profile | ต้อง Login + CSRF; `{ "displayName": "Nicky" }`; ส่งกลับ `{ user: { id, email, displayName, avatarUrl } }` แก้ได้เฉพาะสมาชิกปัจจุบัน ไม่รับ user ID/email |
| POST /api/auth/password | ต้อง Login + CSRF; `{ "currentPassword": "...", "newPassword": "..." }`; รหัสต้องต่างกัน 10+ ตัวอักษร ไม่เกิน 72 UTF-8 bytes; จำกัด 20 ครั้ง/15 นาที/IP; สำเร็จ 204 และให้ Login ใหม่ |

เปลี่ยนรหัสตรวจ bcrypt hash ของรหัสเดิมใน transaction พร้อมล็อกแถวสมาชิก อัปเดต hash ใหม่และลบ session ทุกเครื่องของเจ้าของเท่านั้น จากนั้นล้าง cookie ไม่เปลี่ยนเจ้าของลิงก์หรือสถิติ ไม่เพิ่ม email change, password reset, social login หรือ workspace ร่วม

## เปิด / ปิดลิงก์ของเจ้าของ

ก่อนรันเวอร์ชันนี้ หยุด backend แล้วรัน `npm run db:migrate` และ `npm run dev` Migration `004_link_status.sql` เพิ่ม `links.is_active BOOLEAN NOT NULL DEFAULT TRUE` ลิงก์เดิม รวม owner_id=NULL เปิดใช้งานตามเดิม ไม่เปลี่ยนเจ้าของ code expiry หรือ click events รัน migration ซ้ำไม่เปิดกลับลิงก์ที่เคยปิด

`PATCH /api/links/:code/status` ต้อง Login และ X-CSRF-Token รับเฉพาะ `{ "isActive": false }` หรือ `{ "isActive": true }` ไม่รับ toggle/owner_id/expiry ค่าเดิมส่งซ้ำได้สถานะเดิม UPDATE มี `code AND owner_id` กำกับเสมอ: 200 ส่ง Link พร้อม isActive/status/counts, 400 body ไม่ถูกต้อง, 401 ไม่มี session/หมดอายุ, 403 CSRF/origin ไม่ผ่าน, 404 code ไม่พบ/ไม่ใช่เจ้าของ/legacy ไม่มีเจ้าของ โดยไม่เปิดเผยว่าเป็นลิงก์ของใคร

ลำดับสถานะทุกหน้าคือ Disabled ก่อน Expired ก่อน Active (`isActive=false` ชนะ expiry) การ enable ไม่เปลี่ยน expiresAt: ลิงก์หมดอายุยังเป็น Expired และตอบ 410 ประวัติ CSV รายละเอียด private และ Preview ใช้ลำดับเดียวกัน Active links ในสถิตินับเฉพาะ is_active=true ที่ยังไม่หมดอายุ แต่ Total opens ยังคงรวม click events เดิม

My links มีปุ่ม Disable link / Enable link พร้อม label แยกตาม code และ Saving… ขณะทำรายการ ป้องกันคำขอซ้ำและไม่แก้สถานะล่วงหน้า เมื่อผิดพลาดแสดง error และอ่านข้อมูลจริงซ้ำ ปุ่มรองรับ keyboard/focus และ touch target อย่างน้อย 44px

Preview metadata ยัง GET 200 เพื่อแสดงรายละเอียดและ status='disabled' แต่หน้า Preview HTTP 410 และไม่มีปุ่ม Continue ที่ใช้งานได้ Redirect GET/HEAD ตอบ 410 ข้อความว่าเจ้าของปิดลิงก์ ไม่มี Location/event QR PNG/payload/URL เดิมยังดาวน์โหลดได้; สแกนไป endpoint เดิมแล้วถูกปฏิเสธ การ enable ลิงก์ที่ยังไม่หมดอายุใช้ URL/QR เดิมได้

Redirect ใช้ transaction และ SELECT FOR SHARE เพื่อตรวจสถานะล่าสุดและเขียน event ก่อน commit ขณะที่ UPDATE สถานะต้องรอ row lock เดียวกัน คำขอที่ตรวจและบันทึกก่อน disable อาจส่ง response เสร็จภายหลังได้ แต่คำขอที่ตรวจหลัง disable commit จะไม่ redirect/นับคลิก ไม่มีการ fetch เว็บไซต์ปลายทาง

ปุ่ม Continue อ่าน Preview metadata ล่าสุดอีกครั้งเมื่อผู้ใช้กด (ไม่นับคลิก) เพื่อแสดง Disabled/Expired บน Preview เก่าได้ทันที จากนั้นเฉพาะสถานะ active จึงนำทางไป Short URL เดิม Backend Redirect ยังตรวจสถานะซ้ำ; network/status-check error แสดงในหน้าและให้ลองใหม่ได้

## Dev startup / ECONNREFUSED

`npm run dev` starts the API first while the web process waits for `/api/health` to report both status=ok and database=connected (maximum 60 seconds; individual requests are bounded). This avoids `/api/auth/session` hitting the proxy before API port 3000 is listening. A startup failure stops the paired dev processes instead of leaving a frontend that cannot reach its backend.

Open **http://localhost:5173**, matching `AUTH_ORIGIN=http://localhost:5173`. localhost and 127.0.0.1 are different origins. Vite now explicitly uses localhost, port 5173 and strictPort, so an occupied port reports an error instead of silently changing to 5174 and failing CSRF origin validation. Its API proxy follows backend PORT; backend variables/secrets are not exposed to the client bundle. Building without backend/.env remains supported.

After updating these scripts, press Ctrl+C in the old dev terminal and run `npm run dev` again. When running API/frontend separately, wait for the API listening message before opening the frontend. `npm run dev:web` includes the readiness wait, while `npm run dev -w frontend` starts only Vite.

`npm test` runs 3 local HTTP readiness tests plus 52 backend tests (55 total), using isolated PostgreSQL for integration cases and injected provider responses for AI cases. Readiness tests cover initially unavailable responses, a bounded timeout for an unrelated HTTP 200 service and hanging requests. No sleeps are added to business logic or auth writes.

### Profile photo

หน้า Profile เลือก เปลี่ยน หรือลบรูปได้ และแสดงรูปเดียวกันใน sidebar รูปเป็นข้อมูลส่วนตัวของบัญชี ไม่แสดงบน Preview สาธารณะ รองรับภาพนิ่ง JPEG/PNG/WebP ขนาดไม่เกิน 2 MiB และ 16,777,216 pixels โดย Sharp ตรวจ/ถอดรหัสจริง ปรับ orientation ตัดเป็นสี่เหลี่ยม 256×256 และแปลงเป็น WebP โดยไม่เก็บ metadata ต้นฉบับ

Migration `005_avatar.sql` เพิ่ม `users.avatar_image` และ `avatar_version` แบบ nullable โดยไม่เปลี่ยนข้อมูลลิงก์/เจ้าของเดิม รัน `npm run db:migrate` ก่อนเริ่ม backend ที่อัปเดต เก็บรูปใน PostgreSQL ไม่ต้องเพิ่ม storage secrets หรือโฟลเดอร์ upload เมื่อ Deploy ต้องติดตั้ง dependency ผ่าน `npm ci` บนระบบปลายทางเพื่อให้ Sharp ใช้ binary ตรง platform ดู contract ที่ [docs/AUTH.md](docs/AUTH.md)

### Create account: ชื่อและยืนยันรหัสผ่าน

ฟอร์มสมัครสมาชิกให้กรอก Display name (1–80 ตัวอักษร), Email, Password และ Confirm password
รหัสทั้งสองต้องตรงกันก่อนส่ง API โดยไม่ส่งหรือจัดเก็บรหัสยืนยัน ชื่อบันทึกใน users.display_name
ตั้งแต่สมัครและแสดงใน Profile/workspace ได้ทันที API เดิมยังสมัครด้วย email/password ได้
ดู contract ที่เพิ่มใน [Authentication documentation](docs/AUTH.md#registration-name-and-confirmation)

## Progressive authentication UI

Login now uses Account → Password; registration uses Account (display name + email) → Password → Confirm. Continue/back/edit only change frontend form state. Only the final submission calls the existing Login/Register API; successful authentication opens the workspace immediately. Password rules remain at least 10 characters and at most 72 UTF-8 bytes, with matching confirmation on registration. Password visibility controls, labels, automatic step focus and busy locks support keyboard use. No social login, fake onboarding timer or new backend endpoint was introduced.

## Shared interactive buttons

`frontend/src/components/ui/interactive-hover-button.tsx` contains reusable native button/anchor wrappers, adapting the supplied hover-button reference to existing CSS rather than adding Tailwind/shadcn. Native props/ref, submit type, download/href/target and existing event handlers are forwarded. Text actions use a lime expanding fill and sliding text/arrow on pointer hover or keyboard focus (180ms, specific properties only). Back keeps its left arrow. Icon-only controls and Link options disclosure stay simple. Disabled/loading actions retain their original content without duplicated animation layers. The decorative repeat is aria-hidden; accessible names and focus outlines remain. Coarse pointers keep static labels; reduced-motion removes movement/transitions. No dependency or backend changes.

## Morph loading indicators

A shared `frontend/src/components/ui/morph-loading.tsx` adapts the supplied four-shape reference to the existing React/TypeScript + CSS architecture. Styles/keyframes live in styles.css and dimensions/timing in theme.css; no Tailwind/shadcn or animation dependency is needed. Small (20px) indicators inherit the button text color; medium (64px) indicators use lime on session/Preview/history loading. Existing request states, disabled controls, error/success responses and readable status text remain authoritative. Indicators are decorative (`aria-hidden`); text/status regions describe the operation. Reduced-motion shows four stationary shapes. No fake progress or minimum loading timer.

## Private tags

เพิ่ม Tags ใน Link options ตอนสร้าง หรือกด Edit ใน My links เช่น `โซเชียล, สมัครงาน, campaign` รองรับสูงสุด 8 Tags ต่อ link, 32 ตัวอักษรต่อ Tag; trim/NFC/lowercase และรวมค่าซ้ำ Tags เป็นข้อมูลส่วนตัว ไม่แสดงใน public Preview หรือ QR กรองทีละ Tag ร่วมกับคำค้นได้ และ CSV ส่งออกทุกหน้าตามตัวกรอง (คง 7 คอลัมน์เดิม)

`GET /api/tags` ต้อง Login และคืนเฉพาะ Tags ที่ใช้ในลิงก์ของเจ้าของ อ่าน contract, validation และผลตรวจที่ [Tags documentation](docs/TAGS.md)

รัน `npm run db:migrate` ก่อนเริ่ม backend ที่อัปเดต: migration `006_link_tags.sql` เพิ่ม `links.tags` เป็น `text[] NOT NULL DEFAULT '{}'` และ GIN index โดยคงข้อมูล/เจ้าของเดิม migration 006 เดิมมี 4 ตาราง; ปัจจุบัน migration 007 เพิ่มเป็น 9 ตาราง รันซ้ำได้ ลิงก์เก่าเริ่มต้นไม่มี Tags
## Render deployment

Deploy one Free Node web service with the existing Supabase database using render.yaml. Read [step-by-step Render setup](docs/RENDER.md). Secrets stay in Render Environment; HTTPS origin is supplied automatically by Render through scripts/start-render.mjs. [Live application](https://synerry-link-studio.onrender.com) was verified on 2026-10-04 for build/startup, hosted migration, database health, production cookie flags and Login UI. Authenticated end-to-end flows and physical QR scanning remain unverified online.

### Reviewer provisioning verified — 2026-10-04

สร้างบัญชีผู้ตรวจจาก backend/.env ในฐานข้อมูลที่แอปใช้แล้ว ตรวจ Login ผ่าน HTTPS API ของ https://synerry-link-studio.onrender.com สำเร็จและ displayNameตรง จากนั้นLogout sessionตรวจสำเร็จ204. เป็นสมาชิกปกติ ไม่มีสิทธิ์admin/ข้อมูลของคนอื่น. ไม่บันทึกemail/passwordจริงในเอกสารหรือGit. เป็นAPIcheckเท่านั้น ยังไม่ได้ตรวจbrowserของCEOหรือรับรองflowทั้งหมด. การสร้างบัญชีนี้ไม่ใช่deployment/migration007 verification.
