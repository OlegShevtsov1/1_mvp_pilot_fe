---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@f8d0b86d06ead4db12af522fa3497992646bd2d0:docs/features/todolist/adr/0002-client-side-spa-in-existing-react-app.md by sync-spec. Do not edit here. -->

# 0002 — Deliver the screens as a client-side SPA inside the existing React app

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

ADR-0001 adds a web-frontend surface. `1_mvp_pilot_fe` is a React 18 + Vite 6 single-page app served as static files by
nginx, with a runtime `/config.js`, no router, no state library and no design system; nginx already falls back to
`index.html` for unknown paths (`1_mvp_pilot_fe/docs/architecture-map.md`). The feature needs a landing page, sign-up
and sign-in screens and a dashboard.

## Decision drivers

- About two weeks of backend work; the frontend should not add a new runtime or deploy shape (sad.md §2).
- QG-3 responsiveness of the journey.
- PRD AC-01 (landing), AC-21 (guided dashboard).

## Considered options

1. **Client-side SPA in the existing app** — add client-side routing for landing, sign-in and dashboard.
2. **Static landing page plus the SPA** — a pre-built HTML landing page served by nginx, the SPA behind it.
3. **Server-rendered app** — replace the static SPA with a server-rendered framework.

## Decision outcome

**Chosen:** option 1. It reuses the existing build, image and deploy unchanged and needs only a router; the indexing
benefit of options 2 and 3 is not a PRD goal for this release.

## Consequences

**Positive**
- No new runtime and no change to the frontend's deploy unit or shape; `/config.js` gains one public value
  (`GOOGLE_CLIENT_ID`) and nginx sends a Content-Security-Policy header (sad.md §7).
- One codebase for landing and dashboard.

**Negative**
- The landing page is rendered in the browser, so search engines index it less well.
- A router dependency is added to the frontend (a new dependency needs a reason in its pull request).

**Neutral**
- The frontend has no design system; this feature introduces its first shared tokens file and components in plain CSS,
  matching the existing styling approach.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0001-build-todolist-as-backend-api-plus-web-spa]]
