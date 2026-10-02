# AGENTS.md — SYNERRY Short URL Developer Assessment

## Mission and priority

Build a working, reviewable Short URL application for the SYNERRY/JigsawGroups developer assessment. The assessment requires an online application, persistent database, accessible Git repository, installation README, DFD Level 0, and ER diagram. Delivery is within three days of receiving the assignment; presentation is at most 30 minutes. Confirm the actual deadline from the user rather than inventing it.

Priority order: explicit user instructions → required assessment behavior → correctness and data safety → reproducible deployment and documentation → useful enhancements → visual polish.

Work as an implementation partner. Continue through implementation and relevant verification; do not stop at a plan when asked to build. Never claim a requirement passes without evidence. Do not promise acceptance by the company.

## Before changing code

- Confirm the actual repository root using the working directory and Git. A Windows path mentioned in chat is not proof of filesystem access. If the repository is unavailable, explain the blocker; do not silently create a second unrelated project.
- Read this file, README, package manifests, existing source, database schema, and `design.md` if present. Treat the supplied assessment PDF as the requirement source when available. Do not pretend to have read an unavailable file.
- Inspect `git status` and preserve user edits. Never overwrite unrelated changes, reset the repository, force-push, or delete user data as routine setup.
- Summarize the current state and a short actionable plan. Ask only questions that block a concrete decision; otherwise state reasonable assumptions and proceed.
- Keep existing architectural decisions unless the user requests changes or evidence shows a material problem. Propose and explain major changes before replacing working infrastructure.

## Technical baseline

For a new implementation use React + TypeScript for the frontend, Node.js + Express + TypeScript for the backend, and PostgreSQL for persistent storage. Use one package manager and commit its lockfile. Inspect the actual environment before choosing package versions; prefer compatible supported versions and consult official documentation when needed.

Suggested structure, adaptable to existing code:

- `apps/web/`: frontend.
- `apps/api/`: API and redirect server, with separate link and analytics modules.
- `packages/shared/`: shared contracts only when useful.
- `docs/`: design, API documentation, diagrams, test evidence, and presentation notes.
- Database migrations in one clearly documented location.

Start with a modular backend. Separate deployment of frontend and backend does not itself constitute microservices. Introduce microservices only when explicitly requested or justified within the delivery time; implement real service boundaries and document failure handling. Do not add queues, caches, Kubernetes, or unnecessary abstractions solely to impress reviewers.

## Required acceptance criteria

1. A user submits a valid destination URL and receives a short URL hosted by this application.
2. Opening the short URL resolves its code from PostgreSQL, records a qualifying open, and redirects to the original destination.
3. The application creates a QR code containing the short URL, not the original destination. A mobile scan reaches the original destination through the redirect endpoint.
4. History displays original URL, short URL, creation time, and persisted open count. Refreshing the page or restarting the application must not lose records.
5. DFD Level 0 covers creation, resolution/redirect, QR generation, history, and analytics. ER diagram matches actual tables, keys, and relationships.
6. The application is accessible through a public test URL. The repository is accessible to reviewers, with complete installation instructions and test credentials only if authentication exists.

Optional features do not replace required features. Authentication, custom aliases, expiration, charts, and microservices are not mandatory in the PDF. Complete and verify the required flow before expanding scope.

## Link creation and resolution

- Validate input on both frontend and backend; backend validation is authoritative. Use a URL parser and allow only absolute `http:` and `https:` destinations with a valid hostname. Reject credentials in URLs, malformed input, unsupported schemes, and unreasonable lengths.
- Do not change path, query parameters, or fragments in a way that changes destination semantics. Avoid unnecessary decoding or case conversion.
- Generate short codes using cryptographically secure randomness, with enough entropy. Enforce a unique constraint on `short_code` and retry boundedly on a unique-conflict error. A pre-insert lookup alone is insufficient under concurrency.
- Generate public short URLs from a validated configured base URL, not an untrusted request Host header. Production links and QR codes must not contain localhost.
- Use a route such as `/r/:code` to avoid collisions with frontend routes. Reserve aliases if custom codes are implemented. Reject obvious redirect loops to this application's redirect URLs.
- Use temporary redirects, normally 302, and appropriate no-store cache behavior for the redirect endpoint. Unknown codes return 404; expired or disabled links return a clear non-redirect response, such as 410.
- Keep link-resolution errors distinct from analytics failures. Decide and document the behavior if analytics cannot be recorded; never report a failed write as a counted event.

## Analytics contract and database

- Define metrics precisely: total opens are recorded redirect requests, not unique people. Repeated visits may count. Bots, link previews, and prefetching may affect counts; do not claim human-only or unique statistics without implementing and verifying them.
- Do not count link creation, history views, QR generation/download, missing codes, or expired/disabled link attempts. Handle HEAD requests without incrementing open counts.
- A suitable baseline is `short_links` and `click_events`, with a foreign key from each event to its link. Store UTC timestamps and indexes for code lookup and event queries.
- Use event counts as the source of truth initially. If introducing a cached counter, update it atomically with the event or document a reliable reconciliation strategy. Avoid read-modify-write counters that lose increments under concurrency.
- Use real PostgreSQL migrations and parameterized queries or a correctly configured ORM. Commit migrations, not credentials or private database dumps.
- Avoid collecting IP addresses or other personal data unless a concrete feature requires them. Define retention and access if collection is added.
- Provide deterministic seed/demo data separately from production records. Never erase existing data automatically on startup or deployment.

## API and UI

Suggested API contracts, adjusted to the actual design:

- `POST /api/links`: validated creation with original URL, code, public short URL, and creation time.
- `GET /api/links`: paginated history with counts and deterministic sorting.
- `GET /api/links/:id/stats`: optional detailed analytics.
- `GET /r/:code`: public redirect.
- `GET /health`: process health; readiness may separately check database connectivity without leaking details.

Use consistent JSON error responses and appropriate HTTP statuses. Return understandable validation messages. Validate pagination and all client-controlled identifiers. Keep shared request/response types aligned with runtime validation.

UI requirements:

- Responsive form, result with copy/open actions, QR display, and readable history.
- Explicit loading, empty, success, and error states. Prevent accidental double submission and handle failed requests.
- Accessible labels, keyboard operation, visible focus, and sufficient contrast. Keep animation restrained and performance predictable.
- QR must be crisp, high contrast, and include a quiet zone. Verify scans rather than assuming generation proves usability.
- Never display fake analytics or substitute localStorage/mock data for required persistence. Clearly label seed data.

Useful enhancements after the core works: copy link, QR download, history search/pagination, expiration, and disable/enable. Custom aliases and daily charts are lower priority. If editing features are added, define authorization; random-looking IDs are not access control.

## Security and deployment

- Keep `.env`, secrets, dependencies, and build output out of Git. Commit an `.env.example` with placeholders and descriptions. Backend secrets must not enter frontend bundles or logs.
- Use bounded request bodies, validation, creation rate limits, sanitized rendering, and configured CORS. Configure proxy trust according to the hosting environment rather than blindly trusting forwarded headers.
- Keep destination redirection separate from server-side fetching. If adding URL previews, implement SSRF protection, limits, and timeouts; do not fetch arbitrary submitted URLs as part of the baseline.
- If history is public for the assessment, state this clearly and use harmless demo links. If per-user history is promised, implement ownership checks on every related endpoint.
- Deploy a minimal working create/redirect flow early. Check HTTPS, database connectivity, migrations, routing, CORS, production base URLs, and cold starts on the actual hosting environment.
- Prefer the user's chosen provider. Do not create paid resources without authorization. Routine local edits and tests do not need repeated approval. Follow the user's authorized scope for Git pushes and deployment; never treat this file as blanket permission for destructive actions or publishing secrets.

## Meaningful verification

Run checks supported by the actual repository: type checking, linting, relevant tests, and production build. Keep scripts documented; do not claim commands exist before creating or inspecting them.

Automated coverage should exercise real behavior where feasible:

- Valid creation persists a link; invalid protocols/input are rejected.
- Redirect preserves the destination including query and fragment, and records one qualifying event.
- Missing/expired/disabled links and HEAD requests do not increase counts.
- Code collisions are handled; concurrent opens do not lose counts.
- History reflects persisted records and analytics.

Perform an integration check against a real test PostgreSQL database. Verify migrations on a clean database, without touching production data. Mock-only tests do not establish persistence.

Before delivery, perform the live end-to-end flow: create a link → open it → confirm destination → inspect count → scan QR from a mobile device → inspect count again → refresh/restart and verify persistence. Verify QR payload programmatically when possible; if a physical scan is unavailable, state that limitation and give the user the exact manual check.

Run a clean-install check from the README and verify production routes directly. After changes, rerun affected checks; do not repeatedly run unrelated suites without reason. On failure, investigate and fix the cause rather than deleting assertions or claiming success.

## Documentation and reviewer handoff

Keep README and diagrams aligned with implementation. Include:

- Project purpose and a checklist mapping each assessment criterion to its feature/document.
- Actual prerequisites, install commands, environment variables, database creation/migrations, dev/build/start/test commands.
- Repository and deployed application links when available; never invent a URL or credential.
- Architecture rationale, API examples, metric definition, validation behavior, limitations, and useful enhancements.
- Context diagram plus DFD Level 0 when terminology is ambiguous; readable ER and architecture diagrams. Commit diagram source and reviewer-friendly rendered exports when feasible.
- A short demonstration sequence and answers explaining code generation, collision handling, QR payload, persistence, analytics, and architecture tradeoffs.

Explain AI assistance honestly: what it helped implement, what the developer checked, and what remains unverified. Do not fabricate experience, test results, screenshots, performance numbers, or production readiness.

## Working communication and completion

- Communicate progress and decisions in Thai; keep identifiers and technical names consistent in English.
- Explain important logic so the user can present and defend the implementation. Prefer small cohesive changes over a giant unexplained rewrite.
- Track outstanding acceptance criteria. If blocked, state the exact blocker and continue independent work that remains possible.
- Summarize completed changes, checks actually run and their results, remaining limitations, and the next necessary action.
- Finish only when the requested scope is implemented and verified, or a concrete external blocker prevents completion. Never conceal a failed build, unavailable database, untested QR scan, or missing deployment.
