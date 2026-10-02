# เตรียมนำเสนอ (ประมาณ 15–20 นาที)

## 1. ปัญหาและผลลัพธ์ (1–2 นาที)

“ผม/ฉันพัฒนา Link Studio เพื่อทำให้ URL ยาวแชร์ง่ายขึ้น ทั้งลิงก์สั้นและ QR พร้อมดูว่าลิงก์ถูกเปิดกี่ครั้ง ระบบใช้ React + TypeScript, Express และ PostgreSQL และมีฟังก์ชันหลักตามโจทย์ครบ”

กล่าวว่าฟีเจอร์เสริมคือชื่อกำกับ custom alias และ expiry เพื่อช่วยจัดการลิงก์แคมเปญ

## 2. Demo (5–7 นาที)

1. เปิด workspace ให้เห็น empty state หรือประวัติที่มีอยู่
2. กรอก `https://www.synerry.com` ตั้งชื่อ “SYNERRY website” และ alias ที่ยังไม่เคยใช้
3. สร้าง → คัดลอก → เปิดแท็บใหม่ → ไปเว็บต้นฉบับจริง
4. กลับหน้าเดิมเพื่อดู count เพิ่ม (refresh ทุก 15s และเมื่อ focus)
5. เปิด QR และสแกนด้วยโทรศัพท์ → ไปเว็บต้นฉบับ → ดู count เพิ่ม
6. ดาวน์โหลด PNG และค้นหาลิงก์ในประวัติ
7. ทดลอง alias ซ้ำ → อธิบาย 409 และข้อความที่ผู้ใช้แก้ไขได้
8. สร้างลิงก์ที่ expiry ใกล้ปัจจุบัน แล้วทดสอบหลังหมดอายุ → 410 ไม่นับ opens

ซ้อมด้วย live URL จริงก่อนวันนำเสนอ อย่าใช้ localhost QR กับโทรศัพท์ เพราะ localhost บนโทรศัพท์หมายถึงตัวโทรศัพท์เอง

## 3. Design (4–5 นาที)

เปิด `DIAGRAMS.md`:

- DFD: input → validation → บันทึกลิงก์ → short URL; GET → lookup → expiry → event → redirect
- ER: Links 1:N Click Events; unique code; TIMESTAMPTZ; index ที่ใช้ค้นและนับ
- Architecture: React build/Express ใน service เดียว + PostgreSQL แยก; deploy ง่ายในเวลาสามวัน
- ชี้แจงตรงไปตรงมาว่าไม่ได้ทำ microservices; ไม่แยก service เพียงเพื่อเรียกชื่อ แต่จัดโครงสร้างให้ต่อยอดได้

## 4. Quality และการตัดสินใจ (3–4 นาที)

- “ใช้ 302 และ no-store เพื่อให้การเปิดกลับมาถึง server และนับได้”
- “นับด้วย event insert แทนอ่านค่าแล้วบวก ทำให้เปิดพร้อมกันแล้ว count ไม่หาย”
- “QR บรรจุ short URL ไม่ใช่ original URL จึงนับการสแกนได้ด้วย”
- “Short code สุ่มด้วย crypto และ unique constraint ถ้าชนจะ retry”
- “validate http(s), ไม่รับ credential URL, ใช้ parameterized SQL, แยก env ออกจาก Git”
- แสดง `npm test`, `npm run typecheck`, `npm run build` และรายงานหลักฐานการตรวจจริง

## คำถามที่น่าจะพบ

**ทำไม PostgreSQL?** ข้อมูลลิงก์กับเหตุการณ์เป็นความสัมพันธ์ชัดเจน unique/FK constraints ช่วยรักษาความถูกต้อง และ SQL aggregate ใช้กับสถิติได้ดี

**นับจำนวนคนหรือจำนวนเปิด?** จำนวน successful GET รวมเปิดซ้ำและ bot ไม่มี IP/user-agent จึงไม่อ้างว่าเป็น unique visitors

**เหตุใดไม่ใช้ 301?** Browser/proxy อาจจำ permanent redirect ทำให้บางการเปิดไม่ถึง API และไม่ถูกนับ

**ถ้าฐานข้อมูลล่ม?** Health เป็น 503 และ API แสดงข้อความทั่วไป การเปิดลิงก์ที่บันทึก event ไม่ได้จะไม่ redirect; ขนาดใหญ่ควรออกแบบ queue และนโยบาย fallback

**จะ scale อย่างไร?** แยก redirect service ได้เมื่อมีเหตุผล วาง queue/event workers, distributed rate limit, cache mapping พร้อม expiry, daily rollups และฐานข้อมูล indexes ตาม workload

**จะใช้กับหลาย user อย่างไร?** เพิ่ม users, links.owner_id, authentication และ authorization; ปัจจุบันตั้งใจให้เป็น shared demo workspace ตาม scope

**ปรับอะไรถ้ามีเวลาเพิ่ม?** Authentication/ownership, abuse reporting, unique analytics ที่เคารพ privacy, accessibility audit และ CI/CD

## ก่อนคุย

ต้องเข้าใจและอธิบายโค้ดที่ส่งได้เอง ซ้อม create/redirect/QR อย่างน้อยหนึ่งรอบจาก live URL เตรียม diagram และผลทดสอบ ไม่ควรกล่าวว่า deploy/QR scan สำเร็จหากยังไม่ได้ตรวจจริง
