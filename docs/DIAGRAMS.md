# System diagrams

แผนภาพตรงกับ implementation: Login/My links พร้อม ownership ที่ backend; Short URL/Preview/QR ยังสาธารณะ, Backend หนึ่ง service พร้อมฐานข้อมูล PostgreSQL

## DFD Level 0

แสดง process หลัก ข้อมูลเข้าออก external entities และ data stores โดยหน้า Preview และการสร้าง/ดาวน์โหลด QR ไม่สร้าง Click Event

```mermaid
flowchart LR
    U["ผู้สร้างลิงก์ / ผู้ตรวจงาน"]
    V["ผู้เปิดลิงก์ / ผู้สแกน QR"]
    P1(("1.0 สร้าง Short URL"))
    P2(("2.0 เปิดลิงก์และบันทึกการเปิด"))
    P3(("3.0 สร้าง QR Code"))
    P4(("4.0 ประวัติและสถิติ"))
    P5(("5.0 Preview ปลายทาง"))
    P6(("6.0 Register / Login / Logout / Profile / CSRF"))
    P7(("7.0 Owner link status"))
    P8(("8.0 AI assistant: session + CSRF"))
    AI["OpenAI Responses API"]
    D1[("D1: Links")]
    D2[("D2: Click Events")]
    D3[("D3: Users password hashes / private profile photo")]
    D4[("D4: Server sessions")]
    U -->|"email/password, display name, photo หรือ cookie + CSRF"| P6
    P6 <-->|"hash/compare + current user profile"| D3
    P6 <-->|"สร้าง / ตรวจ expiry / revoke"| D4
    P6 -->|"authenticated owner identity"| P1
    P6 -->|"authenticated owner identity"| P4
    P6 -->|"session owner + CSRF"| P7
    P6 -->|"session owner + CSRF"| P8
    U -->|"question / recent conversation / optional stats consent"| P8
    D1 -->|"owned aggregate totals only when opted in"| P8
    D2 -->|"owned open counts only when opted in; read only"| P8
    P8 -->|"curated guide + conversation + optional own totals; store:false"| AI
    AI -->|"plain text response / safe error"| P8
    P8 -->|"answer or unavailable/limit error; no mutations/events"| U
    U -->|"code + explicit isActive true/false"| P7
    P7 <-->|"UPDATE only code + owner_id; preserve expiry/events"| D1
    P7 -->|"confirmed status / auth or not-found error"| U
    P6 -->|"cookie / token / own profile / error"| U
    U -->|"URL ต้นฉบับ, ชื่อ, alias, expiryPreset หรือ custom expiresAt"| P1
    P1 -->|"ข้อมูลลิงก์ที่ตรวจสอบแล้ว"| D1
    D1 -->|"รหัสซ้ำ / ข้อมูลลิงก์"| P1
    P1 -->|"Short URL / validation error"| U
    V -->|"GET code จากลิงก์หรือ QR"| P2
    D1 -->|"URL ต้นฉบับและวันหมดอายุ"| P2
    P2 -->|"link_id และเวลาเปิด"| D2
    P2 -->|"302 + Location / 404 / 410"| V
    U -->|"รหัสลิงก์ที่ต้องการ QR"| P3
    D1 -->|"รหัสลิงก์ที่มีอยู่"| P3
    P3 -->|"PNG เข้ารหัส Short URL"| U
    U -->|"คำค้นและเลขหน้า / ขอข้อมูลสถิติ / export CSV ทุกหน้า"| P4
    D1 -->|"รายการและสถานะลิงก์"| P4
    D2 -->|"จำนวนเปิดและวันที่เปิด"| P4
    P4 -->|"My links / owner stats / private CSV หรือ limit error"| U
    V -->|"ขอดู Preview ตาม code"| P5
    D1 -->|"URL, ชื่อ และวันหมดอายุ"| P5
    P5 -->|"โดเมน / URL เต็ม / สถานะ"| V
```

## Sequence: Preview แบบเลือกใช้

```mermaid
sequenceDiagram
    participant B as Browser / React
    participant A as Express
    participant D as PostgreSQL
    participant T as Target website
    B->>A: GET /preview/:code + GET /api/links/:code/preview
    A->>D: SELECT stored destination, expiry and is_active
    D-->>A: Metadata or missing
    A-->>B: Preview UI + metadata (no event)
    Note over B: Render/refresh does not navigate to target
    B->>A: User presses Continue: GET /api/links/:code/preview (no event)
    A->>D: Re-read metadata for immediate disabled/expired feedback
    A-->>B: Current status; stay on Preview if unavailable
    B->>A: Only active: GET /:code
    A->>D: BEGIN + SELECT current link FOR SHARE: expiry/is_active
    alt missing / disabled / expired / invalid stored destination
      A-->>B: 404 / 410 / generic 500 (no event)
    else active HTTP/HTTPS destination
      A->>D: INSERT click_events(link_id)
      D-->>A: Event stored + COMMIT
      A-->>B: 302 Location: saved destination
      B->>T: Follow redirect with original query/fragment
    end
    Note over A,D: HEAD validates availability without inserting an event
    Note over A,D: PATCH status serializes on same row; disabled precedes expiry
```

Short URL และ QR เดิมยังใช้ `/:code` โดยตรง หน้า `/preview/:code` เป็นทางเลือกสำหรับแชร์ก่อนเปิด เว็บไซต์ปลายทางไม่ถูกเรียกจาก backend และ ER Diagram ไม่เปลี่ยน

บางตำราเรียก context diagram ว่า Level 0 และ decomposition ว่า Level 1 จึงแนบ context view ไว้เพิ่มเติมเพื่อให้ตรวจได้ทั้งสอง convention

```mermaid
flowchart LR
    Creator["ผู้สร้างลิงก์ / ผู้ตรวจงาน"] -->|"URL, ตัวเลือก, คำขอประวัติ/QR/Preview"| System(("0: Short URL System"))
    System -->|"Short URL, QR, ประวัติ, สถิติ, ข้อผิดพลาด"| Creator
    Visitor["ผู้เปิดลิงก์ / ผู้สแกน QR"] -->|"รหัส Short URL"| System
    System -->|"Preview / HTTP Redirect / ไม่พบ / หมดอายุ"| Visitor
```

## ER Diagram

```mermaid
erDiagram
    USERS o|--o{ LINKS : "owns nullable legacy"
    LINKS ||--o{ CLICK_EVENTS : "has"
    LINKS {
        bigint id PK "identity"
        varchar code UK "4–32 chars; random default 8"
        text original_url "max 2048 chars"
        varchar title "max 120 chars"
        timestamptz created_at "default NOW()"
        timestamptz expires_at "nullable"
        bigint owner_id FK "ON DELETE SET NULL"
        boolean is_active "NOT NULL DEFAULT TRUE"
    }
    CLICK_EVENTS {
        bigint id PK "identity"
        bigint link_id FK "ON DELETE CASCADE"
        timestamptz opened_at "default NOW()"
    }
    USERS {
        bigint id PK
        varchar email UK
        text password_hash "bcrypt cost 12"
        varchar display_name "default empty; max 80"
        bytea avatar_image "nullable normalized WebP; max 256 KiB"
        uuid avatar_version "nullable image version"
        timestamptz created_at
    }
    SESSIONS {
        varchar sid PK
        json sess "Passport user ID / CSRF / absolute expiry / cookie"
        timestamp expire
    }
```

หนึ่งลิงก์มี 0..N events; ownership nullable สำหรับ legacy ไม่มี claim endpoint Sessions เก็บ user ID ใน JSON ตาม Passport ไม่ใช่ FK ไม่มี password/hash ใน cookie ไม่เก็บ IP/user-agent

Expiry preset ไม่เพิ่มตาราง/column: backend คำนวณ `created_at` และ `expires_at` จาก clock เดียวกันทันทีที่สร้าง (1h/1d/7d) หรือรับ custom ISO timestamp ที่อยู่ในอนาคต เก็บเป็น `TIMESTAMPTZ`; none เป็น NULL ก่อน Redirect ตรวจ `expires_at <= now` แล้วตอบ 410 โดยไม่มี event

Indexes: unique `links.code`, `links(created_at DESC, id DESC)`, `click_events(link_id)`, `click_events(opened_at)`

## Architecture Diagram

```mermaid
flowchart TB
    Browser["Browser / Phone camera"]
    Proxy["HTTPS host / trusted reverse proxy"]
    subgraph Service["หนึ่ง Node.js service · modular monolith"]
      Static["React + TypeScript UI (Vite build)"]
      Express["Express 5 + TypeScript"]
      API["API: owner-scoped create / history / stats / CSV"]
      Auth["Passport Local + bcrypt + PG sessions + CSRF"]
      Redirect["Redirect: lookup / expiry / record / 302"]
      QR["QR encoder: PNG from public short URL"]
      Preview["Preview: stored destination and status; no click event"]
      Assistant["AI assistant: private session/CSRF + bounded request"]
    end
    DB[("PostgreSQL: links + click_events + users + sessions")]
    Target["เว็บไซต์ปลายทาง"]
    AI["OpenAI Responses API: optional server key"]
    Browser <-->|"HTTPS"| Proxy
    Proxy --> Express
    Express --> Static
    Express --> API
    Express --> Auth
    Auth <-->|"users / sessions"| DB
    Auth -->|"session owner for private APIs"| API
    Express --> Redirect
    Express --> QR
    Express --> Preview
    Express --> Assistant
    Auth -->|"authenticated owner"| Assistant
    Assistant -->|"read own aggregate totals only with consent"| DB
    Assistant <-->|"HTTPS conversation / answer; key stays on server"| AI
    API <-->|"parameterized SQL via pg pool"| DB
    Redirect <-->|"lookup + insert click event"| DB
    QR -->|"lookup link"| DB
    Preview -->|"read stored metadata only"| DB
    Redirect -->|"302 Location ผ่าน proxy"| Browser
    Browser -->|"ติดตาม Location"| Target
```

Backend ไม่ fetch เว็บไซต์ปลายทาง Browser เป็นผู้ตาม redirect ฐานข้อมูลเป็น persistent service แยกจากแอป Diagram นี้ไม่ใช่ microservice architecture

Preview อ่าน Links เท่านั้นและไม่เขียน Click Events; ผู้รับกด Continue จึงเรียก flow redirect เดิม หน้า Preview ไม่ใช่การตรวจ phishing หรือการรับรองเว็บไซต์ปลอดภัย ER schema ไม่เปลี่ยน

## Sequence: การเปิดลิงก์

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as Express
    participant D as PostgreSQL
    participant T as Target website
    B->>A: GET /code
    A->>D: SELECT original_url, expires_at WHERE code=$1
    D-->>A: Link data
    alt missing, disabled or expired
      A-->>B: 404 or 410 (no click event)
    else active
      A->>D: INSERT click_events(link_id)
      D-->>A: Event stored + COMMIT
      A-->>B: 302 + Location + Cache-Control no-store
      B->>T: GET destination URL
    end
```

### Link status migration

`004_link_status.sql` adds links.is_active=true for old rows, including ownerless links. Owners PATCH explicit target state; no click events or expiry are rewritten. Disabled is displayed before Expired, then Active. Public QR keeps the same short URL; public Preview metadata indicates unavailable and GET/HEAD redirect returns 410 without Location/event. Redirect holds a share row lock through validation/event commit so status updates are serialized.
