# Link Studio — System diagrams

ตรวจเทียบ source code และ migrations 001–007 เมื่อ 2026-10-04: [System design](SYSTEM.md), [API](API.md), [Data dictionary](DATABASE.md) ระบบมี 9 application tables รวม private chat, QR cache, CSV export audit และ Preview views; Tags อยู่ใน links

Mermaid ด้านล่างเปิดดูได้บน GitHub; source แยกอยู่ใน `docs/diagrams/*.mmd` สำหรับ export/นำเสนอ ทุก process เป็นฟังก์ชันภายใน service เดียว ไม่ใช่ microservice

ไฟล์ SVG สำหรับเปิดเต็มหน้าและ zoom: [Context](diagrams/context.svg), [DFD Level 0](diagrams/dfd-level-0.svg), [ER](diagrams/er.svg), [Architecture](diagrams/architecture.svg), [Create sequence](diagrams/create-sequence.svg), [Redirect sequence](diagrams/redirect-sequence.svg), [Auth sequence](diagrams/auth-sequence.svg). DFD รวมมีข้อมูลหลาย flow ควรเปิด SVG เต็มหน้าควบคู่ตาราง mapping; SVG เป็น snapshot ต้อง render ใหม่เมื่อแก้ Mermaid source

## Context diagram

แสดงขอบเขตทั้งระบบโดยไม่มี data store บางตำราเรียก context นี้ Level 0 จึงแนบคู่กับ DFD ที่แตก process หลักด้านล่าง

```mermaid
flowchart LR
  U["สมาชิก / ผู้ตรวจงาน"] -->|"credentials, profile, link metadata, filters, question"| S(("0: Link Studio"))
  S -->|"session, My links, statistics, CSV, QR, answer / errors"| U
  V["ผู้รับลิงก์ / ผู้สแกน QR"] -->|"code / Preview / QR request"| S
  S -->|"metadata / PNG / 302 Location / unavailable"| V
  S -->|"question + guide + optional owned aggregate; server key"| AI["OpenAI Responses API (optional)"]
  AI -->|"answer / provider failure"| S
```

เว็บไซต์ปลายทางไม่ใช่ provider ที่ backend ส่ง request ไป ระบบส่ง Location ให้ browser แล้ว browser จึงติดต่อเว็บไซต์เอง

## DFD Level 0

แสดง external entities, numbered processes, data stores และ named data flows ครบฟังก์ชันหลักและฟีเจอร์ปัจจุบัน D1–D9 เป็นตารางใน PostgreSQL เดียวกัน ลูกศร store→process เป็นข้อมูลที่อ่าน และ process→store เป็นข้อมูลที่เขียน ไม่ใช่ลำดับเวลา

```mermaid
flowchart TB
  U["สมาชิก / ผู้ตรวจงาน"]
  V["ผู้รับลิงก์ / ผู้สแกน QR"]
  AI["OpenAI Responses API (optional)"]
  P1(("1.0 Authentication / Profile"))
  P2(("2.0 Create Short URL"))
  P3(("3.0 Edit / enable-disable / private Tags"))
  P4(("4.0 Preview destination"))
  P5(("5.0 Resolve / record open / redirect"))
  P6(("6.0 Generate / download QR"))
  P7(("7.0 My links / search / Analytics"))
  P8(("8.0 Export owned CSV"))
  P9(("9.0 AI assistance"))
  D1[("D1 users")]
  D2[("D2 sessions")]
  D3[("D3 links")]
  D4[("D4 click_events")]
  U -->|"register/login/logout, name/photo/password, cookie + CSRF"| P1
  D1 -->|"password hash / profile"| P1
  P1 -->|"new account / updated name, normalized photo, password hash"| D1
  D2 -->|"session / absolute expiry / CSRF state"| P1
  P1 -->|"new/rotated/revoked sessions"| D2
  P1 -->|"user, cookie, CSRF token / auth error"| U
  P1 -->|"verified session owner + write protection"| P2
  P1 -->|"verified session owner + write protection"| P3
  P1 -->|"verified session owner"| P7
  P1 -->|"verified session owner"| P8
  P1 -->|"verified session owner + write protection"| P9
  U -->|"HTTP/HTTPS URL, title, alias, Tags, expiry choice"| P2
  P2 -->|"validated code/destination/owner/UTC expiry/private Tags"| D3
  D3 -->|"unique code conflict / stored link"| P2
  P2 -->|"Short URL / input or conflict error"| U
  U -->|"code + title/originalUrl/Tags OR explicit isActive"| P3
  D3 -->|"owned link / existing attributes"| P3
  P3 -->|"owner-filtered metadata or status update"| D3
  P3 -->|"saved Link / validation or not-found error"| U
  V -->|"Preview code / refresh / status recheck"| P4
  D3 -->|"title, stored URL, expiry, is_active; no private Tags"| P4
  P4 -->|"hostname/full URL/status / missing; no click event"| V
  V -->|"GET or HEAD code from Short URL, QR or Continue"| P5
  D3 -->|"latest destination / availability under row lock"| P5
  P5 -->|"link_id + database time; qualifying GET only"| D4
  P5 -->|"302 Location after commit / 404 / 410 / safe failure"| V
  U -->|"existing link code / download choice"| P6
  V -->|"existing link code / download choice"| P6
  D3 -->|"existing code"| P6
  P6 -->|"PNG encoding public Short URL; no click event"| U
  P6 -->|"PNG encoding public Short URL; no click event"| V
  U -->|"q, single Tag, page / owned totals request"| P7
  D3 -->|"owned history, private Tags, active/total link counts"| P7
  D4 -->|"owned event counts / UTC daily totals"| P7
  P7 -->|"My links / tag choices / UTC statistics"| U
  U -->|"q + single Tag; all matching pages"| P8
  D3 -->|"owned matching rows / status / UTC dates"| P8
  D4 -->|"matching link event counts"| P8
  P8 -->|"UTF-8 BOM CSV / validation or >10000 error; no click event"| U
  U -->|"question / recent conversation / optional stats consent"| P9
  D3 -->|"own aggregate link totals only when opted in"| P9
  D4 -->|"own aggregate opens only when opted in"| P9
  P9 -->|"guide + conversation + optional aggregate; store:false"| AI
  AI -->|"plain-text answer / failure"| P9
  P9 -->|"answer / sanitized error; saved chat / no link mutation or click events"| U
  D7[("D7 qr_codes")]
  D9[("D9 preview_events")]
  P6 -->|"Short URL payload + PNG cache"| D7
  D7 -->|"cached PNG for current public base URL"| P6
  P4 -->|"successful metadata GET + status; no IP"| D9
  D5[("D5 chat_conversations")]
  D6[("D6 chat_messages")]
  D8[("D8 csv_exports")]
  P8 -->|"owner + filters + filename + row count"| D8
  P9 -->|"successful question-answer pair / delete owned chat"| D6
  D6 -->|"owned stored recent messages"| P9
  P9 -->|"new conversation / updated time / delete owned chat"| D5
  D5 -->|"own recent conversations / verified ownership"| P9
```

### Process → implementation mapping

| Process | Routes / files | Store effect |
|---|---|---|
| 1.0 | /api/auth/*; auth.ts / avatar.ts | users + sessions read/write; password change revokes all own sessions |
| 2.0 | POST /api/links; app.ts | INSERT links |
| 3.0 | PATCH /api/links/:code and /status; app.ts / tags.ts | UPDATE owned links only |
| 4.0 | /preview/:code and /api/links/:code/preview | read links only |
| 5.0 | GET/HEAD /:code | read links; successful GET INSERT click_events |
| 6.0 | GET /api/links/:code/qr | read links, generate PNG in memory |
| 7.0 | GET /api/links, /api/tags, /api/stats | owner-scoped reads; stats ignore q/tag filters |
| 8.0 | GET /api/links/export.csv; csv.ts | owner-scoped reads, no persisted export |
| 9.0 | /api/assistant/status and /chat; assistant.ts | optional aggregate reads, external API, owned chat_conversations/chat_messages |

Public processes 4–6 do not require Login. Private processes use identity from server session; no supplied owner_id can select another owner. Legacy ownerless links still work publicly. Redirect is the only business flow that writes click_events; session bootstrap may write sessions independently.

### DFD views สำหรับนำเสนอ

ใช้ process/data-flow เดียวกับ DFD รวม แยกภาพเพื่อลดเส้นไขว้ ไม่ใช่ processes ใหม่หรือ Level 1 decomposition; entity/store ที่ซ้ำหมายถึง entity/store เดียวกันในระบบ:

- [1.0–3.0 บัญชี / Profile / สร้างและจัดการลิงก์](diagrams/dfd-account-links.svg) · [Mermaid source](diagrams/dfd-account-links.mmd)
- [4.0–6.0 Preview / Redirect / QR สาธารณะ](diagrams/dfd-public-links.svg) · [Mermaid source](diagrams/dfd-public-links.mmd)
- [7.0–9.0 My links / Analytics / CSV / AI](diagrams/dfd-reports-ai.svg) · [Mermaid source](diagrams/dfd-reports-ai.mmd)

ภาพรายงานแสดงเฉพาะ business data flows; verified identity ของ 1.0 → 7.0/8.0/9.0 ดูในภาพรวมและ mapping ทุก private endpoint ยังต้อง Login ตาม API.md

## ER Diagram

```mermaid
erDiagram
  USERS o|..o{ LINKS : owns_nullable_legacy
  LINKS ||..o{ CLICK_EVENTS : records
  USERS {
    bigint id PK "generated always identity"
    varchar254 email UK "NOT NULL"
    text password_hash "NOT NULL; bcrypt cost12"
    timestamptz created_at "NOT NULL; NOW()"
    varchar80 display_name "NOT NULL; default empty"
    bytea avatar_image "nullable; WebP <=262144 bytes"
    uuid avatar_version "nullable; paired with image"
  }
  LINKS {
    bigint id PK "generated always identity"
    varchar32 code UK "NOT NULL; regex4-32; random8"
    text original_url "NOT NULL; length1-2048"
    varchar120 title "NOT NULL; default empty"
    timestamptz created_at "NOT NULL; NOW()"
    timestamptz expires_at "nullable; NULL means never"
    bigint owner_id FK "nullable; ON DELETE SET NULL"
    boolean is_active "NOT NULL; default true"
    text_array tags "NOT NULL; default empty; private"
  }
  CLICK_EVENTS {
    bigint id PK "generated always identity"
    bigint link_id FK "NOT NULL; ON DELETE CASCADE"
    timestamptz opened_at "NOT NULL; NOW()"
  }
  SESSIONS {
    varchar sid PK "unbounded varchar"
    json sess "NOT NULL; user ID / CSRF / authExpiresAt / cookie"
    timestamp6 expire "NOT NULL; WITHOUT TIME ZONE"
  }
  USERS ||..o{ CHAT_CONVERSATIONS : owns
  CHAT_CONVERSATIONS ||..o{ CHAT_MESSAGES : contains
  LINKS ||..o{ QR_CODES : caches
  USERS ||..o{ CSV_EXPORTS : exports
  LINKS ||..o{ PREVIEW_EVENTS : viewed
  CHAT_CONVERSATIONS {
    bigint id PK
    bigint owner_id FK "NOT NULL; CASCADE"
    varchar80 title "NOT NULL"
    boolean include_stats "NOT NULL; default false"
    timestamptz created_at "NOT NULL; NOW()"
    timestamptz updated_at "NOT NULL; NOW()"
  }
  CHAT_MESSAGES {
    bigint id PK
    bigint conversation_id FK "NOT NULL; CASCADE"
    varchar9 role "user or assistant"
    text content "1-12000 characters"
    timestamptz created_at "NOT NULL; NOW()"
  }
  QR_CODES {
    bigint id PK
    bigint link_id FK "NOT NULL; CASCADE"
    text payload "UNIQUE with link_id"
    bytea png "NOT NULL"
    timestamptz created_at "NOT NULL; NOW()"
  }
  CSV_EXPORTS {
    bigint id PK
    bigint owner_id FK "NOT NULL; CASCADE"
    varchar120 search "NOT NULL; default empty"
    varchar32 tag "nullable"
    integer row_count "0-10000"
    varchar64 filename "NOT NULL"
    timestamptz created_at "NOT NULL; NOW()"
  }
  PREVIEW_EVENTS {
    bigint id PK
    bigint link_id FK "NOT NULL; CASCADE"
    varchar8 status "active disabled expired"
    timestamptz viewed_at "NOT NULL; NOW()"
  }
```

ER type labels varchar254/varchar80/varchar120/varchar32/timestamp6/text_array หมายถึง PostgreSQL VARCHAR(254)/(80)/(120)/(32), TIMESTAMP(6) และ TEXT[] ตาม [Data Dictionary](DATABASE.md) ไม่ใช่ custom database types

หนึ่ง user มี0..N links; link มี0..1 owner; event ต้องมีหนึ่ง link Sessions แยกใน ER เพราะ user ID เก็บใน JSON ไม่มี foreign key จริงและมี anonymous sessions ได้ ไม่วาด FK ปลอม ไม่มี column short_url/clicks/status/hostname: คำนวณจาก config, COUNT(events), URL parser และสถานะล่าสุด

Indexes/constraints/nullability/migrations ทั้งหมดอยู่ใน DATABASE.md เวลา links/users/events ใช้ TIMESTAMPTZ; session expire เป็น TIMESTAMP(6) without time zone ของ connect-pg-simple ไม่มีตาราง Tags แยก ไม่มี Supabase auth.users/Storage buckets ใน implementation นี้

## Architecture Diagram

```mermaid
flowchart TB
  B["Browser / phone: React19 + TypeScript"]
  subgraph R["Render Free · one Node22 Web Service"]
    H["HTTPS reverse proxy"]
    E["Express5 + TypeScript"]
    S["Static Vite production build"]
    A["Passport Local / bcrypt / PG sessions / CSRF"]
    M["Owner APIs: links / Tags / stats / CSV / Profile"]
    P["Public Preview / QR"]
    X["Public redirect transaction / event / 302"]
    C["AI assistant: bounded authenticated request"]
    START["start-render.mjs: derive origin / additive migrations / start"]
  end
  D[("Supabase PostgreSQL: 9 tables: accounts, links, clicks, chat, QR, CSV audit, Preview")]
  AI["OpenAI Responses API · optional server-only key"]
  T["Destination website"]
  B <-->|"HTTPS same origin"| H
  H --> E
  START --> E
  START -->|"migrations001-007"| D
  E --> S
  S -->|"HTML / JS / CSS"| B
  E --> A
  E --> M
  E --> P
  E --> X
  E --> C
  A <-->|"users / sessions; verified TLS via pg"| D
  A -->|"session owner / CSRF for writes"| M
  A -->|"session owner / CSRF"| C
  M <-->|"parameterized SQL; owner scope"| D
  P -->|"read stored link / QR cache / Preview events; no target fetch"| D
  X <-->|"row lock / status check / event commit"| D
  C -->|"owned chat persistence / opt-in aggregate reads"| D
  C <-->|"HTTPS conversation / answer; store:false"| AI
  X -->|"302 Location via response"| B
  B -->|"follow Location; query / fragment preserved"| T
```

หนึ่ง modular monolith + persistent database แยก ไม่ใช่ microservices Production ใช้ origin เดียวจึงไม่ต้อง general CORS; browser ไม่เชื่อม DB โดยตรง Supabase ใช้เฉพาะ PostgreSQL Session pooler verified TLS ไม่ใช้ Supabase Auth/Data API/Storage รูปเก็บใน DB, QR/CSV สร้างเมื่อขอ ไม่เก็บไฟล์ใน Render disk

## Sequence: Create / QR / history

```mermaid
sequenceDiagram
  participant B as Member browser
  participant A as Express
  participant D as PostgreSQL
  B->>A: POST /api/links + cookie + CSRF (URL/title/tags/expiry)
  A->>A: Validate session/origin/body, compute backend create time/expiry
  A->>D: INSERT link with session owner and unique code
  alt unique conflict
    D-->>A: 23505
    A->>A: Random code retry max5, explicit alias returns409
  else created
    D-->>A: Stored link
    A-->>B: 201 Link with public Short URL
    B->>A: GET /api/links/:code/qr?download=1
    A->>D: Read existing code and QR cache for current payload
    A->>D: Insert PNG cache on GET cache miss (unique link/payload)
    A-->>B: PNG containing /:code (no click event)
    B->>A: GET /api/links + GET /api/stats
    A->>D: Read owner rows + COUNT events
    A-->>B: My links / real UTC statistics
  end
```

## Sequence: Preview / Redirect / events

```mermaid
sequenceDiagram
  participant B as Recipient browser
  participant A as Express
  participant D as PostgreSQL
  participant T as Destination website
  B->>A: GET /preview/:code + /api/links/:code/preview
  A->>D: Read destination/title/expiry/is_active
  A->>D: INSERT preview_events for metadata GET, not HEAD
  A-->>B: Public Preview/status, no click event / no target fetch
  Note over B: No auto redirect on React render or refresh
  B->>A: Continue: GET preview metadata again
  A->>D: Read current status for feedback
  A->>D: INSERT preview_events for status recheck GET
  A-->>B: Metadata, unavailable remains on Preview
  B->>A: If active: GET /:code (also direct Short URL/QR flow)
  A->>D: BEGIN, SELECT current link FOR SHARE
  alt missing or disabled or expires_at <= now
    A->>D: ROLLBACK
    A-->>B: 404 or410, no Location / event
  else valid active HTTP/HTTPS
    A->>D: INSERT click_events(link_id), COMMIT
    D-->>A: Committed event
    A-->>B: 302 Location: latest stored URL, no-store
    B->>T: Follow destination URL
  end
  Note over A,D: Event/DB failure rolls back, safe500, no redirect
  Note over A,D: HEAD checks same availability without inserting event
  Note over A,D: Owner PATCH waits for same row lock, prior committed opens remain
```

Disabled precedence over Expired over Active; enable never clears expiry. Old QR/short code stays unchanged after edits/status updates but old PNG containing localhost requires downloading a fresh production QR. Query sent to Short URL cannot override stored destination.

## Sequence: Login / private APIs / Logout

```mermaid
sequenceDiagram
  participant B as Member browser
  participant A as Express / Passport
  participant D as PostgreSQL
  B->>A: GET /api/auth/session
  A->>D: Create/read bootstrap session and CSRF state
  A-->>B: Cookie + csrfToken + user or null
  B->>A: POST login/register + cookie + CSRF
  A->>D: Read hash / insert new bcrypt user
  A->>A: Verify credentials, regenerate SID and CSRF, absolute expiry
  A->>D: Save authenticated session
  A-->>B: User + renewed token + cookie
  B->>A: Private history/stats/CSV OR owner write + CSRF
  A->>D: Session validation + owner-filtered SQL
  A-->>B: Own data /401 /403 /404
  B->>A: POST logout + cookie + CSRF
  A->>D: Destroy current session
  A-->>B: 204, clear cookie
  Note over A,D: Password change locks user, updates hash, deletes all own sessions
```

## Verification boundary

Diagram ตรวจจาก source และ migrations ไม่ได้ยืนยัน production schema ทุก column ด้วย information_schema ไม่ใช่ผล penetration test Online build/migration/health/cookie flags/Login UI ตรวจแล้ว; authenticated live flows, phone QR scan และ CI run ยังต้องตรวจตาม TESTING.md / RENDER.md
