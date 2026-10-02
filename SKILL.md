---
name: short-url-development
description: Build, debug, and verify the SYNERRY Short URL assessment application. Use for URL creation, redirects, QR codes, persistent history, click analytics, database migrations, deployment checks, and assessment documentation.
---
# Short URL Development

## Read project context

- Read the repository's AGENTS.md before changing code.
- Read design.md, README, package manifests, database migrations,
  and the assessment PDF when available.
- Confirm the repository root and inspect existing changes.
- Preserve working code and user edits.
- Use existing project decisions. For a new implementation, use
  React + TypeScript, Node.js + Express, and PostgreSQL.
- Report progress and explain important decisions in Thai.

## Implement in vertical slices

Complete each slice through database, backend, frontend, and verification.
Do not create all screens with mock data and leave persistence until last.

### Slice 1: Create and resolve links

1. Configure PostgreSQL and commit reproducible migrations.
2. Create the short_links table with a unique short_code.
3. Validate absolute HTTP/HTTPS destination URLs on the backend.
4. Generate codes using cryptographically secure randomness.
5. Handle unique-constraint collisions with bounded retries.
6. Save the destination and return a short URL using the configured
   public base URL.
7. Implement GET /r/:code with a temporary redirect.
8. Return a clear 404 for unknown codes.
9. Verify creation and redirection against a real database.

Preserve destination paths, query parameters, and fragments.
Do not derive public URLs from an untrusted Host header.
Reject obvious redirect loops into this application's redirect route.

### Slice 2: Persistent analytics and history

1. Create click_events linked to short_links.
2. Record one event for each qualifying GET redirect request.
3. Do not count HEAD requests, missing links, QR generation,
   history views, or failed/expired/disabled link resolution.
4. Show original URL, short URL, creation time, and total opens.
5. Verify records survive refresh and application restart.
6. Verify concurrent opens do not lose events.

Define total opens as recorded requests, not unique people.
Document that bots and previews can affect counts.
Use event records as the initial source of truth.
Define how redirect behaves if analytics recording fails.

### Slice 3: QR code and complete user flow

1. Generate QR codes from the short URL, not the destination URL.
2. Provide copy-link and QR-download actions.
3. Add loading, success, empty, and error states.
4. Verify the decoded QR payload equals the generated short URL.
5. Test a mobile scan against the deployed application when possible.
6. Confirm the scan redirects correctly and updates analytics.

If a physical scan cannot be performed, report it as unverified
and provide a precise manual test. Do not claim it passed.

### Slice 4: Useful enhancements

Implement only after required behavior works:

- Search and pagination.
- Expiration or disable/enable.
- Custom aliases.
- Daily analytics.

For every enhancement, update validation, persistence, UI,
tests, and documentation. Define authorization for management
operations; an unpredictable ID is not access control.

Do not introduce microservices merely by splitting folders.
If real microservices are requested, implement independently
runnable services and document communication, ownership,
failure handling, and event consistency.

## Verify deployment early

Deploy the first working create/redirect slice before final polish.

Check:

- HTTPS and public frontend/backend URLs.
- Production database connection and migrations.
- Frontend API configuration and CORS.
- Short URLs and QR codes contain no localhost addresses.
- Direct navigation to redirect routes works.
- Secrets remain on the backend and outside Git.
- Health checks expose no credentials or sensitive details.

Use the user's selected hosting provider and authorized scope.
Do not create paid resources without authorization.

## Review AI-generated changes

For every substantial change:

1. Inspect the diff and affected callers.
2. Check package/API assumptions against the installed versions.
3. Check validation and failure paths.
4. Run relevant tests, type checks, and builds.
5. Explain the important logic to the user.

Do not accept “implemented” as proof that a feature works.
Never fabricate execution results or replace required database
behavior with localStorage or mock data.

## Prepare assessment evidence

Keep diagrams aligned with the implemented system:

- Context diagram and DFD Level 0.
- ER diagram with actual PK/FK relationships.
- Architecture diagram with real components and connections.

Update README with actual installation steps, environment
examples, migration commands, run/build/test commands,
deployment URL when available, and known limitations.

Map each required assessment criterion to its implementation
and verification evidence.

Prepare a demonstration:
create link → open link → inspect history/count →
scan QR → inspect count → demonstrate error handling.

## Completion report

Report:

- Features completed.
- Checks actually run and their results.
- Unverified items and concrete blockers.
- Deployment and documentation status.
- The next necessary action.

Do not claim the assessment will pass or the application is
production-ready without supporting evidence.
