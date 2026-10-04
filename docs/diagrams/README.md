# Diagram artifacts

ชุดปัจจุบันตรวจจาก source/migrations เมื่อ 2026-10-04 มี 10 ภาพในรูป Mermaid source (`.mmd`) และ SVG: รอบ UI ภาษา/Navigation ตรวจ ER ตรงกับทั้ง 9 ตาราง / 49 columns และตรวจ source parity ของ Mermaid หลัก 7 ภาพ Architecture แสดง browser localStorage สำหรับภาษา/ธีมแยกจาก PostgreSQL; DFD business flows และ FK เดิมคงตรงกับ migrations ไม่มี migration ใหม่ Render ทั้ง 10 ภาพอีกครั้งสำเร็จ

| File stem | ใช้สำหรับ |
|---|---|
| context | ขอบเขตระบบ / external entities |
| dfd-level-0 | ทั้ง 9 business processes และ 9 stores |
| dfd-account-links | มุมมอง process 1.0–3.0 สำหรับนำเสนอ |
| dfd-public-links | มุมมอง process 4.0–6.0 สำหรับนำเสนอ |
| dfd-reports-ai | มุมมอง process 7.0–9.0 สำหรับนำเสนอ |
| er | ทุก column / PK / UK / FK และ cardinality |
| architecture | Render service / modules / Supabase / optional AI |
| create-sequence | สร้าง / code conflict / QR / history |
| redirect-sequence | Preview / Continue / validation / event / redirect |
| auth-sequence | bootstrap / Login / private APIs / Logout |

เปิด SVG ด้วย browser และ zoom เพื่ออ่าน ไม่ต้องติดตั้ง Mermaid เพื่อดูภาพ ตาราง mapping/คำอธิบายใน [DIAGRAMS.md](../DIAGRAMS.md) และ [DATABASE.md](../DATABASE.md) เป็นส่วนหนึ่งของเอกสาร โดยเฉพาะ sessions ไม่มี FK ไป users และ Tags ไม่ใช่ตารางแยก

ER เปิดได้จาก [ภาพ SVG](er.svg) หรือ [ภาพ PNG ความละเอียดสูง](er.png) (6211 × 2152 px) ทั้งสองภาพสร้างจาก `er.mmd` เดียวกัน ครบ 9 ตาราง / 49 columns; PNG เป็นภาพสำรองสำหรับ preview และการส่งงาน

แก้ ER export เมื่อ 2026-10-04: SVG เดิมถูกตัดกลาง XML และลงท้ายด้วย `[Truncated]` จึงเกิด GitHub “Invalid image source” ส่งออกใหม่แบบแบ่งส่วนเพื่อไม่ให้ผลลัพธ์เครื่องมือถูกตัด กำหนดขนาดภาพจาก viewBox และตรวจ XML ของ SVG ทั้ง 13 ไฟล์ผ่าน ตรวจ ER ที่ export ผ่าน browser ในรูป `<img>` และ rasterize เป็น PNG สำเร็จ ตรวจ source/migrations parity ผ่าน ไม่ได้เปลี่ยน schema หรือความสัมพันธ์ใน ER การตรวจ GitHub preview ของไฟล์ใหม่ต้องทำหลัง commit/push

Source ของ 7 ภาพหลักตรงกับ Mermaid blocks ใน DIAGRAMS.md อีก 3 ภาพเป็น subset ของ DFD เดิมโดยใช้หมายเลข process/data store เดิม ไม่ใช่ Level 1 หรือ database copies

SVG เป็น snapshot จาก Mermaid 11 ที่ตรวจ render ผ่าน browser ใช้ light background, Arial/sans-serif, muted green และ `htmlLabels:false`; export พร้อม `xml:space="preserve"` เพื่อรักษาช่องว่างของ vector text และไม่มี foreignObject. Renderer ถูกติดตั้งเฉพาะ ignored tmp สำหรับงานเอกสาร ไม่เพิ่ม dependency ของ frontend/backend และไม่เข้า production build

หากเปลี่ยน implementation ให้แก้ DIAGRAMS.md, sync `.mmd` และ render SVG ใหม่ พร้อมตรวจภาพจริง ห้ามแก้ SVG อย่างเดียวจนต่างจาก source Diagram ชุดนี้ไม่ใช่หลักฐานว่า authenticated production flows หรือ physical QR scan ผ่านแล้ว

## PlantUML สำหรับ draw.io

เพิ่ม source/ภาพทางเลือกครบสามอันใน [plantuml/README.md](plantuml/README.md): DFD Level0, ER และ Architecture ตรงกับระบบเดียวกับ Mermaid; ไม่ได้แทนที่ source เดิม ตรวจ syntax/render ด้วย PlantUML1.2026.8 ผ่านทั้งสาม มี SVG สำรอง เนื่องจาก draw.io รองรับ syntax บางส่วนและยังไม่ได้ตรวจ import ใน draw.io รอบนี้
