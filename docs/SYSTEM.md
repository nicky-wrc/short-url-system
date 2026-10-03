# Link Studio — การออกแบบระบบปัจจุบัน

ตรวจเทียบ source code และ migrations 001–007 เมื่อ 2026-10-04 เอกสารนี้อธิบายสิ่งที่ implementation ทำจริง ไม่ใช่รายการฟีเจอร์ที่วางแผนไว้

- [เว็บออนไลน์](https://synerry-link-studio.onrender.com) · [Repository](https://github.com/nicky-wrc/short-url-system)
- [DFD / ER / Architecture / Sequence](DIAGRAMS.md)
- [ฐานข้อมูลและ Data Dictionary](DATABASE.md) · [API](API.md)
- [หลักฐานและข้อจำกัดการตรวจ](TESTING.md) · [Render](RENDER.md)

## ขอบเขตและผู้ใช้งาน

สมาชิกสมัคร/Login เพื่อสร้างและจัดการลิงก์ของตนเอง ประวัติ การค้นหา Tags สถิติ CSV และ Profile เป็นข้อมูลส่วนตัวที่ backend ตรวจ session และ ownership ผู้รับลิงก์เปิด Short URL, Preview และ QR ได้โดยไม่ต้อง Login ผู้มี code สามารถเห็นชื่อและ URL ปลายทางผ่าน Preview จึงไม่ควรใส่ secrets ในชื่อหรือ URL

ลิงก์เก่าที่ `owner_id IS NULL` ยังเปิดและสร้าง QR ได้ แต่ไม่เข้าประวัติของสมาชิกใหม่ ไม่มี API อ้างสิทธิ์ ไม่มี shared workspace, admin console, social login, email verification, password reset หรือการลบลิงก์/บัญชี

## ฟังก์ชันและการจัดเก็บ

| ฟังก์ชัน | พฤติกรรมจริง | Source / store |
|---|---|---|
| สมัคร/Login/Logout | Passport Local, bcrypt cost 12; PostgreSQL session; CSRF; absolute expiry ค่าเริ่มต้น 8h | `auth.ts`; users / sessions |
| Profile | เปลี่ยนชื่อ, รูป, รหัสผ่าน; email read-only; เปลี่ยนรหัสยกเลิก session ทุกเครื่องของเจ้าของ | `auth.ts`, `avatar.ts`; users / sessions |
| สร้างลิงก์ | HTTP/HTTPS; crypto code 8 ตัว หรือ alias; unique conflict retry สูงสุด 5 รอบ | `app.ts`; links |
| Expiry | none / 1h / 1d / 7d / custom; preset ใช้ backend creation clock; เก็บ timestamp UTC | `app.ts`, `clock.ts`; links.expires_at |
| แก้ลิงก์ | แก้ title / originalUrl / private tags เฉพาะเจ้าของ; code, owner, expiry, status และ events คงเดิม | `app.ts`; links |
| ปิด/เปิด | ส่ง isActive true/false; idempotent; ไม่ต่ออายุหรือทำให้สถิติเดิมหาย | `app.ts`, `link-status.ts`; links |
| Tags | เลือกหรือพิมพ์, เพิ่มด้วย Enter/+; สูงสุด 8; NFC/trim/lowercase/deduplicate; private | `TagsInput.tsx`, `tags.ts`; links.tags |
| Preview | `/preview/:code`; อ่าน hostname ด้วย URL parser และสถานะ; Continue ผ่าน backend | `LinkPreviewPage.tsx`, `app.ts`; links / preview_events (แยกจาก clicks) |
| Redirect | `/:code`; transaction + FOR SHARE ตรวจสถานะล่าสุด, INSERT event, COMMIT แล้ว 302 | `app.ts`; links / click_events |
| QR | server สร้าง PNG 512×512 จาก Short URL; สร้าง/ดาวน์โหลดไม่นับ event | `app.ts`; links / qr_codes (PNG cache) |
| My links / CSV | owner scope + search AND single tag; sort created_at DESC, id DESC; CSV ทุกหน้า สูงสุด 10,000 แถว | `app.ts`, `csv.ts`; links / click_events / csv_exports |
| Analytics | ยอดทั้งหมด, active, opens วันนี้, 7 วัน UTC; ไม่ถูกกรองด้วยคำค้น/Tag ของประวัติ | `app.ts`; links / click_events |
| AI assistant | ตอบคำถาม/แนะนำชื่อ; optional opt-in ส่งยอดรวมเจ้าของ; ไม่สร้าง/แก้ลิงก์; ไม่มี tools/web browsing | `assistant.ts`; chat_conversations / chat_messages + ยอดรวม + OpenAI |

## โครงสร้างและเหตุผล

React 19 + TypeScript + Vite อยู่ใน `frontend/`; Express 5 + TypeScript + pg อยู่ใน `backend/` เป็น modular monolith หนึ่ง Node service ไม่ใช่ microservices ไม่ใช้ Next.js, Tailwind หรือ shadcn CLI ระบบ styling เป็น CSS tokens (`theme.css`) และ component CSS (`styles.css`); motion ใช้เฉพาะเอฟเฟกต์ข้อความ Auth ที่มีอยู่

Production: Render เสิร์ฟ React build, API และ Redirect ด้วย HTTPS origin เดียว ฐานข้อมูล PostgreSQL อยู่บน Supabase เชื่อม Session pooler port 5432 ผ่าน verified TLS ไม่ใช้ Supabase Auth/Storage และไม่เรียก Data API จาก browser รูปโปรไฟล์เก็บ normalized WebP ใน users ไม่ใช้ filesystem uploads จึงอยู่ข้าม redeploy ได้

Development: Vite localhost:5173 proxy `/api` ไป Express ตาม PORT; Short URL ใช้ PUBLIC_BASE_URL (ปกติ localhost:3000) `npm run dev` รอ health พร้อมก่อนเปิด Vite; Render ใช้ `scripts/start-render.mjs` derive origin แล้ว migrate ก่อน start ไม่มี production reset

## นิยามสถานะและสถิติ

Disabled มาก่อน Expired มาก่อน Active; active ต้อง is_active=true และ expires_at=NULL หรือ expires_at>now หากเวลาปัจจุบันเท่ากับ expiry ถือว่าหมดอายุ การ enable ไม่เปลี่ยน expiry

หนึ่ง successful GET ผ่าน `/:code` ที่บันทึก event และ commit สำเร็จ = หนึ่ง open รวมการเปิดซ้ำ/bots ไม่ใช่ unique visitors HEAD ตรวจสถานะและตอบ redirect ได้แต่ไม่เพิ่ม event; Preview, QR, CSV, history และ AI ไม่เพิ่ม event missing=404, disabled/expired=410 ไม่มี Location/event ถ้า DB/event write ล้มเหลว transaction rollback แล้วตอบ error ไม่ redirect

Short URL/QR เปิด Redirect โดยตรง Preview เป็นทางเลือก ไม่บังคับเปิดก่อนทุกครั้ง Continue อ่าน metadata อีกครั้งเพื่อ feedback แล้วนำทางไป `/:code` ซึ่งตรวจข้อมูลล่าสุดใน transaction อีกครั้ง URL ปลายทางใช้ค่าที่เก็บใน DB ไม่รับ query มา override; backend ไม่ fetch ปลายทาง Browser เป็นผู้ตาม Location และ fragment ไม่ส่งไป target server ตามพฤติกรรม URL ปกติ

## ความปลอดภัยที่มีและขอบเขต

Private queries ใช้ user ID จาก session และ parameterized SQL; write endpoints ตรวจ CSRF และ Origin เมื่อส่งมา Session cookie HttpOnly/SameSite=Lax/Secure ใน production, หมุน SID หลัง Login; profile photo decode/re-encode ลบ metadata; JSON 16 KiB (avatar raw 2 MiB); Helmet; API/redirect no-store; CSV BOM และ formula-injection neutralization

Rate limits ใช้ memory ต่อ process: Login/Register/password อย่างละ 20/15min/IP, avatar updates 20/15min/IP, create/edit อย่างละ 30/min/IP, AI 10/min/IP และ 60/h/user; AI พร้อมกันสูงสุด 1/user และ 4/process, timeout 30s ไม่มี distributed quota หรือการจำกัดทุก read/redirect/status/profile request ไม่อ้างว่าไม่มีช่องโหว่เพียงเพราะ tests ผ่าน

AI ใช้ server-only key และ fixed Responses endpoint, `store:false`; opt-in ส่งเฉพาะ asOf/timezone/ยอดรวม ไม่ส่งรายการลิงก์/Tags/รูป/credentials อัตโนมัติ แต่ข้อความที่ผู้ใช้พิมพ์เองถูกส่งให้ provider บทสนทนาสำเร็จเก็บใน chat_conversations/chat_messages แยกเจ้าของ; เรียกอ่านต่อและลบได้; store:false ไม่ใช่คำรับรองว่าผู้ให้บริการไม่เก็บข้อมูลทุกประเภท

## สถานะตรวจและส่งมอบ

Render Live และ hosted migration/build/health/Login UI/production cookie flags ตรวจเมื่อ 2026-10-04 ดู record ใน RENDER.md การ Login จริง, A/B ownership, create→redirect→counts, CSV, Profile, AI, redeploy persistence และการสแกน QR มือถือบนเว็บออนไลน์ยังไม่ยืนยัน เอกสารผลทดสอบเก่าเป็น local QA ตามวันที่ ไม่ใช่หลักฐานออนไลน์

บัญชี demo ใช้ script `npm run demo:users` กับ DB ที่เจ้าของอนุญาตเท่านั้น รหัสสุ่มบันทึกใน ignored tmp และส่งผู้ตรวจเป็นส่วนตัว ไม่มีรหัสจริงใน docs/Git ไม่ยืนยันว่ามี demo accounts บน production จนกว่าจะตรวจจริง
