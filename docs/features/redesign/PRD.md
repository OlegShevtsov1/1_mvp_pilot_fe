---
status: Approved
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: "S"
stage: "03"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/PRD.md by sync-spec. Do not edit here. -->

# PRD — redesign

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../../CONTEXT.md) — the repository's root glossary is the glossary of record for this feature (author's decision, 2026-10-28); no feature-level CONTEXT.md exists.
> **Reference module:** N/A — visual change only; the existing frontend screens were read for current behaviour.
> **External context channels used:** architecture-map: `docs/architecture-map.md`; frontend screen code and its unit, end-to-end and design-token tests (sibling repository, read-only); course knowledge base (module 11.4, design tokens and a rendered-snapshot check).

## 1. Context

The product is a demo and portfolio MVP: a landing page, sign-up, sign-in and the cabinet, where a user works with their projects and tasks. Its look must be presentable to reviewers and demo audiences, who meet it as visitors and users. The landing page was restyled twice on 2026-10-23, but sign-in, sign-up and the cabinet have no common visual language with it, and no measured user complaint exists; the driver is the owner's judgement.

The MVP is feature-complete for its pilot scope (landing, sign-in with Google or email, projects and tasks), so visual polish is the remaining gap before showing it. No external deadline is known.

The committed approach (idea-brief §13, Approach A) is a visual redesign of the landing page, sign-in, sign-up and the cabinet through shared design values and the styles of each screen, with no behaviour change, no new component library and no copied template code. The look of two references is ported into our own styles: DarkSaaS for the landing page, Mantis for sign-in, sign-up and the cabinet.

Scope change (owner, 2026-10-29), which supersedes the narrower reading of 2026-10-28 (one shared palette, DarkSaaS for layout rhythm only, unchanged typefaces, every visible word and landing section kept):
- The landing page takes the look of DarkSaaS: a dark background, gradients, accent colours and a hero. New sections, visuals and wording are allowed.
- The cabinet takes the look of the Mantis dashboard: a sidebar, a header and cards. Sign-in and sign-up take the look of the Mantis auth pages.
- There is no longer a single palette for all screens: the landing page has its own palette and gradient values, the other screens use the Mantis-derived ones. Typefaces may change.
- Unchanged: no copied template code, no paid assets, and behaviour is unchanged. Sign-up, sign-in, the cabinet and the crash screen keep both themes and follow the device; the landing page is always dark (owner, 2026-10-29, see Clarified below).

The application's crash screen (shown when rendering fails) is part of the redesign and gets the new look; unknown addresses keep showing the landing page. "The four screens" in this PRD means the landing page, sign-up, sign-in and the cabinet; the crash screen is checked for look, contrast, reduced motion and phone width together with them.

Baseline idea (Trello card 368, translated from the card's Ukrainian title): "redesign: New design of the landing page and the cabinet." Functionality does not change.

Traceability and decisions (author, 2026-10-28): glossary of record is the repository root. Visual references split by screen (DarkSaaS for the landing page, Mantis for the rest). Both themes are kept and follow the device (the landing page is always dark since 2026-10-29). The owner approves each screen from screenshots. A "visual-value assertion" is any existing unit or end-to-end assertion that pins a colour, font, shadow or timing value, or the landing page's wording and sections (which the scope change of 2026-10-29 frees). Known ones: the dark background colour and the landing animation delay in the landing end-to-end spec, the landing page's text and section assertions in the landing component and end-to-end specs, and the display font, its fontsource import, the landing glow and the colour token names in the frontend `tests/design-tokens.test.ts`. Such assertions are updated openly in the pull request that changes the look, each changed assertion listed in the pull request description; behaviour checks are never touched. Adding colour pairs to the contrast test counts as strengthening, not weakening.

Delivery (clarify-prd, 2026-10-28): the redesign ships as one pull request per screen, the shared design values first. Test edits, screenshots and owner approval are per pull request. AC-15 and the 4-of-4 targets in §6 and §7 are checked once the last screen has merged; until then dev shows a mixed old and new look.

Clarified (clarify-prd, 2026-10-29):
- The stylesheet guard (shared design values and motion) scans a list of stylesheets that grows with each screen's pull request: the first pull request starts the list, each screen pull request adds its own stylesheet (RED first, then GREEN for it), and the last task widens the scan to every stylesheet.
- A "raw value" is a colour literal (hex, rgb, hsl, or a named colour other than transparent and currentColor) or a length literal in a font-size, spacing, radius or shadow property. A short allow-list accepts 0, auto, percentages, 1 px borders and media-query breakpoints; the 1200 px content limit lives in a design value. The guard covers every stylesheet under `src/` except the file that defines the design values.
- Selector-only edits to behaviour specs are allowed when a class name is renamed (for example the landing end-to-end spec's `.landing-preview`); each is listed in the pull request description like a visual-value assertion, and no expectation of any behaviour check changes.
- The landing page is always dark, whatever the device's light or dark setting; it has no light variant (owner, 2026-10-29, after architecture-design found that a browser reports "no preference" as light, so "dark only when no preference" could not be built). Sign-up, sign-in, the cabinet and the crash screen follow the device's light or dark setting; a device that states no preference gets their light theme. The landing end-to-end background assertion runs with the device emulated as light and as dark and expects the dark background in both.
- Every existing action of every screen stays available at every width and keeps an accessible name. The cabinet's sidebar may collapse behind one toggle on a phone; no other action is hidden or moved behind a second step. (Supersedes the 2026-10-29 reading "no new toggle or menu, no icon-only controls", which the Mantis sidebar scope change makes obsolete.)
- Fonts and images are free to choose but must be free-licence or drawn by us, self-hosted, and each listed with its licence in the pull request; no paid asset and no request to a third-party font or image host (§6). (Supersedes "only the font weights already imported".)

Decision override: goal 3 (owner approval from screenshots) has no user story — overridden by author, rationale: approval is a delivery step, not a product behaviour, and the glossary has no role for the approver; it is measured in §6 and §7 instead. Decision override: the question of which exact template pages are the reference for each screen moves from "before write-prd" to "before /sdlc-break-tasks" — overridden by author, rationale: the split by screen is decided, and the exact pages are needed only when the first screen task is designed.

## 2. Goals

- Visitors and users see a modern look on all four screens, each matching its reference (DarkSaaS for the landing page, Mantis for the rest), joined by one brand mark and one system of design values; the landing page is dark, the other screens come in both the light and the dark theme.
- Every existing function and flow of the four screens works exactly as before.
- Each screen's new look is approved by the owner from before-and-after screenshots, so the work has a clear finish line.

## 3. Non-goals

- New features or behaviour changes — each would need its own PRD and acceptance criteria.
- Copying template code, fonts or images, using paid assets, or adding a component library, now or later — licence risk, and the decision to port the look only; icons, components and illustrations are drawn in our own styles or come from free-licence sources.
- New functions behind new landing content: new landing sections, visuals and wording are allowed, but any new call to action leads only to the existing sign-up or sign-in, and no new data is collected or tracked.
- Backend, API, analytics or conversion-tracking changes — the redesign is visual only.
- New screens, a manual theme switch, or an account or profile area — none exists today and each would be a new feature.

## 4. User stories

### US-01: See the redesigned landing page

**As a** visitor
**I want** the landing page in the new DarkSaaS-style look, with a hero and the ways to start
**So that** the product looks credible at first sight

### US-02: Sign up on the redesigned screen

**As a** visitor
**I want** the sign-up screen in the same look
**So that** creating an account feels like the same product

### US-03: Sign in on the redesigned screen

**As a** visitor
**I want** the sign-in screen in the same look, including its error messages
**So that** a failed attempt is as clear as before

### US-04: Work in the redesigned cabinet

**As a** user
**I want** to create, rename and delete projects, add tasks, change task status, filter by task status and sign out in the new look
**So that** my daily work is unchanged but looks finished

### US-05: Use any screen on a phone

**As a** visitor or user on a small phone screen
**I want** every screen to fit without sideways scrolling
**So that** the demo works on a phone

### US-06: Keep my device's theme

**As a** visitor or user
**I want** sign-up, sign-in and the cabinet to follow my device's light or dark setting, and the always-dark landing page, with text that stays readable
**So that** the redesign does not force a theme on me

### US-07: Navigate by keyboard and without motion

**As a** visitor or user
**I want** a visible focus indicator on every control and no animation when my device asks for reduced motion
**So that** the redesign does not lock me out

### US-08: Recognise one product across screens

**As a** visitor who signs up and becomes a user
**I want** the same brand mark and the same system of design values from the landing page to the cabinet
**So that** the product reads as one even though the landing page and the cabinet follow different references

## 5. Acceptance criteria

### AC-01 (US-01) — happy path

**Given** a visitor who is not signed in
**When** the visitor opens the landing page
**Then** the page appears in the new look with a hero, a description of what the product offers and both ways to start (sign up and sign in), whose wording and extra sections are free to change, and shows no projects or tasks

### AC-02 (US-01) — cross-context

**Given** the app is configured without a Google sign-in client
**When** a visitor opens the landing page
**Then** the page offers only the email ways to start and mentions Google nowhere, whatever wording or sections the new landing page has

### AC-03 (US-02) — happy path

**Given** a visitor on the sign-up screen
**When** the visitor submits a new email with a matching password and confirmation
**Then** the account is created, the visitor lands in the cabinet, and the screen they leave is in the new look

### AC-04 (US-02) — error

**Given** a visitor on the sign-up screen
**When** the visitor submits an empty or invalid email, a short password or a confirmation that does not match
**Then** the screen shows a readable message next to each faulty field, in the new look, and creates no account

### AC-05 (US-03) — happy path

**Given** a visitor who has an account, on the sign-in screen
**When** the user submits the correct email and password
**Then** the user lands in the cabinet, as before the redesign

### AC-06 (US-03) — error

**Given** a visitor on the sign-in screen
**When** the visitor submits a wrong email or password
**Then** the screen shows the message "Wrong email or password." readably, in the new look, and keeps the visitor on the sign-in screen

### AC-07 (US-04) — happy path

**Given** a signed-in user in the cabinet
**When** the user creates a project, adds a task, renames the project, deletes a project that has no tasks, changes the task status, filters by task status and signs out
**Then** each action has the same result as before the redesign, and every screen state shown on the way is in the new look

### AC-08 (US-04) — domain invariant

**Given** a user whose project still has tasks
**When** the user tries to delete that project
**Then** the cabinet keeps the project and explains in a readable message that a project that still has tasks cannot be deleted

### AC-09 (US-04) — authorization

**Given** a visitor who is not signed in
**When** the visitor tries to open the cabinet
**Then** the visitor is taken to the sign-in screen and sees no projects or tasks

### AC-10 (US-04) — error

**Given** a signed-in user opens the cabinet while the list of projects cannot be loaded
**When** the cabinet reports the failure
**Then** the user sees a readable failure message in the new look, and the loading, empty-list and first-task guidance states are also shown in the new look when they apply; the application's crash screen, shown when a screen fails to render, has the new look and still tells the user in readable words that something went wrong

### AC-11 (US-05) — happy path

**Given** a screen that is 360 pixels wide, or 768 pixels wide
**When** a visitor or user opens the landing page, sign-up, sign-in or the cabinet
**Then** the whole content fits the width, with no sideways scrolling, and every action stays reachable: visible, or behind the one sidebar toggle of the cabinet, with an accessible name

### AC-12 (US-06) — happy path

**Given** a device set to the dark theme, or to the light theme
**When** a visitor or user opens any of the four screens
**Then** sign-up, sign-in and the cabinet appear in the matching theme, the landing page appears dark in both cases, and all text and controls are readable; a device that states no preference gets the light theme on sign-up, sign-in and the cabinet

### AC-13 (US-07) — happy path

**Given** a visitor or user who moves through a screen with the keyboard only
**When** focus lands on any link, button or field of the four screens
**Then** a visible focus indicator shows where the focus is; the Google sign-in button, drawn by Google, is excluded

### AC-14 (US-07) — happy path

**Given** a device that asks for reduced motion
**When** a visitor or user opens any of the four screens
**Then** no animation or transition declared by the application's own styles runs on the screen, so hover and focus changes are instant, and a loading state shows a static indicator instead of motion; widgets of other providers (the Google sign-in button) are excluded

### AC-15 (US-08) — domain invariant

**Given** the four screens after the redesign
**When** a visitor moves from the landing page to sign-up, sign-in and the cabinet
**Then** the same brand mark (the existing landing-page logo, reused on the sign-up, sign-in and cabinet headers; no new mark is designed) appears on every screen, and no screen of the application's own styles uses colours, type sizes, spacing, corner radii or shadows outside the design values (a "raw value" is defined in §1); the design values hold one dark palette and gradient set for the landing page and one palette for the other screens in a light and a dark theme, so the two palettes may differ; the Google sign-in button, drawn by Google, is excluded

### AC-16 (US-05) — happy path

**Given** a screen that is 1440 pixels wide
**When** a visitor or user opens the landing page, sign-up, sign-in or the cabinet
**Then** the main content column is centred with equal side margins and never wider than 1200 pixels, nothing is cut off, and every action stays visible; full-width backgrounds, header bars and the cabinet's sidebar may span the screen

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Text and control contrast, light and dark themes | ≥ 4.5:1 for all text (including button labels, status badge text and placeholder text); ≥ 3:1 for non-text parts (control borders and fills, focus rings, status icons); disabled controls exempt; on every foreground/background pair the new styles use (text over a gradient or translucent layer is checked against its worst-case background, computed by hand and listed) | existing design-token contrast test in the frontend CI, with every new pair added to its hand-kept list; the pull request reviewer checks the list covers each new colour pairing |
| Sideways scroll at phone and tablet width | 0 px of overflow at 360 px and at 768 px width on 4 of 4 screens | end-to-end width check on each screen |
| New runtime dependencies and assets | 0 component libraries and 0 paid assets; a self-hosted free-licence font package or image file is allowed, each named with its licence in the pull request | dependency list diff and file list in each pull request |
| Third-party font or image requests from the application's own styles | 0; the Google sign-in script and the button Google draws are excluded, and the check runs with Google configured and unconfigured | end-to-end network check on each screen; every font or image request started by the application's pages or styles fails the check, whatever the domain, and only requests started by Google's script or button are excluded |
| Behaviour regressions | 0 failing existing tests, none weakened or deleted, apart from the visual-value assertions defined in §1, each listed in the pull request | frontend unit and end-to-end suites in CI |
| Shared design values | 0 raw values (defined in §1) in screen stylesheets outside the design-value variables | a new frontend unit test over a list of stylesheets that grows with each screen's pull request and ends covering all of them (§1), written RED first |
| Reduced motion | 0 animation or transition declarations in the application's own styles under a reduced-motion setting, on 4 of 4 screens and the crash screen; motion is declared only where the device allows it, and any declaration under a reduced-motion setting fails the scan | frontend unit test over the stylesheets, on the same growing list |
| Visual approval | 4 of 4 screens approved by the owner | before-and-after screenshots at 360 px and 1440 px width, light and dark (the landing page is dark in both), attached to each screen's pull request, including its states: sign-up field errors, the sign-in wrong-credentials message, and in the cabinet the loading, empty-list, first-task guidance, filtered, load-failure and delete-refused states, plus one screenshot of the crash screen |

## 6.1 Security / privacy

- **Data classification:** public — the landing page and its styles are served to anyone; the cabinet shows only the signed-in user's own data, unchanged.
- **Personal data touched:** none — no new field is collected, stored or shown.
- **AuthZ/AuthN impact:** none — nothing is added or changed in who can see what.
- **Abuse cases:**
  - Copying licensed template assets: no template code, fonts or images enter the repository, now or later; only the general look is reused in our own styles.
  - Cabinet shown to a visitor: still denied; the visitor is sent to sign in (AC-09).
  - Third-party resources leaking visitor requests: none are loaded by the application's own styles; fonts stay self-hosted (§6). The Google sign-in script, loaded only when a Google client is configured, is the existing exception and does not change.
- **Security review:** N/A — no new authorization boundary and no new personal data; the change is visual only.

## 7. Metrics / KPIs

- **Screens on the new look, approved by the owner** — baseline: 0 of 4, target: 4 of 4 by 2026-11-30.
- **Colour pairs passing the contrast check in both themes** — baseline: 100% of the 15 pairs checked today, target: 100% of every pair the new styles use, checked in CI on every pull request.
- **Behaviour changes caused by the redesign** — baseline: 0, target: 0, measured by the existing frontend suites passing unchanged apart from the visual-value assertions defined in §1.
- **Screens fitting 360 px and 768 px width without sideways scrolling** — baseline: 1 of 4 at 360 px (landing only is checked today), target: 4 of 4 at both widths by 2026-11-30.

## 8. Open questions

- [x] Which exact pages of Mantis and DarkSaaS are the visual reference for each of the four screens? Default now: the dashboard and auth pages of Mantis; the landing page of DarkSaaS (taken as the default by the task breakdown, `tasks/_epic.md`); with the scope change of 2026-10-29 these are now full-look references, not layout rhythm only. Resolved (owner, 2026-10-29): the five HTML mockups of [design-spec.md](./design-spec.md) §13, approved as they are, are the reference for each screen. — owner: OlegShevtsov1
- [x] Which theme does the landing page show when the device states no preference, now that its reference is dark? Resolved (owner, 2026-10-29): the landing page is always dark, whatever the device setting, and has no light variant; a browser reports "no preference" as light, so "dark only with no preference" could not be built (architecture-design, `sad.md` §11). The other screens follow the device, light when it states no preference (AC-12). — owner: OlegShevtsov1
- [ ] Which typefaces, images and illustrations does the redesign use, and under which free licence? Default now: the current typefaces stay until a screen task proposes a change; every new font or image is self-hosted and its licence is listed in that pull request (§1, §6). — owner: OlegShevtsov1, due: before T3 (the base stylesheet task)
- [x] The architecture (`sad.md`, ADRs 0001–0004) and the tasks (done T1, T2, T4; T3, T5–T11) were written for one shared palette and layout rhythm only. Default now: they stay until refreshed; a scope-change refresh of the SAD, ADRs and tasks is needed. Resolved (2026-10-29): the SAD and ADR-0005, ADR-0006 were refreshed (#131); `/sdlc-break-tasks` replaced T5–T9 with T12–T20 against the approved design spec (`tasks/_epic.md`). — owner: OlegShevtsov1
- [x] Is DarkSaaS the intended "SaaSyDark"? Resolved (architecture-design, 2026-10-28; `sad.md`): yes. Updated for the owner's scope change of 2026-10-29: DarkSaaS is the full look reference for the landing page (dark background, gradients, accents, hero; new sections, visuals and wording allowed), not layout rhythm only; no template code is copied and no paid asset is used, and any font or image is free-licence and self-hosted (§1, §3). — owner: OlegShevtsov1
- [x] Which exact assertions pin old visual values and must be updated with the new look? Resolved (plan-tests, 2026-10-28; frontend scanned): `e2e/landing.spec.ts` lines 63 (body background `rgb(8, 9, 12)`) and 78 (preview `animation-delay` `0.24s`); `tests/design-tokens.test.ts` lines 99–103 (display font, its fontsource import and dependency), 119–121 (`--shadow-glow` hover rule) and 54–98 (colour token names and contrast pairs). No other pinned colour, font or shadow value was found in the unit tests. Any further one a screen task finds is listed in its pull request. Risk: `e2e/landing.spec.ts` selects `.landing-preview` and other landing class names, so the landing task keeps those class names or updates the selectors and lists them in its pull request. — owner: OlegShevtsov1

## Test plan

The tests live in the frontend repository (this feature has no backend code). Levels used: **unit** (stylesheet scans, contrast pairs), **component** (one screen rendered in isolation), **e2e-through-UI** (the flow driven through the rendered screens, with the Pilot API's answers shaped like the synced contract where a state needs forcing). Visual approval is the owner's review of per-PR screenshots (§6), not an automated baseline, so there is no visual-regression level. Contract and load levels are <!-- N/A: no API change, no numeric throughput NFR -->. Existing suites run unchanged; only the visual-value assertions defined in §1 are updated, each listed in its pull request.

### AC coverage

| AC | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 | landing page shows a hero, a description of the product and both ways to start, and no projects or tasks | component + e2e-through-UI | hero and both ways to start present and leading to sign-up and sign-in, no project or task shown (wording and extra sections are free) |
| AC-02 | landing page without a Google client offers only the email ways to start | component + e2e-through-UI | no mention of Google anywhere on the page |
| AC-03 | sign-up with a new email and matching passwords lands in the cabinet | e2e-through-UI | account created, cabinet shown |
| AC-04 | sign-up with an invalid email, a short password or a mismatched confirmation is refused | component + e2e-through-UI | a readable message beside each faulty field, no account created |
| AC-05 | sign-in with correct credentials lands in the cabinet | e2e-through-UI | cabinet shown |
| AC-06 | sign-in with wrong credentials shows "Wrong email or password." | component + e2e-through-UI | that exact message shown, visitor stays on sign-in |
| AC-07 | cabinet actions (create project, add task, rename, delete empty project, change status, filter, sign out) keep their results | e2e-through-UI | same result as before the redesign at every step |
| AC-08 | deleting a project that still has tasks is refused with an explanation | e2e-through-UI | project kept, readable message that a project with tasks cannot be deleted |
| AC-09 | visitor opening the cabinet is sent to sign-in | e2e-through-UI | sign-in screen shown, no projects or tasks visible |
| AC-10 | cabinet shows a readable failure when projects cannot load; loading, empty-list and first-task states render | component + e2e-through-UI | failure message and each state shown; crash screen shows a readable failure message |
| AC-11 | four screens at 360 px and 768 px do not scroll sideways | e2e-through-UI | no horizontal overflow, every action reachable |
| AC-12 | every colour pair the styles use passes contrast in light and dark; sign-up, sign-in and the cabinet follow the device theme, the landing page stays dark | unit + e2e-through-UI | ≥ 4.5:1 text and controls, ≥ 3:1 focus and status marks; matching theme applied, landing dark under both emulations |
| AC-13 | keyboard focus on any link, button or field shows a visible indicator | e2e-through-UI | indicator visible on every control of the four screens |
| AC-14 | no animation or transition declaration of our own styles under reduced motion | unit + e2e-through-UI | none declared; hover and focus changes instant on the four screens and the crash screen |
| AC-15 | screen stylesheets use only the shared design values; one brand mark on all headers | unit + e2e-through-UI | no raw colour, size, spacing, radius or shadow outside the variables (written RED first); same logo on sign-up, sign-in, cabinet |
| AC-16 | four screens at 1440 px stay centred and at most 1200 px wide | e2e-through-UI | content centred, not wider than 1200 px, nothing cut off, every action reachable |

### AC → task map

Which task of `tasks/tasks.json` writes the tests for each criterion (the screen tasks add their checks in their RED commit):

| AC | Tasks |
|---|---|
| AC-01, AC-02 | T14 (hero, palette), T15 (sections) |
| AC-03, AC-04 | T16 |
| AC-05, AC-06 | T17 |
| AC-07, AC-09 | T18 (shell), T19 (cards and states) |
| AC-08 | T19 |
| AC-10 | T19 (cabinet states), T20 (crash screen) |
| AC-11, AC-13, AC-16 | T4 (helpers), T3, T14–T20 (per screen), T10 (sweep) |
| AC-12 | T2, T13 (contrast pairs, landing palette), T12, T4, T14–T20, T10 |
| AC-14 | T1 (motion scan), T3, T4, T14–T20, T10 |
| AC-15 | T1, T2, T3 (guard and brand mark), T10 (all stylesheets, brand mark on every header) |

### Edge cases / error paths

- Sign-up with an empty email → expected: readable message beside the email field, no account.
- Sign-up with a password shorter than the minimum → expected: readable message beside the password field.
- Sign-up with a confirmation that does not match → expected: readable message beside the confirmation field.
- Sign-in with an unknown email and with a known email and wrong password → expected: the same "Wrong email or password." message in both cases.
- Project list request fails → expected: readable failure message in the new look, no stale projects shown.
- Rendering of a screen fails → expected: crash screen with a readable failure message, in the new look.
- Unknown address → expected: landing page, as before.
- Google client configured and not configured → expected: no third-party font or image request from our own styles in either case; Google's script and button excluded (§6).

### Test data

- Seed: users, projects and tasks come from the API answers the existing end-to-end specs already plant (a stored token pair before the page loads, route answers shaped like the synced contract for the cabinet's states); no new fixture format.
- Dependency: none owned by this feature; the real-API check in the existing end-to-end API spec stays as it is. No datastore is mocked because none is touched.
- Cleanup: per test; each test starts with empty browser storage and its own planted state.

### CI placement

- On every pull request: unit (stylesheet scans, contrast pairs), component, and the existing frontend suites.
- With each screen's pull request and after merge to dev: e2e-through-UI width, theme, focus, reduced-motion and third-party-request checks against a local preview, or dev after merge; owner screenshots (360 px and 1440 px, light and dark) attached to the pull request.
- AC-15 and the 4-of-4 targets are checked once the last screen has merged (§1).
