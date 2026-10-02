# System diagrams

แผนภาพตรงกับ implementation: shared workspace ไม่มี authentication, Backend หนึ่ง service พร้อมฐานข้อมูล PostgreSQL

## DFD Level 0

แสดง process หลัก ข้อมูลเข้าออก external entities และ data stores โดย QR preview ไม่สร้าง Click Event

```mermaid
flowchart LR
    U["ผู้สร้างลิงก์ / ผู้ตรวจงาน"]
    V["ผู้เปิดลิงก์ / ผู้สแกน QR"]
    P1(("1.0 สร้าง Short URL"))
    P2(("2.0 เปิดลิงก์และบันทึกการเปิด"))
    P3(("3.0 สร้าง QR Code"))
    P4(("4.0 ประวัติและสถิติ"))
    D1[("D1: Links")]
    D2[("D2: Click Events")]
    U -->|"URL ต้นฉบับ, ชื่อ, alias, วันหมดอายุ"| P1
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
    U -->|"คำค้นและเลขหน้า / ขอข้อมูลสถิติ"| P4
    D1 -->|"รายการและสถานะลิงก์"| P4
    D2 -->|"จำนวนเปิดและวันที่เปิด"| P4
    P4 -->|"ประวัติ / สถิติ / กราฟรายวัน"| U
```

บางตำราเรียก context diagram ว่า Level 0 และ decomposition ว่า Level 1 จึงแนบ context view ไว้เพิ่มเติมเพื่อให้ตรวจได้ทั้งสอง convention

```mermaid
flowchart LR
    Creator["ผู้สร้างลิงก์ / ผู้ตรวจงาน"] -->|"URL, ตัวเลือก, คำขอประวัติ/QR"| System(("0: Short URL System"))
    System -->|"Short URL, QR, ประวัติ, สถิติ, ข้อผิดพลาด"| Creator
    Visitor["ผู้เปิดลิงก์ / ผู้สแกน QR"] -->|"รหัส Short URL"| System
    System -->|"HTTP Redirect / ไม่พบ / หมดอายุ"| Visitor
```

## ER Diagram

```mermaid
erDiagram
    LINKS ||--o{ CLICK_EVENTS : "has"
    LINKS {
        bigint id PK "identity"
        varchar code UK "4–32 chars; random default 8"
        text original_url "max 2048 chars"
        varchar title "max 120 chars"
        timestamptz created_at "default NOW()"
        timestamptz expires_at "nullable"
    }
    CLICK_EVENTS {
        bigint id PK "identity"
        bigint link_id FK "ON DELETE CASCADE"
        timestamptz opened_at "default NOW()"
    }
```

หนึ่งลิงก์มี event ตั้งแต่ 0 ถึงหลายรายการ จำนวนเปิดคำนวณจาก COUNT ของ event ไม่มี IP/user-agent และไม่มี user table เพราะเป็น shared demo

Indexes: unique `links.code`, `links(created_at DESC, id DESC)`, `click_events(link_id)`, `click_events(opened_at)`

## Architecture Diagram

```mermaid
flowchart TB
    Browser["Browser / Phone camera"]
    Proxy["HTTPS host / trusted reverse proxy"]
    subgraph Service["หนึ่ง Node.js service · modular monolith"]
      Static["React + TypeScript UI (Vite build)"]
      Express["Express 5 + TypeScript"]
      API["API: validate / create / history / stats"]
      Redirect["Redirect: lookup / expiry / record / 302"]
      QR["QR encoder: PNG from public short URL"]
    end
    DB[("PostgreSQL: links + click_events")]
    Target["เว็บไซต์ปลายทาง"]
    Browser <-->|"HTTPS"| Proxy
    Proxy --> Express
    Express --> Static
    Express --> API
    Express --> Redirect
    Express --> QR
    API <-->|"parameterized SQL via pg pool"| DB
    Redirect <-->|"lookup + insert click event"| DB
    QR -->|"lookup link"| DB
    Redirect -->|"302 Location ผ่าน proxy"| Browser
    Browser -->|"ติดตาม Location"| Target
```

Backend ไม่ fetch เว็บไซต์ปลายทาง Browser เป็นผู้ตาม redirect ฐานข้อมูลเป็น persistent service แยกจากแอป Diagram นี้ไม่ใช่ microservice architecture

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
    alt missing or expired
      A-->>B: 404 or 410 (no click event)
    else active
      A->>D: INSERT click_events(link_id)
      D-->>A: Event stored
      A-->>B: 302 + Location + Cache-Control no-store
      B->>T: GET destination URL
    end
```
