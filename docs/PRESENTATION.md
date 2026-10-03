# แนวทางนำเสนอ Link Studio (15–20 นาที)

อ้างอิง implementation วันที่ 2026-10-04 ซ้อมกับ [เว็บออนไลน์](https://synerry-link-studio.onrender.com) และอ่าน verification record ใน RENDER.md ก่อนนำเสนอ ไม่เปิด .env, Render Environment หรือรหัสจริงบนจอ

## 1. ปัญหาและขอบเขต (1–2 นาที)

Link Studio ช่วยแชร์ URL ยาวผ่าน Short URL และ QR พร้อมประวัติและสถิติจาก PostgreSQL สมาชิกมี My links ส่วนตัว ผู้รับเปิดลิงก์และ Preview ได้โดยไม่ Login ฟังก์ชันเสริมมีชื่อ/alias/expiry, แก้ไขลิงก์, เปิด/ปิด, private Tags, CSV, Profile และ AI assistant แบบ optional

ระบบใช้ React 19 + TypeScript/Vite, Express 5 + TypeScript และ pg/PostgreSQL บน Render หนึ่ง web service เสิร์ฟ UI/API/redirect ด้วย origin เดียว เชื่อม Supabase ผ่าน Session pooler และ verified TLS ไม่ใช้ Supabase Auth

## 2. Demo ฟังก์ชัน (6–8 นาที)

1. Login บัญชี A ที่เตรียมไว้เป็นส่วนตัว แสดง Overview และ My links ของ A
2. สร้าง URL จริง เช่น https://www.synerry.com พร้อมชื่อ/Tag และ expiry 7 วัน แสดง Short URL HTTPS ออนไลน์
3. เปิด Preview เพื่อดู hostname, URL เต็ม, expiry/status; refresh แล้วยอดไม่เพิ่ม กด Continue ผ่าน backend ไปปลายทาง แล้วยืนยัน event เพิ่ม 1 หลัง focus/refresh
4. ดาวน์โหลด QR ซึ่งไม่นับคลิก แล้วสแกนมือถือผ่านอินเทอร์เน็ตจริง ตรวจปลายทางและอีกหนึ่ง event ถ้าไม่ได้สแกนจริงให้ระบุชัด
5. Edit ชื่อ/ปลายทาง/Tags แสดง Short URL และ QR code เดิม การเปิดครั้งถัดไปใช้ปลายทางใหม่
6. Disable แล้ว Preview/redirect ต้องไม่พร้อมใช้งานและไม่นับ Enable ใช้ URL เดิมได้หากยังไม่หมดอายุ
7. ค้นหาและกรอง Tag แล้วดาวน์โหลด CSV อธิบาย export ทุกหน้า, max 10,000, UTC, BOM และ formula protection ไม่อ้างว่าเปิด Excel แล้วถ้ายังไม่ได้ทำ
8. Logout และ Login B แสดงข้อมูล B ที่ไม่เห็นข้อมูล A; ผู้ไม่ Login ยังเปิด public Preview/QR/active link ของ A ได้
9. Profile เปลี่ยนชื่อ/รูป และอธิบายว่าการเปลี่ยนรหัสผ่านยกเลิกทุก session ของตนเอง ไม่จำเป็นต้องเปลี่ยนรหัสผู้ตรวจบนเวที
10. สาธิต AI เฉพาะเมื่อ provider/key/billing พร้อม ถามวิธีใช้ QR หรือคิดชื่อลิงก์ เลือก opt-in ส่งยอดรวมได้ AI ให้คำแนะนำแต่ไม่ได้สร้าง/แก้ลิงก์เอง

Expiry boundary ใช้ผล automated tests ที่ควบคุมเวลา ไม่รอ 1 ชั่วโมงบนเวที Alias ซ้ำตอบ 409, invalid URL ตอบ 400, missing ตอบ 404 และ disabled/expired ตอบ 410 อย่าใช้ localhost QR กับมือถือเพราะชี้ไปเครื่องมือถือเอง

## 3. ออกแบบระบบและฐานข้อมูล (4–5 นาที)

เปิด DIAGRAMS.md และ DATABASE.md:

- Context แสดงสมาชิก/ผู้รับ/OpenAI; backend ไม่เรียกเว็บไซต์ปลายทาง
- DFD Level 0 มี 9 processes ครบ Auth/Profile, create, edit/status/Tags, Preview, redirect/events, QR, history/stats, CSV และ AI; data stores 4 ตาราง
- ER: link มี 0..1 owner, user มีหลาย links, link มีหลาย events; sessions ไม่มี FK เพราะ user ID อยู่ใน JSON; Tags เป็น array ใน links
- Database: อธิบาย PK/UNIQUE/FK, nullable legacy ownership, COUNT events, UTC timestamptz (ยกเว้น sessions.expire), owner/code/event/GIN indexes และ WebP ที่เก็บใน DB
- Architecture เป็น modular monolith; UI/API/redirect origin เดียว, persistent DB แยก; additive migrations 001–006 ก่อน start

## 4. เหตุผลและข้อจำกัด (3–4 นาที)

| คำถาม | คำตอบตาม implementation |
|---|---|
| ทำไม 302/no-store? | ไม่ตั้ง permanent mapping ให้เปิดผ่าน backend เพื่อตรวจปลายทาง/สถานะล่าสุดและบันทึก event |
| จำนวนเปิดคือจำนวนคนไหม? | COUNT successful GET events รวมเปิดซ้ำ/bots ไม่มี IP/user-agent จึงไม่อ้าง unique visitors |
| เปิดพร้อมกันแล้ว count หายไหม? | INSERT event แยกต่อ request มี transaction และ row SHARE lock ไม่อ่าน counter แล้วบวก |
| ถ้า DB/event write ล้มเหลว? | rollback และ generic error ไม่ redirect; health 503 เมื่อ DB ไม่พร้อม |
| Short code ชนกัน? | crypto 6 bytes → base64url 8 characters / 48 bits; unique constraint; retry สูงสุด 5; alias ซ้ำ 409 |
| QR เปิดลิงก์ไหน? | Short URL /:code ไม่ใช่ original URL; Preview เป็นทางเลือก /preview/:code |
| B เข้าข้อมูล A ได้ไหม? | private SQL กรอง owner จาก session; direct code ของคนอื่น 404 แต่ public Preview ยังเห็น title/destination ตามเจตนา |
| ทำไมไม่ใช้ Supabase Auth? | Express/Passport Local + PG sessions มีแล้ว Supabase ใช้สำหรับ PostgreSQL hosting |
| AI เห็นอะไรและทำอะไรได้? | guide + conversation; opt-in ยอดรวมเจ้าของ; ไม่มี action tools/target fetch/chat DB; store:false ไม่รับรอง retention ทุกประเภท |
| จะขยายระบบอย่างไร? | distributed rate limits, abuse controls, query profiling, event rollups/retention; แยก service เมื่อ workload มีเหตุผล |

## หลักฐานที่นำเสนอได้

- Local regression ล่าสุด 55 tests (52 backend + 3 readiness) ตาม TESTING.md ไม่อ้างว่ารอบเอกสารรัน integration ใหม่หรือ CI ผ่าน
- Online 2026-10-04: Render Live, build, startup migration, health DB connected, Secure/HttpOnly/__Host cookie และ Login UI
- Authenticated online flows, redeploy persistence, physical QR scan, actual Excel, actual AI answer และ penetration test ยังต้องตรวจ
- script demo:users สร้างรหัสสุ่มใน ignored tmp ใช้เฉพาะ DB ที่ได้รับอนุญาต ไม่มี password จริงใน Git/diagram

ผู้พัฒนาต้องเข้าใจและอธิบายโค้ดที่ส่งได้เอง กล่าวตามหลักฐานจริง ไม่รับรองว่าปลอดภัยทุกด้านหรือจะผ่านการประเมินเพียงเพราะ tests ผ่าน
