# API reference — current implementation

ตรวจ route registration ใน `backend/src/app.ts`, `auth.ts`, `assistant.ts` เมื่อ 2026-10-04 Base production: https://synerry-link-studio.onrender.com ไม่มี bearer API, admin API, delete link หรือ per-link statistics endpoint แยก

## Session / CSRF

เริ่ม GET `/api/auth/session`, เก็บ cookie jar และ csrfToken แล้วส่ง `X-CSRF-Token` ทุก write รวม Login/Register ใช้ token ใหม่หลัง Login; Origin เมื่อมีต้องเท่ากับ AUTH_ORIGIN Anonymous/expired private request=401, CSRF/origin=403, private code ไม่พบ/ของคนอื่น/ownerless=404 แบบเดียวกัน

User JSON: `{id,email,displayName,avatarUrl}`; AuthSession: `{user: User|null,csrfToken:string|null,expiresAt:number|null}` (epoch ms). Profile/avatar writes ส่ง `{user}`; session/login/register ส่ง AuthSession

## ทุก endpoint ที่มีจริง

| Method / path | Access | Request / response |
|---|---|---|
| GET /api/health | public | 200 status=ok/database=connected; 503 unavailable/disconnected |
| GET /api/auth/session | public | bootstrap AuthSession |
| POST /api/auth/register | CSRF | email,password,displayName?; 200 auto-login; 400/409/429 |
| POST /api/auth/login | CSRF | email,password; 200 AuthSession; 400/401/429 |
| POST /api/auth/logout | session + CSRF | 204 revoke current server session / clear cookie |
| PATCH /api/auth/profile | session + CSRF | displayName only; 200 user |
| POST /api/auth/password | session + CSRF | currentPassword,newPassword; 204 revoke all own sessions; 400/429 |
| GET /api/auth/avatar | session | own WebP; 404 no image; query v for version; no user selector |
| PUT /api/auth/avatar | session + CSRF | raw JPEG/PNG/WebP body, matching Content-Type; 200 user; 400/413/415/429 |
| DELETE /api/auth/avatar | session + CSRF | 200 user; idempotent remove |
| POST /api/links | session + CSRF | create body below; 201 Link; 400/409/429/503 |
| GET /api/links | session | page=1,limit=10 (1–50),q='',tag?; `{items,total,page,limit}` |
| GET /api/tags | session | `{tags:string[]}` from own links sorted name |
| GET /api/links/export.csv | session | q/tag only; CSV all matching pages, max10,000; 400/413 |
| GET /api/stats | session | own totalLinks/activeLinks/totalClicks/todayClicks/daily/timezone=UTC; no q/tag filter |
| GET /api/links/:code | owner | Link details/counts/private tags |
| PATCH /api/links/:code | owner + CSRF | at least one title/originalUrl/tags; strict body; 200 Link; 400/429 |
| PATCH /api/links/:code/status | owner + CSRF | strict `{isActive:boolean}` target; 200 Link; 400 |
| GET /api/links/:code/preview | public | stored title/originalUrl/hostname/expiry/isActive/status/shortUrl/previewUrl; 200 even unavailable; 404 missing |
| GET /api/links/:code/qr | public | PNG; ?download=1 attachment; 404 missing; available for disabled/expired existing code |
| GET /preview/:code | public | React page HTTP 200 active,410 disabled/expired,404 missing; 503 if frontend build absent |
| GET /:code | public | validate current status + event commit then302; missing404,disabled/expired410; DB/stored URL failure500 |
| HEAD /:code | public | same availability/302 without event |
| GET /api/assistant/status | session | `{available:boolean,provider:'OpenAI'}`; key configured flag only, not provider connectivity/billing proof |
| POST /api/assistant/chat | session + CSRF | messages/includeStats; reply/provider/optional summary; 400/429/502/503/504 |

`/` serves React; workspace views use hashes `#overview`, `#create`, `#links`, `#analytics`, `#profile` rather than separate backend endpoints. Express GET handlers also serve HEAD without response bodies; only successful GET on `/:code` inserts click events. Unknown `/api/*` returns404 JSON; unknown pages404 text. Error JSON is `{error:string}`; redirect failures404/410 are readable text, not the JSON envelope

## Link contract / validation

Link: `{id:string,code,originalUrl,title,tags:string[],createdAt,expiresAt:string|null,isActive,status:'active'|'disabled'|'expired',clicks:number,shortUrl}`. Create inputs:

```json
{"originalUrl":"https://example.com/report?q=thai#results","title":"รายงาน","tags":["งาน"],"expiryPreset":"7d"}
```

- originalUrl: trim, absolute HTTP/HTTPS, no URL credentials, <=2048 before/after URL encoding; reject own PUBLIC_BASE_URL origin; stored `URL.href`
- title optional default '', trimmed max120; customAlias optional4–32 `[A-Za-z0-9_-]`, reserved/duplicate rejected
- tags optional default[], max8 input entries, each NFC/trim/lowercase1–32 without comma/control/format; deduplicate/sort after validation
- expiryPreset optional `none|1h|1d|7d|custom`; omitted defaults no expiry unless legacy expiresAt supplied; custom requires expiresAt ISO with offset and future; non-custom preset + expiresAt rejected; presets start backend insertion time. No expiry edit endpoint
- PATCH metadata accepts only supplied editable fields; tags=[] clears; title='' clears; nothing else changes. Status write accepts boolean only; Disabled precedence then Expired then Active

## Search / export / analytics

Search q trim max120 matches title/original_url/code case-insensitive with literal %, _ and backslash; optional normalized single tag combines AND; backend adds owner ID. History and CSV order created_at DESC,id DESC. History page max100000, limit max50; frontend uses6/page

CSV q/tag strict query; no pagination; 7 columns (title, destination, Short URL, created UTC, expiry UTC, status, opens), no Tags/owner/internal IDs. UTF-8 BOM + comma + CRLF; quoted escaped text; risky formula-leading text (including whitespace/control prefixes) gets apostrophe; numeric count remains digits. Empty200 header-only; >10,000=413 JSON, no partial CSV; attachment `my-links-YYYY-MM-DD.csv`; no-store. See csv.ts and README CSV section

Stats are owner totals and7 UTC calendar days including today; counts include prior events for currently disabled/expired links. Active totals exclude disabled/expired links. No unique/referrer/geographic statistics

## Auth / upload / AI limits

Email lowercase, max254; password min10 characters/max72 UTF-8 bytes; registration displayName optional API, required UI1–80 no control characters; confirm password is client-only. Login/Register/password each20 requests/15min/IP; photo updates share20/15min/IP. JPEG/PNG/WebP raw <=2MiB; actual still-image decode <=16,777,216 pixels then256×256 WebP <=256KiB

Create/edit each30/min/IP. AI10/min/IP +60/h/user; 1 in-flight/user, max4/process;30s timeout. All limit stores are in-memory; profile/status/read/redirect endpoints do not have these creation/edit limiters

AI input strict `{messages:[{role:'user'|'assistant',content}],includeStats?:boolean,conversationId?:string}`; alternating starts/ends user,1–8 messages,1–1000 chars each, total<=4000 (valid alternating request effectively max7); includeStats defaultfalse. Server fixes model/URL/key; opt-in summary own aggregate only; `store:false`, max_output_tokens2048, output text<=12000. No action tools; successful pairs persist privately in PostgreSQL. Read [AI setup/error contract](AI-ASSISTANT.md)

JSON body limit16KiB; no credentials in frontend; same-origin production/dev proxy, no general CORS middleware. Unknown internal failures generic500 without DB/provider body. These controls describe implementation, not penetration-test certification

## Persistence เพิ่มใน migration 007

| Endpoint | สิทธิ์ | ผล |
|---|---|---|
| GET /api/assistant/conversations | session | 100 บทสนทนาของเจ้าของล่าสุด; conversations array |
| GET /api/assistant/conversations/:id | session + owner | messages เรียง id; missing/foreign=404 |
| DELETE /api/assistant/conversations/:id | session + owner + CSRF | deleted:true; cascade messages |

POST chat ส่ง conversationId optional decimal string; reply เพิ่ม conversationId. History จาก client ไม่ใช้เป็นบริบทที่เชื่อถือ; server โหลดเอง. DB transaction บันทึกเฉพาะ successful pair. สูงสุด100 turns/chat; เกิน=413.
QR GET ใช้ qr_codes cache แบบ unique(link_id,payload), ไม่เปลี่ยน QR เมื่อแก้ destination; PUBLIC_BASE_URL เปลี่ยนจะสร้าง payloadใหม่. HEAD ไม่สร้าง cache.
CSV GET สำเร็จเก็บ csv_exports(owner,filters,row_count,filename) ไม่เก็บ CSV bytes; overlimit/error/HEAD ไม่สร้าง audit. Audit ยืนยันว่าเตรียม response สำเร็จ ไม่ยืนยันว่า browser รับครบหรือเปิด Excel.
Preview metadata GET บันทึก preview_events(link,status,time) เฉพาะ code ที่มีและ URL ที่ parse ได้ รวม disabled/expired; HEAD/missing/invalid ไม่บันทึก. อ่านหน้า HTML /preview/:code ไม่บันทึกเอง; metadata API อาจถูกอ่านหลายครั้ง (เช่น refresh/Continue/React development) จึงเป็นจำนวน request ไม่ใช่คน. ไม่เก็บ IP/UA. ทั้งสามไม่สร้าง click_events.
QR/Preview metadata share rate limit120 requests/min/IP/process,429 JSON. ระบบไม่เปิด public API อ่าน audit/events/cache raw หรือข้อมูลแชตของผู้อื่น.

อ่านบทสนทนาคืน includeStats จากconversation.include_stats. ต่อแชตต้องส่งค่าincludeStatsให้ตรงค่าของบทสนทนา มิฉะนั้น400และไม่เรียกOpenAI. เปลี่ยนconsentต้องเริ่มconversationใหม่.
