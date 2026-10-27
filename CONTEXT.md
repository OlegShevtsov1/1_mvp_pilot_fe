---
status: Living
updated_at: "2026-10-15"
---

# Domain Context — 1_mvp_pilot_fe

## Glossary

- API status — the health the backend reports for itself, shown in the debug footer on dev only (`ok`,
  `unreachable`, `not configured`). NOT the health of the frontend container, which answers on its own `/health`.
- APP_CONFIG — the runtime config as the browser receives it, a global object set by `/config.js` before the app
  starts. NOT the app's own config value, which fills in defaults for missing fields.
- App version — the image tag the app runs as: `sha-<git sha>` on dev, `prod-sha-<git sha>` on prod; also the
  release of every reported error. NOT the package version, which never changes.
- Build once — one image built per commit and promoted unchanged from dev to prod. NOT a rebuild per
  environment; only the runtime config differs between environments.
- Environment name — the name of the environment the app runs in (`dev`, `prod`, `local`), taken from the
  runtime config. NOT the deploy destination's host name.
- Error test — a deliberate error triggered by a URL parameter, with a marker that makes the reported event easy
  to find. NOT a real fault; it exists only to check error reporting end to end.
- Error tunnel — the backend endpoint `<API URL>/api/errors` that forwards error reports to the error tracker.
  NOT the error tracker itself, which the browser never contacts.
- Google sign-in — signing in by proving ownership of a Google account; it links to an existing user of the same
  email (ignoring capital letters) and cancels that user's password and all existing access (ADR-0004). NOT
  Google's own sign-in step, which only yields the ID token the backend exchanges for this device's access token.
- Runtime config — the backend URL, error-reporting key, environment name and app version, decided when the
  container starts. NOT build-time settings; nothing environment-specific is compiled into the bundle.
- Spec copy — a read-only copy of a feature's specs from the backend repository under `docs/features/<slug>/`.
  NOT an editable spec; changes are made in the backend repository and copied again.

## Invariants

- No environment value (host, key, environment name) is ever baked into the bundle.
- The browser never calls the error tracker directly; errors go only through the error tunnel.
