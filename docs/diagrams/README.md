# Diagram artifacts

ชุดปัจจุบันตรวจจาก source/migrations เมื่อ 2026-10-04 มี 10 ภาพในรูป Mermaid source (`.mmd`) และ SVG:

| File stem | ใช้สำหรับ |
|---|---|
| context | ขอบเขตระบบ / external entities |
| dfd-level-0 | ทั้ง 9 business processes และ 4 stores |
| dfd-account-links | มุมมอง process 1.0–3.0 สำหรับนำเสนอ |
| dfd-public-links | มุมมอง process 4.0–6.0 สำหรับนำเสนอ |
| dfd-reports-ai | มุมมอง process 7.0–9.0 สำหรับนำเสนอ |
| er | ทุก column / PK / UK / FK และ cardinality |
| architecture | Render service / modules / Supabase / optional AI |
| create-sequence | สร้าง / code conflict / QR / history |
| redirect-sequence | Preview / Continue / validation / event / redirect |
| auth-sequence | bootstrap / Login / private APIs / Logout |

เปิด SVG ด้วย browser และ zoom เพื่ออ่าน ไม่ต้องติดตั้ง Mermaid เพื่อดูภาพ ตาราง mapping/คำอธิบายใน [DIAGRAMS.md](../DIAGRAMS.md) และ [DATABASE.md](../DATABASE.md) เป็นส่วนหนึ่งของเอกสาร โดยเฉพาะ sessions ไม่มี FK ไป users และ Tags ไม่ใช่ตารางแยก

Source ของ 7 ภาพหลักตรงกับ Mermaid blocks ใน DIAGRAMS.md อีก 3 ภาพเป็น subset ของ DFD เดิมโดยใช้หมายเลข process/data store เดิม ไม่ใช่ Level 1 หรือ database copies

SVG เป็น snapshot จาก Mermaid 11 ที่ตรวจ render ผ่าน browser ใช้ light background, Arial/sans-serif, muted green และ `htmlLabels:false`; export พร้อม `xml:space="preserve"` เพื่อรักษาช่องว่างของ vector text และไม่มี foreignObject. Renderer ถูกติดตั้งเฉพาะ ignored tmp สำหรับงานเอกสาร ไม่เพิ่ม dependency ของ frontend/backend และไม่เข้า production build

หากเปลี่ยน implementation ให้แก้ DIAGRAMS.md, sync `.mmd` และ render SVG ใหม่ พร้อมตรวจภาพจริง ห้ามแก้ SVG อย่างเดียวจนต่างจาก source Diagram ชุดนี้ไม่ใช่หลักฐานว่า authenticated production flows หรือ physical QR scan ผ่านแล้ว
