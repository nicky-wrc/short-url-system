# Link Studio UI verification

Verified locally on 2026-10-03 (Asia/Bangkok). This change is frontend/documentation only;
backend endpoints, sessions, CSRF, ownership, schema and dependencies are unchanged.

## Implementation

- Neutral charcoal, off-white and readable secondary text; restrained lime primary actions.
- System sans-serif stack: operating-system fonts, no proprietary font files or external font requests.
- Central tokens in `frontend/src/theme.css`; component layouts and responsive states in `styles.css`.
- Compact page headings; marketing cards, challenge/technology footer and permanent API-connected badge removed.
- Overview uses page 1 of the existing owned-links API, independent of My links search/pagination.
  Recent links precede the real UTC daily-open chart. No placeholder chart data or nonzero bars for zero values.
- Desktop sidebar puts identity/Profile/Logout at the bottom. Mobile/tablet navigation is a disclosure;
  Escape closes it and returns focus. History switches to stacked metadata/actions at 900px and below.
- Copy, QR, Preview and Open have visible action labels. Full destination URLs are accessible via
  native details disclosures, wrap safely, and can be selected/copied. Preview keeps the domain and
  Continue visible before a long URL is expanded.
- Existing request locks, QR focus trap, explicit enable/disable, expiry presets and CSV behavior remain.

## Checks actually run

| Check | Result / scope |
|---|---|
| `npm run typecheck` | Frontend and backend passed |
| `npm test` | 36 passed: 3 startup readiness + 33 PostgreSQL integration tests |
| `npm run build` | Frontend production build and backend build passed; frontend build repeated after visual corrections |
| `git diff --check` | Passed |
| Data safety | Tests enforce disposable loopback `_test` database + explicit reset opt-in; QA used local port 55432, never hosted Supabase |
| Responsive pages | Overview, Create, My links, Analytics, Profile, Login, Register and public Preview captured at 390 / 768 / 1440px |
| Overflow | DOM measurements found document scroll width no greater than viewport width on all eight pages; long URL disclosure also checked expanded at 390px |
| Visual correction | Screenshots exposed tablet action words wrapping and sidebar identity breaking; fixed both. Long Preview URL initially buried Continue; changed to a disclosure |
| Real data | A owns six links: active/disabled/expired, Thai title, long query/fragment URL; B has zero. Local seeded records were saved in PostgreSQL; counts came from actual redirect requests |
| Create/expiry | Browser created a 1-hour link, displayed its expiry/timezone, reset preset to none; custom past time displayed a validation error. Backend tests cover every preset and exact expiry boundary |
| Public Preview/redirect | Active/disabled/expired/missing states inspected. Continue reached `https://example.com/ui-browser-check?keep=1#section`; workspace count increased from 4 to 5 |
| Non-counting operations | Create, QR display/download request, CSV request, history/Preview reads, Copy, profile rename and disable/enable left opens at 4; only Continue raised it to 5 |
| Owner controls | Browser disabled and re-enabled the created link, with saved state confirmed in UI. A/B denial and session/CSRF checks pass in existing integration suite |
| Auth/Profile | Browser logged in A/B, logged out, saved display name; Register form inspected, not submitted. Password change covered by backend tests, not submitted in browser |
| Keyboard | Native URL disclosure expanded by Enter with visible focus; menu Escape returns focus to menu control; QR Escape closes dialog and returns focus to its opener |
| Search | No-match state inspected; navigating to Overview while search remained set still loaded six recent links |
| Empty/error/loading | B's empty history has a create action and no fabricated graph. Local QA-only HTTP 503 produced retry banner, unavailable history, dashes for unknown metrics; missing Preview and invalid custom expiry errors checked |
| Browser logs | No unexpected frontend console errors/warnings in final QA tab |

## Contrast

WCAG contrast ratios calculated from rendered theme tokens against the raised surface (#1b1e22),
which is lighter than the canvas and sidebar:

| Pair | Ratio |
|---|---|
| Main text / surface | 14.96:1 |
| Secondary text / surface | 7.82:1 |
| Error / surface | 9.18:1 |
| Expired / surface | 10.52:1 |
| Active / surface | 10.79:1 |
| Primary dark text / lime | 12.59:1 |
| Input border / surface | 3.51:1 |

Main controls have at least 44px height; form inputs 48px and mobile row actions 56px.
Input borders use #697480 separately from subtle layout dividers. QR modal widths were
358px at the 390px viewport and 440px at 768/1440px, with no horizontal document overflow.
Interactions transition selected color/background/border properties for 150ms. Reduced-motion
CSS disables transitions and the pre-existing loading spinner. No scroll animation was added.

## Evidence and limits

Local screenshots and dimension/contrast measurements are in ignored `tmp/qa-ui/`.
They contain test fixture data, not production data. DESIGN.md was rewritten as the local Link Studio
design system and remains ignored under the user's earlier Git preference; README documents the shipped direction.

CSV and QR controls were clicked in the browser and CSV success feedback appeared, but this in-app
browser did not expose a saved download path (download event timed out). Their response content,
headers, CSV escaping/BOM/ownership and QR payload are verified by the existing integration suite.
Do not interpret the UI success message as proof of a file saved to disk.

No physical phone scan, Excel opening, screen-reader audit or Safari/Firefox/device testing was performed.
The password-change form was visually inspected; credential-change submission was not performed through
browser automation. No deployment or production-data writes were performed in this task.

## Progressive Login/Register verification

Frontend-only adaptation of the supplied auth reference. Typecheck, 39 existing tests (3 startup + 36 database integration), and frontend/backend build passed. Browser checks against the disposable local QA database: registration with name, password confirmation mismatch, back preserving values, real successful registration showing QA Auth in the workspace; password visibility; incorrect login error, successful login and logout returning to Account; keyboard focus reaches Continue with a solid outline. Screenshots inspected at 390, 768 and 1440px. The first desktop capture taken while styles were loading was discarded and recaptured after verifying the form's actual 440px bounding rectangle. No overflow at 390/768px. Backend and dependencies unchanged; no production data modified. Not verified on a physical phone or deployed in this task.

## Interactive button verification

Typecheck, build and 39 existing tests passed after integrating native forwarded button/anchor components. Browser checks on isolated QA data: Login, New link, create link, QR dialog + actual PNG download, disable/enable, exact accessible names, keyboard focus and disabled pagination without animation classes. Inspected screenshots at 390 and 1440px; mobile has no horizontal overflow and focused Copy shows the lime reveal with readable text/arrow. Preview retains its native backend redirect href and copy button. The CSV action returned without an error but the in-app browser did not report a Blob download event (two bounded attempts); saving its CSV file was not confirmed in this browser run. CSV backend regression tests passed and export handler remains unchanged. Reduced-motion/coarse-pointer rules were inspected in CSS, not emulated on a real device. No deployment or physical mobile test.

## Morph loading verification

Typecheck, frontend/backend build and 39 existing tests passed. Replaced Loader2 usages with the shared four-shape component on session, Preview, history, create/CSV/status, Profile/photo/password and logout pending states. QA screenshots inspected for Preview loading and Login button loading; browser confirmed controls disabled during Login and successful workspace entry afterward, and Preview loading ending in the real missing-link error. At 390px, the 64px session indicator and text fit without horizontal overflow, and the decorative mark has aria-hidden while readable status remains. Temporary 5-second delay was applied only in the ignored local QA HTTP wrapper to observe real pending UI, then removed; no production/app delay added. Reduced-motion static shapes inspected in CSS, not verified on a physical device. No deployment in this task.
