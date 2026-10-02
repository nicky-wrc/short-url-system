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

- สร้าง Short URL ด้วยรหัสสุ่ม 8 ตัวอักษร (48-bit randomness) และ unique constraint ใน PostgreSQL พร้อม retry เมื่อชนกัน
- เปิด Short URL แล้ว redirect แบบ HTTP 302 ไป URL ต้นฉบับ พร้อมเก็บเหตุการณ์เปิดในฐานข้อมูล
- QR Code เข้ารหัส **Short URL** เพื่อให้การสแกนผ่าน redirect และนับการเปิดเหมือนคลิกลิงก์
- ดู/ดาวน์โหลด PNG 512 × 512, คัดลอกลิงก์, เปิดลิงก์ในแท็บใหม่
- ประวัติพร้อม URL ต้นฉบับ ชื่อ รหัส วันที่สร้าง สถานะ และจำนวนเปิด ค้นหาและแบ่งหน้า
- สถิติรวม ลิงก์ active จำนวนเปิดวันนี้ และกราฟ 7 วัน (UTC); รีเฟรชทุก 15 วินาทีขณะเปิดหน้า
- ฟีเจอร์เสริม: ชื่อกำกับลิงก์, custom alias, วันหมดอายุ (410 เมื่อหมดอายุ)
- Validation ที่ server, parameterized SQL, Helmet headers, rate limit การสร้าง 30 ครั้ง/นาที/IP และไม่เก็บ IP หรือ User-Agent

**ขอบเขต:** เป็น shared demo workspace ไม่มี login ทุกคนที่เข้าถึงระบบสามารถดูรายการ URL ได้ อย่าใส่ URL ส่วนตัวหรือ URL ที่มี token/secret ลงในเดโม จำนวนเปิดคือทุก successful GET รวม repeat visits และ bot ไม่ใช่จำนวนคนที่ไม่ซ้ำ HEAD/QR preview/expired/missing link ไม่นับเป็นการเปิด

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
```

```sh
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

เปิด http://localhost:3000 ได้ทั้ง UI, API และ redirect จาก Express ตัวเดียว ให้เปลี่ยน `NODE_ENV=production` ใน environment เมื่อใช้งาน production จริง

## Docker Compose

คัดลอก root `.env.example` เป็น `.env` กำหนด `POSTGRES_PASSWORD` ด้วยรหัสสุ่มที่ใช้ใน URL ได้ (เช่น hex) และ `PUBLIC_BASE_URL`

```sh
docker compose up --build -d
```

เปิด http://localhost:3000 ฐานข้อมูลอยู่ใน named volume และไม่ expose database port แอปจะรอ health check ของฐานข้อมูลและ run migration ก่อนเริ่มทำงาน

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

Integration tests ใช้ PostgreSQL จริงผ่าน `TEST_DATABASE_URL` ชื่อฐานข้อมูลต้องลงท้าย `_test` และ **จะลบข้อมูลทั้งหมดในตาราง links/click_events ของฐานข้อมูลทดสอบ** แยกจากฐานข้อมูลใช้งานเสมอ

ครอบคลุม create → redirect → persistence, เปิดพร้อมกันโดยจำนวนไม่หาย, HEAD ไม่นับ, alias ชนพร้อมกัน, QR PNG, validation, expiry, missing link, pagination/search และสถิติ UTC

Tests ยังถอดรหัส QR กลับเป็น short URL และตรวจ rate limit + `Retry-After`

เช็กรายการทดสอบด้วยตนเองและข้อจำกัดใน [TESTING.md](docs/TESTING.md)

## API

| Method | Endpoint | ผลลัพธ์ |
|---|---|---|
| GET | `/api/health` | Database connectivity: 200/503 |
| POST | `/api/links` | สร้างลิงก์: 201, invalid: 400, alias ซ้ำ: 409, rate limit: 429 |
| GET | `/api/links?page=1&limit=10&q=keyword` | ประวัติ (limit 1–50) |
| GET | `/api/stats` | สถิติ workspace และ 7 วัน (UTC) |
| GET | `/api/links/:code/qr` | QR PNG; เพิ่ม `?download=1` เพื่อดาวน์โหลด |
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
