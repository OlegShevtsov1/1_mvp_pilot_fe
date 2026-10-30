---
id: T4
title: "Add the end-to-end visual-check helpers: width, theme, focus, reduced motion, third-party requests and cabinet stubs"
layer: "tests"
repo: 1_mvp_pilot_fe
type: test
deps: []
acs: ["AC-11", "AC-12", "AC-13", "AC-14", "AC-16"]
files_hint: ["e2e/support/"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t4-visual-check-seam.md by sync-spec. Do not edit here. -->

# T4 — Add the end-to-end visual-check helpers: width, theme, focus, reduced motion, third-party requests and cabinet stubs

## Why

Derives from [sad §8](../sad.md) (Visual-check seam) and [sad §10 QG-1, QG-3, QG-4](../sad.md); precedent `e2e/landing.spec.ts`.

## What

- New files only under `e2e/support/`: reusable checks that take a page and a screen path: no sideways overflow at 360 px and 768 px (`scrollWidth` not larger than `clientWidth`), page shell at most 1200 px wide with equal margins at 1440 px, matching theme via `emulateMedia({ colorScheme })`, focus outline style not `none` and width not `0px` on every link, button and field, `animation-name` of `none` under `emulateMedia({ reducedMotion: 'reduce' })`, and a request-host recorder that fails on a third-party font or image request (Google's script and button excluded; run with and without a Google client in the runtime config).
- A cabinet stub helper: plants a stored token pair before the page loads and answers the projects request with `page.route`, shaped like the synced contract types, for the states loading, empty list, first-task guidance, filtered, load failure and delete refused. `e2e/api.spec.ts` keeps exercising the real API and is not changed.
- A tiny spec that exercises the helpers against the current landing page, so the helpers themselves are proven (RED first: helpers missing).

## Definition of Done

- [ ] Helpers fail first (RED commit), then the helper spec passes against the landing page at `E2E_BASE_URL`
- [ ] Each helper can be reused by a screen spec with one call; the stubs reuse the app's existing contract types, no new fixture format
- [ ] `npm run e2e` and lint clean; no new dependency

## Notes

No overlap with `e2e/landing.spec.ts` (T2 edits one assertion there). Runs in parallel with T1 and T2. The screen tasks call these helpers from their own specs.
