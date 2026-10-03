# Private link tags

Add comma-separated Tags under Link options when creating a link, or in Edit link. For example: `โซเชียล, สมัครงาน, campaign`. Press Enter or + to append typed tags; the input is separate from committed selections. Use the remove buttons to remove tags. Tags belong to the link's owner; public Preview and QR metadata do not disclose them.

Names are Unicode NFC normalized, trimmed and lowercased, then deduplicated and sorted. The API accepts up to 8 supplied entries (before deduplication), each 1–32 JavaScript string units after normalization. Commas and Unicode control/format characters are rejected; Thai and spaces within a name are allowed. Empty individual comma-separated entries are invalid. Frontend and backend validate independently.

## API

- `POST /api/links`: optional `tags: string[]`, default `[]`; existing session/CSRF/create rules apply.
- `PATCH /api/links/:code`: optional `tags: string[]` together with existing title/originalUrl. At least one editable field is required. Omitted tags preserve the current value; `[]` removes all. Owner predicate, session, CSRF and edit rate limit apply. Another owner's, ownerless or missing link returns 404. Invalid input returns 400 without mutation.
- Private Link responses include `tags`. Public Preview does not include tags.
- `GET /api/tags`: authenticated owner's distinct currently used tag names in database order, `{ "tags": [...] }`. No tags from another owner or ownerless legacy links.
- `GET /api/links?...&tag=campaign` and `GET /api/links/export.csv?...&tag=campaign`: optional one validated tag, combined with `q` using AND. Repeated tag/query values are rejected. Parameterized SQL scopes by owner and exact normalized array membership, not substring or SQL syntax.

My links starts with All tags. Changing a tag resets pagination. An active filter remains selectable if its final matching tag is removed; choose All tags to recover. Overview and aggregate statistics retain their existing unfiltered owner scope. CSV exports every matching page, keeps the existing seven columns and 10,000-row explicit ceiling, and exports headers only when there are no matches. Tag names are not added as a CSV column.

## Database and compatibility

Run `npm run db:migrate` before starting the updated backend. `006_link_tags.sql` adds `links.tags text[] NOT NULL DEFAULT '{}'` and a GIN index. It is additive/idempotent, keeps existing owners/data and still uses four tables. Old links get empty tags; ownerless links remain public but cannot be edited by new users. No dependency was added for Tags.

Editing tags does not change the code, public URL, QR, destination, expiry, enabled state or events. Reading/filtering/exporting tags does not create clicks. AI's optional aggregate sharing does not send tag names, and the assistant cannot edit tags.

## Verification

Typecheck, build and 55 tests (52 backend + 3 readiness) passed. Three new regression cases cover normalization/invalid values, privacy and ownership, filtered pagination and CSV across pages, no events, clear/preserve updates, repeated migration and old-schema upgrade. Tests used guarded disposable loopback PostgreSQL `shorturl_ui_test`, with explicit reset opt-in; Supabase was not reset or migrated.

Browser QA used production frontend/backend on port 3118 with separate local `shorturl_test` and OpenAI disabled. Only the existing QA fixture `edit-ui-qa-1003` was edited. Responsive checks and screenshots are recorded under ignored `tmp/qa-ui/tags-*.png`. Migration for the user's Supabase still needs to be run using their normal environment. No deployment, physical phone camera scan or Excel verification is claimed.

Browser checks at 390, 768 and 1440px covered Thai tag editing/clearing, validation retaining draft, keyboard Tab order, actual tag filtering, search+tag empty state, public Preview exclusion and CSV success feedback. The browser tool could not retrieve the Blob download event; file contents are verified by PostgreSQL-backed integration tests, not by opening the browser-downloaded file or Excel. A queued ResizeObserver callback from the existing auth text animation exposed a null ref after unmount during QA; added a disposed/connected guard without changing its animation.

## Select or type tags (2026-10-04)

The shared Tags input now offers a native selection menu with suggested Thai categories and the authenticated owner's previously used tags from the existing GET /api/tags response. Selected options are disabled to avoid duplicates, and the chooser is disabled at eight valid tags. Free typing and comma-separated input remain supported. Selected tags have keyboard-accessible remove buttons; invalid drafts are preserved with an error if a choice is attempted. The edit dialog focus trap includes the new select. Create and Edit use the same component; no backend, dependency or migration change is needed for this UI update.

UI refinement verification: typecheck and full production build passed. Browser checked Create and Edit with the local QA account, selection from both groups, typed custom Thai names, removing/reselecting tags, duplicates disabled, chooser disabled at eight and reenabled after removal, invalid draft retained, keyboard Shift+Tab through select, desktop 1440px and mobile 390px. Draft checks were cancelled without modifying stored links. No console errors were observed. No new backend tests were needed for this frontend-only change; the previous 55-test backend/readiness result remains historical, not a new run. Screenshots: tmp/qa-ui/tag-choices-desktop.png and tag-choices-mobile.png. Native phone and screen reader testing were not performed.

## Append-only entry fix (2026-10-04)

Typing now edits a separate local draft, never the selected tag list. Enter (except during IME composition) or the + button validates and appends one or several comma-separated tags, deduplicates them and clears the draft only on success. Failed additions retain both the draft and all previous tags. Removing selections still requires their explicit remove buttons. Native form validity blocks saving a non-empty uncommitted draft and explains how to add it first, preventing silent loss; Enter in the tag field never submits Create/Edit. API format and database remain unchanged.

Typecheck and full build passed. Browser regression checks covered choose then type, Enter and +, duplicate addition, overflow rejection preserving six existing selections, pending draft blocking Save, empty draft after successful addition, both Create/Edit, desktop/mobile screenshots. QA cancelled drafts without changing stored links; no production data or external AI calls were involved. Backend integration tests were not rerun for this frontend-only fix.
