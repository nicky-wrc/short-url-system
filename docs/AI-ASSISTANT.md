# Link Studio AI assistant

ผู้ใช้ที่ Login แล้วเปิดปุ่ม **ผู้ช่วย AI** มุมขวาล่างเพื่อถามวิธีใช้ QR, Preview, expiry, CSV, สถิติ และให้ช่วยคิดชื่อลิงก์/ข้อความแคมเปญ ปุ่มลัดเปิดหน้าที่มีอยู่จริง แชตไม่สร้างหรือแก้ลิงก์ ไม่เรียก tools ไม่ fetch ปลายทาง และไม่เปลี่ยน click events

## เปิดใช้ครั้งแรก (ยังไม่มี API key)

1. เข้า [OpenAI API Platform](https://platform.openai.com/) แล้วสมัครหรือเข้าสู่ระบบ
2. สร้าง/เลือก API project ตรวจ Billing และตั้งงบ/การแจ้งเตือนตามที่ต้องการ การใช้ API มีค่าใช้จ่ายแยกจากสมาชิก ChatGPT อ่าน [API quickstart](https://developers.openai.com/api/docs/quickstart)
3. เข้า [API keys](https://platform.openai.com/api-keys) สร้าง secret key ของ project เก็บไว้ส่วนตัว ไม่ส่งลงแชต ไม่ใส่ Git และไม่ใส่ frontend/VITE variables
4. เปิด `backend/.env` ด้วย editor บนเครื่อง เพิ่มหรือแก้สองบรรทัดนี้ (แทน placeholder ด้วย key จริงบนเครื่องเท่านั้น):

```dotenv
OPENAI_API_KEY=YOUR_KEY_ONLY_IN_LOCAL_ENV
OPENAI_MODEL=gpt-5-mini
```

5. หยุด server เดิมด้วย Ctrl+C แล้วรัน `npm run dev` จากโฟลเดอร์โปรเจกต์ Login เปิดผู้ช่วยแล้วถาม “จำนวนเปิดนับอย่างไร?”
6. ถ้าบริการไม่พร้อม ให้ตรวจ Billing, project/model access และ backend network หากเปลี่ยน env ต้อง restart backend บริการนี้ใช้ Responses API พร้อม reasoning effort `low`; โมเดลที่ตั้งเองต้องรองรับ contract นี้
7. ทดสอบถามต่อและปิด/เปิดแชต เลือกส่งยอดรวมเพื่อเทียบตัวเลขกับ Overview; ยกเลิกตัวเลือกจะเริ่มแชตใหม่เพื่อไม่ส่งประวัติคำตอบที่เคยมีข้อมูลยอดรวมซ้ำ

ไม่มี key ยังเข้าใช้งานฟีเจอร์เดิมได้ แชตแสดงข้อความว่ายังไม่เปิดบริการและ disable การส่งคำถาม ปุ่มลัดใช้ได้ ไม่มี fallback แสร้งตอบเป็น AI หากไม่ต้องการใช้ AI ให้เว้น key ว่าง

## ข้อมูลและขอบเขต

- Backend เรียก HTTPS `https://api.openai.com/v1/responses` ด้วย key ฝั่ง server ตาม [Responses/text guide](https://developers.openai.com/api/docs/guides/text); browser ไม่เรียก OpenAI โดยตรง
- ส่งคำถามและประวัติคู่บทสนทนาที่สำเร็จล่าสุด สูงสุด 7 ข้อความรวมคำถามปัจจุบัน, สูงสุด 4,000 characters; คำถาม/ข้อความละ 1,000 characters มีคู่มือผลิตภัณฑ์เป็น instructions ฝั่ง server
- ค่าเริ่มต้นไม่ส่งข้อมูลบัญชี เมื่อ opt-in backend ใช้ session owner อ่านเฉพาะยอดรวม own links, active links, recorded opens และ opens today (UTC) พร้อมเวลาของ snapshot ไม่มี email, รูป, ชื่อหรือ URL ของลิงก์ และไม่มีสิทธิ์อ่านข้อมูลของผู้อื่น
- แชตอยู่ใน React memory; refresh/logout จะล้าง ไม่มีตารางบทสนทนา ไม่เก็บ prompt/provider error ใน application logs และไม่เก็บประวัติใน localStorage
- API ใช้ `store:false` เพื่อลด application state ที่ provider เก็บ แต่ไม่ได้เป็นคำรับรองว่า provider ไม่มี retention ใด ๆ ดู [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- คำตอบเป็น plain text ใน React ไม่ render HTML/Markdown links; AI อาจผิด ไม่ใช่การตรวจ phishing ไม่ให้กรอก passwords/secrets และไม่มีการทำงานอัตโนมัติหรืออ้างว่าดำเนินการสำเร็จ

## API

`GET /api/assistant/status` ต้องมี session: `{ "available": true, "provider": "OpenAI" }` หมายถึง server ตั้ง key แล้ว ไม่ใช่การยืนยันว่า key/billing/network ใช้งานสำเร็จ ไม่มี key หรือ model details ใน response

`POST /api/assistant/chat` ต้อง Login และส่ง `X-CSRF-Token` ตาม auth เดิม Origin ถ้ามีต้องตรง AUTH_ORIGIN

```json
{"messages":[{"role":"user","content":"CSV ดาวน์โหลดอย่างไร?"}],"includeStats":false}
```

Body strict: รับ `user`/`assistant` เริ่มและจบด้วย user, สลับ role, สูงสุด 8 ข้อความ (ดังนั้นจำนวนที่ valid สูงสุด 7); ไม่รับ system role, ownerId, URL ของ provider, tools หรือ model จาก client Success: `{ "reply": "...", "provider": "OpenAI" }`; ถ้า opt-in เพิ่ม `summary` ที่อ่านจาก PostgreSQL แบบ parameterized โดยใช้ session owner เสมอ

Errors: 400 invalid conversation, 401 unauthenticated/expired, 403 CSRF/origin, 429 rate/concurrency limit, 503 not configured/provider quota, 502 sanitized provider/network/empty/incomplete reply, 504 timeout ทุกครั้งที่ผ่าน app มี `Cache-Control: no-store` และ request limit 16 KiB เดิม

Provider errors: HTTP 429 จาก OpenAI ไม่ได้หมายถึงส่งถี่เสมอไป ระบบอ่านเฉพาะ `error.code`/`error.type` จาก body ไม่เกิน 16 KiB เพื่อแยกเครดิตหมด, spend limit, usage limit, insufficient quota และ rate limit แล้วส่งข้อความที่ระบบกำหนดเอง ไม่ส่งต่อ provider message หรือบันทึก body ลง log ถ้ารหัสไม่รู้จัก/body ผิดรูปแบบหรือใหญ่เกินไปจะแสดงข้อจำกัดทั่วไป โดยไม่เดาสาเหตุ HTTP 401/403 จาก provider แสดงปัญหายืนยันตัวตน/การเข้าถึงเป็น HTTP 502 ของแอป ไม่สับสนกับ session ของผู้ใช้

หากเครดิตหรือโควตาไม่พอ ให้ผู้ดูแลตรวจ Billing และ Usage/Spend limits ใน OpenAI Platform ของโปรเจกต์ที่ key สังกัด การสร้าง key ไม่ได้ยืนยันว่ามีเครดิตพร้อมใช้ การรอหรือสร้าง key ซ้ำไม่แก้ billing limit ส่วน rate limit ให้รอแล้วลองใหม่ ระบบไม่ retry อัตโนมัติ ดู [เอกสาร error codes ทางการ](https://developers.openai.com/api/docs/guides/error-codes)

หากเผยแพร่ `.env` หรือส่ง secrets ในแชต ให้ revoke API key, เปลี่ยนรหัสผ่านฐานข้อมูลและ SESSION_SECRET แล้วอัปเดต `backend/.env` ในเครื่องและ restart backend ไม่ส่งค่าใหม่ในแชตหรือ commit ลง Git `/api/assistant/status` บอกว่ามี key ตั้งค่าเท่านั้น ไม่ยืนยันสิทธิ์/เครดิต/provider connectivity

10 requests/minute/IP + 60 requests/hour/user, 1 active question/user และรวม 4/process; provider timeout 30s, max_output_tokens 2048 รวม reasoning tokens ปุ่ม Stop หยุดรอและ abort connection แต่ไม่รับรองว่าหยุดค่าใช้จ่ายที่ provider ดำเนินการแล้ว ระบบไม่ retry อัตโนมัติ

Limits อยู่ใน memory ต่อ process: restart/multiple replicas ไม่ใช่ shared quota และไม่ใช่ hard monetary cap ตั้งงบ/แจ้งเตือนของ API project และติดตาม usage ก่อนเปิดสาธารณะ Status endpoint ไม่เรียก AI และไม่มีค่า token

## ตรวจยืนยัน

Regression tests ใช้ PostgreSQL disposable loopback `_test` พร้อม reset opt-in และปิด real API key ก่อน import app Provider responses ใน tests เป็น contract fixtures ไม่ใช่คำตอบ AI จริง ตรวจ auth/CSRF, input, privacy/owner totals, no click events, safe errors, timeout, rate limit และ concurrency

**ยังไม่ได้ทดสอบคำตอบจาก OpenAI จริงจนกว่าจะตั้ง key** การผ่าน mocked provider tests ไม่ยืนยันสิทธิ์โมเดล Billing หรือคุณภาพคำตอบ ต้องทำข้อ 5–7 หลังตั้งค่า ไม่เพิ่ม schema/dependencies หรือเปลี่ยน API ของลิงก์เดิม

### หน้าตาแชตแบบกระชับ

ช่องพิมพ์เริ่มเป็น capsule และขยายเมื่อมีข้อความ ปุ่มคำถามแนะนำ “ใช้ QR”, “ตั้งชื่อลิงก์”, “การนับคลิก” เติมคำถามเต็มให้แก้ก่อนส่ง ไม่ส่งอัตโนมัติ รายละเอียดความสามารถ/ข้อมูลที่ส่งไป OpenAI และปุ่มลัด workspace อยู่ใต้ปุ่ม ⓘ การเลือก “ส่งสถิติให้ OpenAI” ยังเป็น opt-in และเปลี่ยนตัวเลือกจะเริ่มแชตใหม่ ปุ่มเริ่มแชตใหม่อยู่บน header; Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่ ข้อจำกัด provider quota หรือ Billing ไม่ได้ถูกแก้ด้วยการเปลี่ยน UI
