# Verification

## Automated integration tests

`npm test` ใช้ Express ผ่าน supertest และ PostgreSQL จริง ต้องตั้ง `TEST_DATABASE_URL` ไปฐานข้อมูล loopback แยกชื่อ `_test` และ opt-in `TEST_DATABASE_RESET=true` Tests truncate ตารางก่อนและหลังรัน ปฏิเสธ remote host และ application database เดียวกัน (CI อนุญาตเฉพาะ disposable DB พร้อม `NODE_ENV=test`) มีการจำลอง query failure เฉพาะกรณีตรวจการปิดรายละเอียดใน error response

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
12. Preview metadata/page และ HEAD ไม่เพิ่ม event, Continue ผ่าน redirect เพิ่ม 1; encoded path/query/fragment ตรงปลายทางเดิม
13. Preview missing/invalid 404 และ expired page 410, metadata expired, ไม่มี event จากการดู
14. Existing reserved code `preview` ยัง redirect/QR ได้; repeated Preview/QR download และ HEAD ไม่สร้าง event; query ไม่ทับ destination
15. Expiry เปลี่ยนหลังเปิด Preview: backend GET/HEAD ตรวจใหม่และไม่สร้าง event; missing HEAD ไม่นับ
16. Local target spy ยืนยัน API/page/QR ไม่เรียกเว็บไซต์ปลายทาง; hostname ไม่รวม port และ title HTML เป็น metadata ข้อความ
17. Invalid imported destination, malformed path และ database failure ไม่ redirect/เพิ่ม event/เปิดเผยข้อความ private

รายการข้างต้นเป็น coverage หลาย assertions ต่อ test case; suite ปัจจุบันมี **15 test cases**

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

## Link Preview verification · 2 October 2026

- `npm run typecheck` ผ่าน; integration suite เพิ่มเป็น **11 tests** ผ่านบน PostgreSQL local แยกจาก Supabase
- Frontend production build ไป `tmp/preview-build` และ backend build ผ่าน; build output เดิม `frontend/dist` มี EPERM ที่ตรวจพบก่อนเพิ่มฟังก์ชันนี้
- Preview ไม่ fetch เว็บไซต์ปลายทาง, ไม่สร้าง event และไม่รับรองความปลอดภัยของเว็บไซต์
- Tests ตรวจ GET/HEAD ของ Preview, status missing/expired, query/fragment, ปุ่ม Continue ผ่าน redirect และ HTML shell ไม่แทรก title เป็น raw HTML
- Browser ตรวจ desktop/mobile 390px: หน้า Preview ไม่ล้นแนวนอนและปุ่มหลักสูง 44px; expired ไม่มี Continue ที่กดได้ และ missing แสดง Link not found
- Browser Continue จาก fixture ใน local test DB ไป SYNERRY จริงพร้อม fragment; ตรวจ DB ได้ active=1 event และ expired=0 แล้วลบเฉพาะ named QA fixtures
- Title fixture `<script>alert(123456)</script>` แสดงเป็นข้อความ ไม่มี script element ใน title หรือ dialog จาก payload
- Copy preview แสดง success ใน UI แต่ Clipboard API ของ in-app browser ที่ใช้ตรวจยังอ่านค่าเดิม จึงยังไม่ยืนยัน clipboard payload บน browser ปกติ ให้ตรวจ Copy/Paste ด้วยตนเองก่อนส่งงาน

## Supabase verification · 2 October 2026

- เปลี่ยน main database เป็น Supabase Session pooler พร้อม TLS และ CA certificate จากผู้ใช้ โดยคง certificate/hostname verification
- Migration สร้าง schema สำเร็จ และย้าย 2 links + 1 open event จากฐานข้อมูล local โดยไม่แก้ข้อมูลต้นทาง
- `node scripts/check-supabase.mjs` ผ่าน: health, create, 302 redirect, HEAD ไม่นับ, QR decode ตรง short URL, persisted count/history และ invalid URL
- หลังตรวจมี 3 links และ 2 open events รวมลิงก์ที่ระบุชื่อ `Supabase smoke test` ซึ่งเป็นข้อมูลการทดสอบจริง
- Tests แบบ truncate ยังใช้ PostgreSQL local แยก ไม่ชี้ไป Supabase
- การย้ายฐานข้อมูลขึ้น cloud ยังไม่ใช่การ deploy ตัวแอป: PUBLIC_BASE_URL ยังคง localhost จนกว่าจะ deploy Express/React

## Preview regression audit · 2 October 2026 (latest)

- อ่าน AGENTS.md, SKILL.md และตรวจ implementation; รักษา direct Short URL/QR เดิมและเพิ่มเฉพาะการแก้ Preview
- `npm run typecheck`, `npm test` (**15/15**) และ **standard `npm run build` ผ่าน** แก้ permission ของ generated `frontend/dist` แล้ว ข้อจำกัด EPERM ในบันทึก Preview รอบก่อนถูกแก้แล้ว ไม่ต้องใช้ temporary build workaround
- Tests ใช้ PostgreSQL local `127.0.0.1:55432/shorturl_test` แยกจาก Supabase; ตรวจ guard ว่า opt-in=false, remote host และ application DB เดียวกันใน development ถูกปฏิเสธก่อนเชื่อมต่อ
- Preview/QR/HEAD ไม่สร้าง event; legacy reserved code ยังเปิดได้; Continue ผ่าน backend และรักษา stored query/fragment; expiry race และ invalid imported HTTP scheme ถูกบล็อกก่อน INSERT
- Browser: reload Preview, HTML-like title เป็นข้อความ (ไม่มี child HTML), ไม่มี img/iframe/embed/object จากปลายทาง, loading/error states, error HTML จาก proxy ถูกแทนข้อความทั่วไป, encoded code, missing message และ expired button disabled
- Keyboard: Tab เข้าถึง Copy และมี outline 3px; Enter บน Continue แสดง Opening/ปิดการกดซ้ำ Mobile viewport 390×844 กับ URL ยาว 1,855 ตัวอักษรไม่มี horizontal overflow และแสดง full URL แบบ wrap; hostname punycode ไม่รวม port
- Browser double-click Continue บน local fixture: ตรวจ DB พบ **1 event** แต่ in-app browser ติด CDP timeout หลังนำทางและยังแสดง URL Preview จึง **ยังไม่ยืนยัน final navigation/ปลายทางจาก browser รอบนี้** การ recheck expiry หลัง metadata โหลดยืนยันด้วย integration test; UI expired หลัง reload ยืนยันด้วย browser
- ลิงก์เดิม `synerry-demo` ในฐานข้อมูลใช้งาน: QR decode ได้ `http://localhost:3000/synerry-demo`, HEAD ตอบ 302 ไป `https://www.synerry.com/`, count ก่อน/หลังเท่ากับ 1 ไม่แก้ production data ใน audit นี้
- รูปหลักฐานอยู่ `tmp/qa/preview-long-url-mobile.png` และ `tmp/qa/preview-expired-regression.png` (ignored) ล้างเฉพาะ QA fixtures จากฐานข้อมูล local หลังตรวจ

**ยังไม่ได้ตรวจ:** deployment ออนไลน์และ physical QR scan ด้วยมือถือ, clipboard payload บน browser ปกติ, final Continue navigation ใน browser รอบล่าสุดเนื่องจากเครื่องมือ timeout ระบบไม่มี disabled status จึงไม่มีกรณี disabled ให้ตรวจ ก่อนส่งงานให้เปิด Preview ใน Chrome/Edge, กด Continue/ดับเบิลคลิกแล้วตรวจ destination และ count +1; แก้ expiry จาก test fixture หลังเปิด Preview แล้วกด Continue ต้องได้ 410 และ count ไม่เพิ่ม

## Quick expiry presets · 2 October 2026 (latest)

- `npm run typecheck`, `npm test` **18/18** และ `npm run build` ผ่าน ไม่มีการเพิ่ม/อัปเกรด dependency หรือเปลี่ยน schema
- Tests ควบคุม backend clock และ Date ผ่าน Node test mocks (Node 22 แสดง ExperimentalWarning สำหรับ MockTimers) ไม่รอจริง ครบ none/default, 1h/1d/7d, custom offset → UTC, legacy expiresAt, invalid enum, conflicting fields, custom missing/invalid/no offset/past/equal-to-now
- เลื่อน clock ก่อนสร้างเพื่อยืนยันว่า preset เริ่มจาก creation time; ตรวจ `expiresAt - createdAt` เท่าระยะเวลาพอดีใน PostgreSQL, list และ Preview ตรงกัน
- Boundary: Preview active ที่ expiry-1ms, HEAD 302 ไม่นับ; ที่ now=expiry Preview expired, GET/HEAD redirect 410 และ event=0
- Browser QA บน `localhost:3111` ใช้เฉพาะฐานข้อมูล local test: ค่าเริ่มต้น none, สร้าง preset 1h สำเร็จ, ผลสร้าง/ประวัติ/Preview แสดง `2 Oct 2026, 21:41:06 (Asia/Bangkok)` ตรงกัน และ count=0
- Select ใช้ keyboard ArrowDown เปลี่ยน none → 1h, focus มี solid outline; custom แสดง timezone และ required field; เปลี่ยนกลับ preset ซ่อน/ล้าง custom time ไม่ส่ง conflicting fields
- Mobile 390×844: document width 375px ไม่มี horizontal overflow ของหน้า ฟอร์ม expiry stack เป็นหนึ่งคอลัมน์ ภาพอยู่ `tmp/qa/expiry-custom-mobile.png` และ `tmp/qa/expiry-preview.png` (ignored)
- เครื่องมือ browser fill ช่อง datetime-local ไม่สำเร็จ จึงยังไม่ยืนยัน custom valid creation ผ่าน UI; API custom/UTC ตรวจผ่านแล้ว ต้องกรอกเวลาจริงบน Chrome/Edge เพื่อยืนยัน UI เพิ่มเติม ยังไม่ได้ deploy/physical mobile QR scan
- ลบเฉพาะ QA record `H49FFhEW` จาก local test database หลังตรวจ ไม่เขียน/ล้างข้อมูล Supabase

## Shared history CSV · 2 October 2026 (latest)

- `npm run typecheck`, `npm test` **23/23** และ `npm run build` ผ่าน ใช้ PostgreSQL loopback แยกที่ opt-in ล้างได้ ไม่แตะข้อมูล Supabase
- 5 tests เพิ่ม: Thai/comma/quote/newline round-trip ผ่าน CSV reader, UTF-8 BOM, UTC timestamps, empty expiry, expired-at-equality, numeric event count, safe download headers และ export/HEAD ไม่สร้าง event
- Formula tests ครบ `= + - @` หลัง space/tab/CRLF/NUL/control/NBSP/BOM/zero-width/Unicode separator และ mixed prefixes ตรวจทุก untrusted text field ไม่พึ่ง quoting อย่างเดียว
- Search ใช้ validator/SQL filter เดียวกับ list; fixtures 8 รายการเทียบ export กับ history สองหน้า รวม ties ที่ created_at เท่ากัน, literal `%_`, invalid/duplicate/unsupported query และ SQL-like text
- Export ว่างมี header 7 คอลัมน์; 10,000 รายการส่งครบ; 10,001 ตอบ 413 JSON ไม่มี attachment หรือข้อมูล CSV บางส่วน
- Browser UI ดาวน์โหลดจริง: หน้าแรกมี 6 จาก 8 แต่ไฟล์ `shared-links-2026-10-02.csv` มีครบ 8 รายการ (1,464 bytes); BOM `efbbbf`, Thai quotes/newline และ counts เป็น numeric digits
- Browser ค้น `qa-csv-8` แล้วดาวน์โหลดได้ไฟล์ 414 bytes มีเฉพาะ 1 รายการตรงคำค้น ไม่มี console errors ที่ตรวจ เครื่องมือ waitForEvent(download) timeout สำหรับ Blob download แต่ตรวจไฟล์ที่เกิดจริงใน Downloads ได้ จึงไม่ใช้ event timeout เป็นหลักฐานว่าดาวน์โหลดไม่สำเร็จ
- Mobile 390×844: document 375px ไม่มี horizontal overflow, ปุ่ม CSV สูง 44px, ข้อความ shared history/all pages/limit เห็นชัด ภาพและสำเนา CSV อยู่ `tmp/qa/` (ignored)
- ยังไม่ได้เปิดไฟล์ด้วย Excel จริง หรือทดสอบ Excel re-save/import หลายเวอร์ชัน; ยังไม่ Deploy รอบนี้ QA fixtures ล้างเฉพาะ code `qa-csv-1` ถึง `qa-csv-8` ใน local test database
