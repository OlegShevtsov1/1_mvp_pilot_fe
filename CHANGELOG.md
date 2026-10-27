# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Versions come from the
`Type:` line of each squash commit (`scripts/next-version.sh`); a release moves `[Unreleased]` to
`## [X.Y.Z] - YYYY-MM-DD`. Each section names the minimum backend version it needs, which must equal
`deploy/min-be-version`.

## [Unreleased]

Minimum backend version: v0.1.0

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

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
