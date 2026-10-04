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

## AI assistant verification (2026-10-03)

Inspected browser layouts at 390×844, 768×1024 and 1440×1000 with isolated local PostgreSQL QA data, not Supabase. Actual missing-key app disables chat submission, explains service availability and leaves navigation shortcuts usable. Keyboard checks verified Escape restores launcher focus, background inert is removed on close, and Tab wraps from the last enabled control to Close. No horizontal overflow.

An ignored, separate local QA provider fixture on port 3116 (explicitly labelled “QA fixture — ไม่ใช่คำตอบจาก OpenAI”) exercised send/loading, Enter/Shift+Enter, plain-text HTML payload, long URLs, copy answer, optional real owned aggregate read, consent clearing history, provider error preserving the draft, and Stop. It never called OpenAI; these checks verify UI behavior rather than AI answer quality. Browser testing found Stop could reuse a submit button node and accidentally re-submit after synchronous state changes; separate keyed buttons plus preventDefault fixed it, and retesting showed the stopped message with the draft restored and no pending response. The QA fixture server was stopped after testing; no fake provider or mock mode is shipped in application code.

Screenshots inspected and retained locally under ignored tmp/qa-ui/ai-*.png. Existing full backend regression suite passed: 44 + 3 dev readiness tests, typecheck and standard build passed. No real OpenAI response, provider billing/model access, deployment, or physical-phone keyboard verification because an API key has not yet been configured. Follow docs/AI-ASSISTANT.md for setup and real-provider acceptance checks. Public Preview/QR and link API handlers are unchanged.

## Compact AI chat UI (2026-10-03)

Refined only the frontend chat: compact header with icon actions, a capsule composer expanding on text, three short chips inserting full editable questions, optional aggregate sharing with explicit OpenAI destination, and capability/privacy/navigation details behind About. Character count is only visible near the limit; repeated labels/instructions are removed visually while textarea and consent descriptions stay available to assistive technology. No backend, dependency, authentication, endpoint or database changes in this refinement.

Typecheck and frontend/backend build passed; 44 PostgreSQL backend + 3 dev readiness tests passed again against the isolated local shorturl_ui_test database with reset opt-in and real API key disabled. Browser checked 390×844, 768×1024 and 1440×1000: no horizontal overflow, initial/expanded composer, suggestion fills without sending, About collapse, Escape restoring launcher focus/background inert, Tab wrap, loading + disabled input, Stop restoring draft, New chat, consent resetting history, copy answer, long URL/plain-text HTML, and sanitized provider error preserving draft. Sending/copy/error used the ignored QA fixture server, never real OpenAI or production data; it was stopped afterward. Provider quota/billing errors in the user's screenshot are not fixed by this UI task and real-provider answer quality was not re-tested.

Inspected screenshots: tmp/qa-ui/ai-clean-mobile.png, ai-clean-filled.png and ai-clean-desktop.png (local ignored QA artifacts). Physical phone/virtual-keyboard behavior and deployment were not verified in this task.

## Saved history and toolbar alignment (2026-10-04)

Local isolatedQA3116/PostgreSQL with offlineproviderfixture: My links checked390×844,768×1024,1440×1000, existing longdestination stayscontained. Search/tag/CSV use48px equal bottomalignment; labelmarginremoved andCSVnowrap. Mobile stacksfullwidth. Savedconversation created, persistedafterrefresh, loadedfromselect andrenderedonmobile. SelectincludedinmodalTabtrap; Shift+Tab fromselect reachesClose. CSVdownload attempted but browserdownload-eventtimedout; endpoint/CSV/audit tests passed, filecompletion/Excelunverified. Existingproductiondata andrealproviderkey were notused. Images are ignoredlocalQAfixtures.

## Dark/Light mode verification (2026-10-04)

Dark remains the default. A reusable switch is available in the desktop account area, mobile header, auth header and public Preview header. Light mode keeps the lime primary buttons and uses separate darker accent-text/focus tokens. The self-hosted bootstrap applies the stored browser preference before React renders; this is a device/browser preference rather than a server-side account setting. No new dependencies or backend changes.

Typecheck and frontend/backend production build passed. Five theme tests passed (default/invalid/saved preference, persistence/subscriptions, blocked storage, cross-tab updates, and palette contrast); three existing dev-readiness tests also passed. Contrast tests require 4.5:1 for main/secondary/accent/status text on the four surface tokens and 3:1 for focus, plus primary-button text contrast. These are token checks, not a complete accessibility audit. Backend integration tests were not rerun for this frontend-only task.

Browser checks used isolated local PostgreSQL QA data on port 3116, with OpenAI calls disabled. Verified light/dark switching, Space keyboard activation and visible focus, persistence after reload, and synchronization across two same-origin tabs. Inspected My links at 390×844 and 1440×1000, the edit dialog on desktop, public Preview at 768×1024 and mobile registration in light mode. Overview/Create/Analytics/Profile rendered using the selected theme. Mobile My links and registration had no document horizontal overflow; long destination URLs stayed contained. No production data was modified and no deployment was performed. Physical-device behavior and a screen-reader audit remain unverified.

Screenshots retained as ignored local artifacts: tmp/qa-ui/theme-light-desktop.png, theme-light-mobile.png and theme-dark-mobile.png.

## Centered workspace and kinetic navigation (2026-10-04)

Daily opens on Overview/Analytics and Create link share an 820px maximum width, centered within the available main workspace. The create-page heading follows the same width. WorkspaceNavigation.tsx adapts the supplied Sterling Gate reference: desktop expanded sidebar (260px) / icon rail (76px), mobile drawer, subtle layered slide and staggered links, plus a 200ms page entrance (6px travel, initially 88% opacity). Existing CSS tokens and both palettes remain; no demo menus/shapes, global GSAP defaults, Tailwind or new dependencies.

Typecheck, frontend/backend build, five theme tests and three dev-readiness tests passed. Browser QA used the guarded local PostgreSQL database and offline AI fixture on port3116. At1440px, measured Daily opens in both Overview/Analytics and Create link at820px with exactly matching centers to main; icon rail expands/collapses without losing a URL draft. At768px, create/result/QR modal fit without horizontal overflow. At390px, inspected dark/light drawer, Profile and navigation, closed drawer is inert, main/header/AI launcher become inert while open, Tab/Shift+Tab wrap within controls, Escape returns focus to the trigger, and selecting Analytics/Profile moves focus to main. A rapid close/reopen found the fading scrim intercepted the next click; closed scrim/drawer now disable pointer events immediately and the sequence passed on retest.

Created a real isolated-test link using the1h preset and displayed its QR. One manual302 request to the existing isolated-test short code recorded a real event for the chart; no destination was fetched or fake chart data introduced. Reduced-motion CSS was inspected but the available browser tools do not expose media emulation, so that preference was not toggled in-browser. Backend integration tests were not rerun for this layout-only task. Physical devices, production deployment and physical QR scans remain unverified. Screenshots: tmp/qa-ui/navigation-analytics-desktop.png, navigation-create-desktop.png, navigation-drawer-mobile.png (ignored local artifacts).

## Capsule theme switch, top-right placement (2026-10-04)

Replaced the labelled/compact theme control with the supplied capsule idea adapted to existing React/CSS. Generic component now lives at frontend/src/components/ui/theme-toggle.tsx. Native button role=switch retains the real external theme store, persistence, keyboard behavior and theme tokens. Track64×32px has a24px thumb sliding32px over240ms; button hit area72×44px. No new dependency, Tailwind, shadcn setup or next-themes is required. Desktop uses a dedicated right-aligned toolbar above main; mobile switch is rightmost beside the menu trigger, and auth/Preview retain their top-right header controls. Removed YOUR PERSONAL LINK WORKSPACE from auth and removed the account-area theme switch. Reduced-motion disables thumb transition.

Typecheck, five theme tests and frontend/backend build passed; final frontend rebuild had no CSS warnings. Browser checked desktop workspace, Space activation, mobile390px workspace header with no overflow, preference after reload, Login header without the removed phrase, and public Preview390px with no overflow. Mobile header needed an explicit row direction to avoid inherited sidebar column layout; fixed and recaptured. Local isolated PostgreSQL QA only, no deployment or production data writes. Screenshots: tmp/qa-ui/theme-pill-desktop.png and theme-pill-mobile.png. Reduced-motion preference and physical devices were not tested in browser.

## Thai/English language selection and centered Profile (2026-10-04)

Profile heading/layout centers in the workspace (900px desktop, 640px single-column at1150px and below). Native EN/ไทย selector shares the top-right toolbar with the theme capsule; mobile trigger sits beside the brand. Language catalog covers workspace, auth steps, profile/photo controls, editing/tags, QR, public Preview and assistant UI plus known API errors. App root subscribes without remounting forms. html lang, localized numbers/dates (Gregorian year retained), persistence and same-origin cross-tab updates are supported. User content, tag identities, assistant messages and CSV/API field contracts are preserved. Added @fontsource/noto-sans-thai400/600/700 self-hosted font; license retained under docs/licenses.

Actual browser QA used built frontend and isolated local PostgreSQL test data on port3116. Profile checked at390/768/1440px; measured900px centered in desktop main and640px centered at768. No horizontal document overflow on checked Profile sizes or Preview390px. Verified language switching keeps a draft display name, destination URL and1d expiry choice; reload restores language; same-origin tabs synchronize. Native selector ArrowUp switched Thai to English and Tab reached theme switch. Mobile drawer Escape returned focus to the open-menu trigger. Inspected Overview/Analytics, search empty state, long-URL My links, edit and QR dialogs, Login/Register account and password steps, AI UI and localized suggestion insertion. Preview unknown-link404 translated in both languages. Did not submit registration or change passwords.

Typecheck (frontend/backend), production build (frontend/backend),5 i18n tests,5 theme/contrast tests and3 dev startup tests passed. Local HTTP checks confirmed CSV200/text-csv with saved link and QR200/PNG with attachment header. Browser download-event wait timed out, so filesystem delivery through browser was not confirmed. Real OpenAI calls, full backend suite, physical devices and production deployment were not tested this round. Existing reduced-motion handling remains; available browser capability does not support media emulation. Native browser validation/date-picker text follows browser/OS; unexpected server messages fall back to original text. Screenshots are ignored local artifacts under tmp/qa-ui: profile-th-1440.png, profile-th-768.png, profile-th-390.png, register-th-390.png and preview-th-390.png.
