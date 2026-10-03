# Edit link name and destination

My links and Recent links have an **Edit** action. The dialog changes a name (optional, up to 120 characters) or HTTP/HTTPS destination (up to 2048 characters including URL encoding). Empty name clears the name; history then uses the code as its label. Changes apply to everyone opening the existing short URL. No migration or new dependency is needed.

## API

`PATCH /api/links/:code` requires a valid session, matching owner and existing CSRF/origin protection. JSON must contain at least one of `title`, `originalUrl` and `tags`; each is optional individually, `null` and unknown fields are rejected. Only supplied fields are updated. No alias/code, owner, expiry, enabled-state or click-event changes are accepted here.

```json
{"title":"Campaign report","originalUrl":"https://example.com/report?utm_source=qr#results"}
```

Returns 200 with the current `Link` representation. Invalid input or a destination on this service's configured public origin returns 400; missing authentication/expired session returns 401; CSRF/origin rejection 403; another owner's, ownerless or missing code 404. Limit: 30 authorized edits/minute/IP, then 429. Existing request-body limit and sanitized error handling apply. No destination is fetched by the server.

The backend reuses creation validation and canonical URL parsing; query and fragment remain intact. Parameterized UPDATE includes code and owner_id in its predicate, changes only supplied title/original_url/tags and returns persisted counts/status. Repeating the same payload is idempotent. Concurrent edits to separate fields preserve both fields; concurrent changes to the same field use the last committed write. This task does not add versions, an edit audit log or optimistic concurrency conflicts.

Short URL, QR payload/image, creation date, ownership, expiry, is_active and click history remain unchanged. Preview/history/search/CSV read current stored metadata. An already-open Preview may display stale metadata until refreshed; Continue re-reads metadata and then resolves the latest destination/status through the backend. Redirect's existing row share lock serializes validation/event creation with destination updates. Saving, reading Preview, QR, CSV and HEAD do not create click events.

## UI and verification

The dialog uses current tokens, labels and focus states; scrolls internally on small screens, traps keyboard focus, makes the workspace inert and restores focus on close. Save is disabled for unchanged input and while saving. Close/Cancel/Escape are blocked during a save; errors retain the draft. Requests have a 30-second timeout; ambiguous timeout warns that saving may already have occurred and asks the user to reload before retrying. Successful edits and failed requests refresh history using the current search/page, rather than leaving optimistic fake data.

All 52 tests (49 backend + 3 readiness), typecheck and production build passed. Four new automated regressions use guarded disposable PostgreSQL on loopback port 55432, database `shorturl_ui_test`, explicit reset opt-in:

- Saved name/destination in Preview/history/search/CSV, exact query/fragment preservation, repeated saves, clearing a name, old QR bytes and code unchanged, count preservation and exactly one new redirect event.
- Anonymous/expired sessions, user B, CSRF/origin, unsupported URL/credentials/self-service destinations, invalid fields, missing and ownerless records; rejected requests leave stored data unchanged.
- Disabled and expiry-boundary links retain expiry/status/events after edits and still cannot redirect.
- Concurrent partial edits and a redirect blocked by an in-flight destination write; the redirect reads the committed new URL and records one event.

Browser QA uses the actual production bundle/backend against separate local `shorturl_test` on port 3118, with OpenAI disabled. Only a newly created `edit-ui-qa-1003` fixture was edited; existing demo links and Supabase were not modified. Screenshots under ignored `tmp/qa-ui/edit-link-*.png`; desktop/mobile, Thai text, real API success, self-origin error retaining the draft, unchanged-save disabled, Cancel, Escape and keyboard focus wrap were checked. A real mobile camera scan, deployment and an OS screen reader were not checked.


The later Tags feature extends this same endpoint with private tags; see [Tags](TAGS.md). Tags-only edits do not change public name/destination. Migration 006 is needed for Tags; the name/destination feature itself needed no migration. Historical verification above predates Tags.
