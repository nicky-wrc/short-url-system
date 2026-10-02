# Verification

## Automated integration tests

`npm test` ใช้ Express ผ่าน supertest และ PostgreSQL จริง ไม่ mock ฐานข้อมูล ต้องตั้ง `TEST_DATABASE_URL` ไปฐานข้อมูลแยกชื่อ `_test` Tests truncate ตารางก่อนและหลังรัน

1. Health connectivity
2. สร้าง → GET redirect → ปลายทาง/headers → จำนวนเปิดใน list และ DB
3. HEAD ไม่นับการเปิด
4. GET พร้อมกัน 12 ครั้ง event count ไม่หาย
5. QR PNG signature/download header และ preview ไม่นับ
6. Alias เดียวกันสร้างพร้อมกัน: 1 success + 2 conflicts
7. Invalid protocol/credentials/alias/expiry/own-origin loop/JSON
8. Missing/expired ไม่บันทึก event
9. Pagination, literal `%` search, UTC stats
10. Unknown API/paths
11. Creation rate limit และ Retry-After

## Manual acceptance

- สร้างผ่าน UI ด้วย URL จริง, ข้อความ error แสดงได้เมื่อ API ปฏิเสธ
- สร้างชื่อ, alias และ expiry จาก browser
- คัดลอก/เปิดลิงก์ → ไปปลายทาง; count เพิ่มหลัง focus/15s
- QR เปิดได้, PNG ดาวน์โหลดได้; **สแกนมือถือจาก public URL ก่อนส่งงาน**
- ค้นหา/แบ่งหน้าและ empty state
- Desktop และ mobile widths, form labels, keyboard focus, modal Escape/Tab trap
- Refresh/restart ไม่ทำให้ประวัติหาย
- Disconnect database → health 503 / UI error ที่กด retry ได้
- Public deployment HTTPS, public base URL ถูกต้อง, persistent database

## Verification record

ตรวจใน Windows วันที่ 2 ตุลาคม 2026 ด้วย Node.js 22.20.0 และ PostgreSQL 17.5 ที่แยกจากฐานข้อมูลเดิมในเครื่อง:

- `npm run typecheck`: ผ่าน
- `npm run build`: ผ่าน (React assets + Express compiled output)
- `npm test`: ผ่าน 9 tests กับ PostgreSQL จริง รวม decoded QR payload และ rate limit
- Browser UI: สร้าง `synerry-demo` ไป `https://www.synerry.com/` สำเร็จ เปิด short URL แล้ว browser ไป SYNERRY จริง และ count เพิ่ม 0 → 1
- Copy: clipboard เท่ากับ short URL
- QR: modal แสดงภาพชัดเจน, download บันทึก PNG จริง; Escape ปิด modal และ focus กลับปุ่มที่เปิด
- Desktop 1440×1000 และ mobile override 390×844: ไม่พบ horizontal overflow ของหน้าหลัก (mobile CSS viewport 375px หลังหัก scrollbar; ตารางมี scroll ภายใน)
- Reload หน้าและ restart Express: ลิงก์และ count ยังอยู่
- Production mode: UI/API/QR ทำงานจาก Express origin เดียว ไม่พบ console warning/error ใน browser ที่ตรวจ
- `.env` และฐานข้อมูลชั่วคราวอยู่ใน gitignore
- Clean install: `npm ci --offline` จาก lockfile และ npm cache ของโปรเจกต์ ผ่าน (dependencies ไม่อาศัย node_modules เดิม)

**ยังไม่ได้ยืนยัน:** physical QR scan บนมือถือผ่าน public URL, public hosting/repository accessibility, Docker image build (Docker daemon ไม่ได้เปิดในเครื่อง), GitHub Actions run และ load/accessibility audit แบบเต็ม

ภาพตรวจอยู่ใน `tmp/qa/` และไม่เข้า Git ตัวอย่าง QR localhost ใช้สแกนข้ามเครื่องไม่ได้ ให้ตรวจจาก live URL ตาม DEPLOYMENT.md ก่อนส่งจริง

## Supabase verification · 2 October 2026

- เปลี่ยน main database เป็น Supabase Session pooler พร้อม TLS และ CA certificate จากผู้ใช้ โดยคง certificate/hostname verification
- Migration สร้าง schema สำเร็จ และย้าย 2 links + 1 open event จากฐานข้อมูล local โดยไม่แก้ข้อมูลต้นทาง
- `node scripts/check-supabase.mjs` ผ่าน: health, create, 302 redirect, HEAD ไม่นับ, QR decode ตรง short URL, persisted count/history และ invalid URL
- หลังตรวจมี 3 links และ 2 open events รวมลิงก์ที่ระบุชื่อ `Supabase smoke test` ซึ่งเป็นข้อมูลการทดสอบจริง
- Tests แบบ truncate ยังใช้ PostgreSQL local แยก ไม่ชี้ไป Supabase
- การย้ายฐานข้อมูลขึ้น cloud ยังไม่ใช่การ deploy ตัวแอป: PUBLIC_BASE_URL ยังคง localhost จนกว่าจะ deploy Express/React
