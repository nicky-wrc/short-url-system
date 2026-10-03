# Deploy checklist

Login/My links requires migration 002_auth.sql before starting the new server. It preserves legacy links/events, adds nullable ownership/users/sessions and enables RLS. Use the schema/table-owner database role for the server; public Data API roles have no policies. Back up the database and review permissions before applying to a hosted database. Render startup completed hosted Supabase migrations on 2026-10-04; authenticated online acceptance checks remain pending.

Production Secure cookies require HTTPS and correctly configured TRUST_PROXY_HOPS. Local HTTP/Compose use development. Run npm run demo:users only against the intended approved database and privately hand off credentials saved under ignored tmp/.

ใช้ host ที่รองรับ Node.js 22 หรือ Docker และ PostgreSQL แบบ persistent เอกสารนี้เป็นขั้นตอนทั่วไป ไม่รับประกันราคาหรือ free tier ของผู้ให้บริการ

## Node.js host

1. Push repository แล้วเชื่อม host กับ repository (root directory เป็น root ของโปรเจกต์)
2. Provision PostgreSQL และสร้าง database/user ให้เป็นเจ้าของ schema
3. กำหนด runtime secrets:
   - `DATABASE_URL`: connection string จริง; encode อักขระพิเศษใน username/password
   - `PUBLIC_BASE_URL`: เช่น `https://your-app.example.com` ไม่มี path/query/fragment
   - `NODE_ENV=production`
   - `SESSION_SECRET`: random secret >=32 characters, outside Git
   - `SESSION_TTL_HOURS=8`: absolute lifetime
   - `AUTH_ORIGIN`: browser HTTPS origin; local Vite uses http://localhost:5173
   - `PORT`: ใช้ค่าที่ host จัดให้ Express bind `0.0.0.0`
   - `TRUST_PROXY_HOPS`: จำนวน reverse proxies ที่เชื่อถือและรู้ topology จริง ใช้ 0 local / 1 เมื่อมี proxy เดียว อย่าตั้ง true แบบไม่จำกัด
   - `DATABASE_SSL=true` เมื่อ host ต้องใช้ TLS; ถ้ามี CA ที่ provider กำหนดให้ตั้ง `DATABASE_SSL_CA_FILE` ซึ่ง resolve จาก backend/ ห้ามแก้เป็น `rejectUnauthorized: false`
4. Build: `npm ci && npm run build`
5. Pre-deploy: `node backend/dist/migrate.js`
6. Start: `node backend/dist/server.js` หรือรวม migration ใน start เมื่อ host ไม่มี pre-deploy hook
7. Health endpoint: `/api/health` ต้องได้ 200 และ `database: connected`

Frontend build อยู่ที่ `frontend/dist` เสิร์ฟโดย Express ไม่ต้อง deploy frontend แยกและไม่ต้องตั้ง CORS `PUBLIC_BASE_URL` ต้องเป็น origin ที่ผู้ใช้เปิดได้ เพราะถูกใช้ใน Short URL และ QR

### Supabase Session pooler

ใช้ connection URI จาก Connect → Session pooler (พอร์ต 5432) และตั้ง `DATABASE_SSL=true` หากพบ `SELF_SIGNED_CERT_IN_CHAIN` ให้ดาวน์โหลด CA certificate จาก Database Settings ของ Supabase เก็บที่ `backend/certs/supabase-ca.crt` แล้วตั้ง `DATABASE_SSL_CA_FILE=certs/supabase-ca.crt` Backend จะตรวจ certificate และ hostname ตามปกติ ไม่ปิด verification ไฟล์นี้ต้องเป็น public CA certificate เท่านั้น ห้ามใส่ private key

เมื่อ Deploy ให้นำ CA file ไปกับแอปหรือ mount file แล้วตั้ง path ให้ถูกต้อง Dockerfile รองรับ `backend/certs` แล้ว ส่วน `TEST_DATABASE_URL` ยังชี้ฐานข้อมูลทดสอบ local และใช้ `TEST_DATABASE_SSL=false`

## Docker host

Build Dockerfile ที่ root ตั้ง env ชุดเดียวกัน และเชื่อม managed PostgreSQL Container รันด้วย user `node` และ migrate ก่อน start ตรวจ outbound connection และ CA certificates ของ provider

## ตรวจหลัง Deploy

- เปิด HTTPS URL จาก browser ที่ไม่ได้ล็อกอินกับบัญชี host
- สร้างลิงก์ไป `https://www.synerry.com`; คลิกลิงก์และยืนยันปลายทาง
- กลับ workspace รอ refresh หรือ focus หน้า และตรวจ count เพิ่ม 1
- เปิด QR ดาวน์โหลด PNG แล้วสแกนด้วยโทรศัพท์ที่ใช้อินเทอร์เน็ตจริง ตรวจ count เพิ่มอีกครั้ง
- ลิงก์ที่ไม่พบตอบ 404; วันหมดอายุผ่านไปตอบ 410
- เปิด `/preview/:code` โดยตรงและ reload ต้องเห็น UI; Preview/HEAD ไม่นับเปิด กด Continue จึงเพิ่ม event; expired Preview ไม่มีปุ่มไปปลายทางที่ใช้งานได้
- `PUBLIC_BASE_URL` ต้องเป็น public HTTPS origin ของ Express ที่รับทั้ง `/preview/:code`, `/api/*` และ `/:code`; Continue ใช้ short URL นี้ ไม่ได้เปิด destination ตรง ๆ Short URL/QR เก่ายัง Redirect โดยตรง
- ตั้ง `TEST_DATABASE_RESET=true` เฉพาะฐานข้อมูล local แยกที่ล้างได้ ไม่ตั้ง test suite ให้ชี้ Supabase/application database
- ทดลองสร้าง alias เดิมได้ 409 โดยไม่เกิด 500
- Restart/redeploy แอปแล้วตรวจว่าประวัติยังอยู่ (PostgreSQL ต้อง persistent)
- ตรวจ repository ไม่มี `.env`, credentials, database files หรือ log ที่มี secrets
- ตรวจ build/start logs และ health endpoint; อย่าเผย connection string ใน screenshot

## ข้อจำกัดและการต่อยอด

- Workspace เป็นส่วนตัว: authentication/ownership มีแล้วใน backend; Short URL/Preview/QR สาธารณะโดยตั้งใจ ต้องเพิ่ม abuse controls และทบทวนสิทธิ์ก่อนรับ workload ขนาดใหญ่
- Rate limit อยู่ใน memory ของ service ใช้กับ auth/password/avatar/create/edit/AI แต่ไม่ครอบคลุมทุก read/redirect/status/profile endpoint; หลาย instance ต้องใช้ distributed store
- จำนวนเปิดรวม repeated GET และ bots ไม่ทำ unique visitor analytics
- Aggregation ของ events เหมาะกับ demo; ข้อมูลใหญ่ต้องปรับ SQL/index, rollup รายวัน, retention และ async queue
- ระบบไม่ตรวจว่า URL ปลายทางออนไลน์หรือเป็น phishing: ไม่ fetch URL เพื่อหลีกเลี่ยง SSRF; public production ต้องมี abuse reporting/moderation
- เจ้าของแก้ชื่อ/ปลายทาง/Tags และปิด/เปิดได้แล้ว; การแก้ปลายทางมีผลต่อผู้รับในอนาคต URL/QR เดิมอยู่ ไม่รองรับลบลิงก์/บัญชีหรือ edit audit log
- Free host อาจ sleep หรือเปลี่ยนข้อจำกัด ควรตรวจ availability ก่อนวันนำเสนอ

## Render Free + Supabase

See [Render deployment guide and verification record](RENDER.md) and root render.yaml. Start uses scripts/start-render.mjs to derive the HTTPS origin and migrate before listening; no paid pre-deploy hook. [Live application](https://synerry-link-studio.onrender.com) was verified on 2026-10-04 for build/startup, migration, database health, cookie flags and Login UI. Authenticated flows and physical QR scanning remain pending.
