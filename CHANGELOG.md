# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions come from the
`Type:` line of each squash commit (`scripts/next-version.sh`); a release moves `[Unreleased]` to
`## [X.Y.Z] - YYYY-MM-DD`. Each section names the minimum backend version it needs, which must equal
`deploy/min-be-version`.

## [Unreleased]

Minimum backend version: v0.3.0

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.4.0] - 2026-10-30

Minimum backend version: v0.3.0

### Added

- Privacy policy (`/privacy`) and terms of use (`/terms`) pages for publishing Google sign-in (PILOT-419), linked
  from the footer of the landing, sign-in and sign-up pages; the contact address comes from the new optional runtime
  value `SUPPORT_EMAIL` (empty shows a generic contact line).

### Changed

- Redesign sweep (PILOT-386): the stylesheet guard now scans every stylesheet under `src/` (except the design
  values) instead of a hand-kept list, and one end-to-end check walks the landing page, sign-up, sign-in, the
  cabinet and the crash screen for the same brand mark, widths at 360, 768 and 1440 px, theme, focus, reduced motion
  and no font or image from another origin.
- Design values rewritten for the redesign (PILOT-378): a blue-led palette in the light and the dark theme, new roles
  for muted surfaces, strong borders, soft error backgrounds, type weights and sizes, spacing, radii and motion
  timings, and a 1200 px cap on the content width. Every colour pair the styles use is checked for contrast in both
  themes, and a new stylesheet guard rejects raw colours, sizes and unguarded motion.
- Shared page shell and controls (PILOT-379): one `base.css` with the page shell, header, brand mark, buttons, links,
  inputs, alerts and a single keyboard focus ring, replacing `index.css`; the landing page and the cabinet header
  use the same brand mark component.
- Landing page, part 2 (PILOT-442): the feature cards with their icons in violet tiles under a "Features" eyebrow and
  a sub-line, a new "How it works" section with three steps, a final call-to-action card that says projects and tasks
  are visible only to their owner, and a footer bar with the brand beside the legal links on the landing and legal
  pages; four features across at 1440 px, two at 768 px and one on a phone.
- Landing page, part 1 (PILOT-441): the landing page and the privacy and terms pages are always dark in the violet
  landing palette, whatever the device theme; a full-width header bar over a faint grid, and a hero with the badge
  "Personal projects and tasks", the gradient headline, calls to action in the accent gradient with a glow, and the
  dashboard preview with status chips over a glowing orb that pulses only when the device allows motion. Links in
  the legal text read in the lighter violet.
- Design values for the redesigned screens (PILOT-440): one always-dark `.palette-landing` block of the same role names
  with a violet accent, the hero, accent, title, orb and grid gradients and a glow shadow; soft status fills for
  status chips and a scrim for the phone drawer in both themes. No screen uses them yet, so nothing looks different.
- Body text is set in Public Sans (PILOT-439), self-hosted from `@fontsource-variable/public-sans` 5.3.0 (SIL Open
  Font License 1.1) with the system font stack as fallback; headings and the brand stay in Space Grotesk.
- Crash screen restyled (PILOT-447): the page shell with the brand mark at the top, a drawn illustration and
  "Something went wrong." in the display face, with "The error was reported." as a quieter second line when it
  applies; its text, its alert role and the absence of any action are unchanged.
- Cabinet shell in the Mantis dashboard layout (PILOT-445): from 768 px a 280 px sidebar (brand, New project, a
  "Projects" caption over All projects and each project with its task count, the shortcuts hint, Sign out) and a
  64 px top bar holding the search; on a phone the sidebar opens as a drawer under the top bar, over a scrim, from
  the "Projects menu" toggle, now an icon button that shows a close icon while open. Shortcuts, focus return and
  every action are unchanged; `Dashboard.css` joins the stylesheet guard.
- Cabinet cards and states in the Mantis layout (PILOT-446): a filter card with the status chips and the Task status
  select, one card per project with Rename and Delete in its head, task rows with a coloured status chip and their
  two "Mark …" buttons (wrapping under the task on a phone), and Add task; the guidance, no-match and load-failure
  cards with drawn illustrations, a static loading ring with placeholder cards, error alerts for a refused delete
  and a failed status change, and the new-project form as a card. Every state text and accessible name is unchanged.
- Sign-up in the Mantis auth layout (PILOT-443): the brand at the top left, one centred card with "I already have an
  account" in its head, an "or with email" divider when Google sign-in is offered, field messages with an icon, an
  info alert for "Your account was created." and a full-width button; `base.css` gains outline, text, small and
  full-width buttons and the info alert. Fields, wording and behaviour are unchanged.
- Sign-in in the same auth layout (PILOT-444): "Create an account" in the card head, the "or with email" divider only
  when Google sign-in is configured, and "Wrong email or password." as an error alert above the full-width button.
  Fields, wording and behaviour are unchanged.
- Dashboard redesigned in style A: a project sidebar that filters the list (a drawer below 768 px), dense task
  rows with status icons and hover actions, status chips, a search box, the `n` (new task) and `/` (search)
  shortcuts, a skeleton while loading, a retry after a failed load, and empty states with a call to action.
  Each project shows one "+ Add task" button that opens its task fields, and "New project" opens the project form;
  Escape or Cancel closes either form.
- AI review (PILOT-369, decision 103 a): posts a GitHub pull request review as github-actions (request changes on
  P0/P1, otherwise a comment) with inline comments on the changed lines instead of an issue comment, dismisses its
  earlier request for changes once clean, lists every P0/P1 finding in the job log, and reviews factory PRs too.

### Fixed

- Signing out right after the app renewed an expired session now revokes this device's tokens on the server;
  before, the sign-out could present the already-renewed refresh token, be refused, and leave that device's
  tokens valid (PILOT-287).
- `deploy/min-be-version` now declares backend v0.3.0, the first release with the token endpoint and sign-out this
  frontend calls; it said v0.1.0, so the release-order check let a prod deploy through next to a backend without
  them (PILOT-313).
- The sign-up message for an email that already has an account no longer suggests Google sign-in when Google
  sign-in is not offered (no `GOOGLE_CLIENT_ID`); it says to sign in with the password (PILOT-357).
- The AI review matches the 1_mvp_sdlc fe template again (PILOT-369, decision 103): a clean run, also a re-run on
  the same head, dismisses every earlier request for changes of the bot, that head's own included, and retries a
  dismissal that failed; findings on files whose paths git quotes or that contain spaces are anchored inline; each
  finding is listed once, the review body and inline comments are capped below GitHub's size limit, and only reviews
  carrying the `<!-- ai-review -->` marker count as the AI review's own (template PILOT-399).

### Security

- The public `/config.js` no longer publishes the GlitchTip DSN with its private address on dev and prod: it
  serves the same key and project on the `API_URL` origin, events still go through the backend tunnel, and a
  private address stops the container instead of being served (PILOT-393, decision 107 8' a).

## [0.3.1] - 2026-10-27

Minimum backend version: v0.1.0

### Fixed

- The landing page no longer offers Google sign-in when `GOOGLE_CLIENT_ID` is empty; it offers sign-up and sign-in
  with email and password instead.

## [0.3.0] - 2026-10-27

Minimum backend version: v0.1.0

### Added

- Landing page that explains the app and offers Google or email sign-up; client-side routing and the first
  shared design tokens.
- API client that sends the access token, refreshes it once on expiry and signs out on a refused refresh; token
  store in localStorage; `GOOGLE_CLIENT_ID` and `OAUTH_CLIENT_ID` in `/config.js`.
- Sign-up and sign-in screens with email and password: field errors, a taken email points to sign-in, one
  message for a wrong email or password, and a wait message when attempts are limited.
- Google sign-in button on the sign-in and sign-up screens: exchanges the Google ID token for this device's token
  pair and opens the dashboard; a refused or cancelled Google step says sign-in did not complete.
- Dashboard with the user's projects and their tasks, a task status filter, and project create, rename and
  delete; signed-out visitors are sent to sign-in.
- Tasks: add a task to a project (it starts not started) and change its status in one click; a user with no
  projects is guided to a first project and a first task; a sign-out button that ends this device's session
  and opens sign-in.

### Changed

- Landing page with a hero, a visual and clear calls to action; shared design tokens for colour, type, spacing,
  radius and shadow, and a dark theme that follows the system setting.
- Landing page redesigned in style A (dark tech): a header with a sign-in link, a hero with a dashboard preview,
  four feature cards and a final call to action; style A design tokens with task status colours, an accent glow
  and the self-hosted Space Grotesk display font; the debug footer (API URL, environment, API status) shows on dev
  only.

### Fixed

- A sign-up answered without a token pair (no web client configured on the deploy) says the account was created
  and links to sign-in instead of reporting a failure.

### Security

- nginx sends a strict Content-Security-Policy: scripts only from the app and Google's sign-in script, no inline
  script, connections only to the app, the API and Google.
- Test tooling bumped for new npm advisories: undici 8.12.1 → 8.12.3 (via jsdom; GHSA-4qv8-2p9j-2685,
  GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c) and vitest 4.1.11 → 4.1.12 (GHSA-qxg6-89mg-rqv8,
  GHSA-xp26-3454-mjgp); dev dependencies only, the shipped bundle is unchanged (PILOT-310).

## [0.2.0] - 2026-10-21

Minimum backend version: v0.1.0

### Added

- Prod deploy from the public mirror (decision 43): Kamal Deploy takes `source_sha` when `vars.MIRROR`
  is `true`, checks the (version, source_sha) pair against `MIRROR_SOURCE.json` and promotes the
  primary's image `sha-<source_sha>`; develop-guard is skipped on the mirror.
- The release-order check (`deploy/min-be-version`) reads the public backend mirror when running on
  the mirror or without `BE_REPO_READ_TOKEN`.

## [0.1.0] - 2026-10-16

Minimum backend version: v0.1.0

### Added

- Runtime config from `/config.js`, written when the container starts: one image for every
  environment.
- Error reporting through the backend tunnel `<API_URL>/api/errors`, with an error boundary page.
- Dev deploy from `develop` and `hotfix/*`, and prod deploy of the same image with Kamal over the
  VPN, promoted without a rebuild.
- Release pipeline: versions from the `Type:` line, this changelog, draft GitHub Releases for
  annotated `v*` tags on `main`, prod deploys only from such a tag after the backend it needs,
  and a 10-minute release watch of prod health and new errors.
- `index.html` is revalidated on every load, so a new release is picked up without a hard refresh.
