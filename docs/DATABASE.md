# PostgreSQL schema / Data Dictionary

Source of truth: `backend/migrations/001_initial.sql` ถึง `006_link_tags.sql` และ SQL ใน `backend/src/{app,auth,assistant}.ts` ตรวจเมื่อ 2026-10-04 ดู [ER Diagram](DIAGRAMS.md#er-diagram)

มี **4 ตาราง application** ใน public schema: users, sessions, links, click_events ไม่มี tags, QR, statistics หรือ chat table และไม่มี migration-history table; migrator อ่านไฟล์ 001–006 ทุกครั้งใน transaction เดียว ใช้ advisory transaction lock 735119 และ additive/idempotent DDL

## users — สมาชิกและ Profile

| Column | PostgreSQL type | Null/default / constraint | หน้าที่ |
|---|---|---|---|
| id | bigint | NOT NULL; generated always identity; PK | user ID |
| email | varchar(254) | NOT NULL; UNIQUE | identifier; API normalize lowercase |
| password_hash | text | NOT NULL | bcrypt hash cost 12; ไม่ใช่ plaintext |
| created_at | timestamptz | NOT NULL; NOW() | เวลาสมัคร |
| display_name | varchar(80) | NOT NULL; default '' | ชื่อ; API 1–80 trimmed เมื่อส่งมา |
| avatar_image | bytea | nullable | normalized 256×256 WebP |
| avatar_version | uuid | nullable | สุ่ม version เมื่อเปลี่ยนรูป ใช้ refresh URL |

CHECK users_avatar_bounds: image/version ต้อง NULL คู่กันหรือมีค่าคู่กัน และ image <=262144 bytes; upload API เพิ่มการตรวจ JPEG/PNG/WebP ภาพนิ่ง <=2 MiB และ <=16,777,216 pixels ผ่าน Sharp

## sessions — server-side session

| Column | PostgreSQL type | Null/default / constraint | หน้าที่ |
|---|---|---|---|
| sid | varchar (ไม่กำหนด length) | PK / NOT NULL | session ID; cookie เก็บ signed SID |
| sess | json | NOT NULL | Passport user ID, CSRF, cookie และ authExpiresAt |
| expire | timestamp(6) without time zone | NOT NULL | expiration ของ connect-pg-simple |

ไม่มี FK ไป users: `sess.passport.user` เป็น user ID ใน JSON การเพิกถอนทุก session หลังเปลี่ยนรหัสใช้ JSON path นี้ มี anonymous CSRF bootstrap sessions ได้ด้วย จึงไม่วาด relational FK ที่ไม่มีจริง การ Login ใช้ absolute authExpiresAt (epoch milliseconds) ส่วน connect-pg-simple ดูแล expire; อย่าอธิบายว่า expire เป็น TIMESTAMPTZ

## links — Short URL และ private metadata

| Column | PostgreSQL type | Null/default / constraint | หน้าที่ |
|---|---|---|---|
| id | bigint | NOT NULL; generated always identity; PK | internal link ID |
| code | varchar(32) | NOT NULL; UNIQUE; regex ^[A-Za-z0-9_-]{4,32}$ | random 8 ตัว หรือ alias |
| original_url | text | NOT NULL; char_length 1–2048 | normalized URL.href; HTTP/HTTPS ตรวจที่ API |
| title | varchar(120) | NOT NULL; default '' | ชื่อ; มองเห็นผ่าน public Preview |
| created_at | timestamptz | NOT NULL; NOW() | create API ส่ง backend creation timestamp |
| expires_at | timestamptz | nullable | NULL=ไม่หมดอายุ |
| owner_id | bigint | nullable; FK users.id ON DELETE SET NULL | เจ้าของ; NULL สำหรับ legacy |
| is_active | boolean | NOT NULL; default true | เจ้าของเปิด/ปิด |
| tags | text[] | NOT NULL; default '{}' | private tags; normalize/max8/max32 ตรวจที่ API |

Short URL, previewUrl, hostname, status และ clicks เป็น derived values ไม่ใช่ columns expiryPreset ไม่เก็บเป็น column; backend แปลงระยะจาก created_at เป็น expires_at ไม่มี updated_at/edit audit log หรือ persisted click counter

## click_events — เหตุการณ์เปิด

| Column | PostgreSQL type | Null/default / constraint | หน้าที่ |
|---|---|---|---|
| id | bigint | NOT NULL; generated always identity; PK | event ID |
| link_id | bigint | NOT NULL; FK links.id ON DELETE CASCADE | ลิงก์ที่เปิด |
| opened_at | timestamptz | NOT NULL; NOW() | เวลา insert จาก PostgreSQL |

ไม่มี IP, user-agent, referrer, device หรือ country เปิดพร้อมกันใช้ INSERT events แยก ไม่ใช่ read-modify-write counter SQL COUNT เป็น source of truth; COUNT(bigint) จาก pg เป็น decimal string, CSV รักษา digits ส่วน JSON/UI แปลง Number

## Relationships และ indexes

- users 1 คนมี 0..N links; link มี 0..1 owner. ON DELETE SET NULL เป็น database rule ไม่ใช่ฟีเจอร์ลบบัญชีใน UI
- links 1 รายการมี 0..N events; event ต้องมี 1 link. ON DELETE CASCADE เป็น database rule ไม่มี delete-link endpoint
- sessions มีความสัมพันธ์เชิงตรรกะผ่าน JSON ไม่ใช่ relational FK

| Index | Columns / method |
|---|---|
| PK/UNIQUE อัตโนมัติ | users.id, users.email, sessions.sid, links.id, links.code, click_events.id |
| links_created_at_idx | created_at DESC, id DESC |
| links_owner_created_idx | owner_id, created_at DESC, id DESC |
| links_tags_idx | GIN(tags) |
| click_events_link_id_idx | link_id |
| click_events_opened_at_idx | opened_at |
| sessions_expire_idx | expire |

## เวลา สิทธิ์ และ migrations

API ส่ง timestamptz เป็น ISO 8601 UTC (`Z`); PostgreSQL เก็บ instant และ display ตาม session timezone ไม่เก็บ timezone label ของผู้สร้าง UI แสดง local timezone; CSV และ daily analytics ใช้ UTC sessions.expire เป็นข้อยกเว้น type ของ session store

Migration 002 เปิด RLS ทั้ง 4 ตารางโดยไม่มี client policies และ revoke PUBLIC บน users/sessions Backend ใช้ table-owner role และตรวจ owner เอง RLS ไม่แทน ownership filter ฝั่ง Express; browser ไม่ใช้ Supabase Data API อย่าอ้างว่า users คือ auth.users ของ Supabase

| Migration | ผล |
|---|---|
| 001_initial | links / click_events / lookup และ event indexes |
| 002_auth | users / sessions / owner_id nullable / owner index / RLS |
| 003_profile | display_name |
| 004_link_status | is_active default true |
| 005_avatar | avatar_image / avatar_version / paired-size CHECK |
| 006_link_tags | tags default empty / GIN index |

ไม่มีการลบข้อมูล startup migration รันครบแล้วบน Render ตาม deployment log; การตรวจนี้อ่านไฟล์ migrations/SQL ไม่ได้ query information_schema ของ Supabase เพื่อยืนยัน columns จริงทุกตัว ใช้ guarded local test DB เท่านั้นหากต้องการทดสอบ schema/reset
