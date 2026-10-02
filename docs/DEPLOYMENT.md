# Deploy checklist

ใช้ host ที่รองรับ Node.js 22 หรือ Docker และ PostgreSQL แบบ persistent เอกสารนี้เป็นขั้นตอนทั่วไป ไม่รับประกันราคาหรือ free tier ของผู้ให้บริการ

## Node.js host

1. Push repository แล้วเชื่อม host กับ repository (root directory เป็น root ของโปรเจกต์)
2. Provision PostgreSQL และสร้าง database/user ให้เป็นเจ้าของ schema
3. กำหนด runtime secrets:
   - `DATABASE_URL`: connection string จริง; encode อักขระพิเศษใน username/password
   - `PUBLIC_BASE_URL`: เช่น `https://your-app.example.com` ไม่มี path/query/fragment
   - `NODE_ENV=production`
   - `PORT`: ใช้ค่าที่ host จัดให้ Express bind `0.0.0.0`
   - `TRUST_PROXY_HOPS`: จำนวน reverse proxies ที่เชื่อถือและรู้ topology จริง ใช้ 0 local / 1 เมื่อมี proxy เดียว อย่าตั้ง true แบบไม่จำกัด
   - `DATABASE_SSL=true` เมื่อ host ต้องใช้ TLS; ถ้ามี private CA ให้ตั้ง `NODE_EXTRA_CA_CERTS` ตามคู่มือ host ห้ามแก้เป็น `rejectUnauthorized: false`
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
- ทดลองสร้าง alias เดิมได้ 409 โดยไม่เกิด 500
- Restart/redeploy แอปแล้วตรวจว่าประวัติยังอยู่ (PostgreSQL ต้อง persistent)
- ตรวจ repository ไม่มี `.env`, credentials, database files หรือ log ที่มี secrets
- ตรวจ build/start logs และ health endpoint; อย่าเผย connection string ใน screenshot

## ข้อจำกัดและการต่อยอด

- Demo เปิด workspace สาธารณะ: ถ้าจะใช้หลายลูกค้าจริง ต้องเพิ่ม authentication, ownership และ authorization ทุก API
- Rate limit อยู่ใน memory ของ service และใช้กับ POST เท่านั้น; หลาย instance ต้องใช้ distributed store และเพิ่ม read/redirect abuse controls
- จำนวนเปิดรวม repeated GET และ bots ไม่ทำ unique visitor analytics
- Aggregation ของ events เหมาะกับ demo; ข้อมูลใหญ่ต้องปรับ SQL/index, rollup รายวัน, retention และ async queue
- ระบบไม่ตรวจว่า URL ปลายทางออนไลน์หรือเป็น phishing: ไม่ fetch URL เพื่อหลีกเลี่ยง SSRF; public production ต้องมี abuse reporting/moderation
- ไม่รองรับแก้ปลายทาง/ลบลิงก์จาก UI จึงลด scope และผลกระทบจาก shared workspace
- Free host อาจ sleep หรือเปลี่ยนข้อจำกัด ควรตรวจ availability ก่อนวันนำเสนอ
