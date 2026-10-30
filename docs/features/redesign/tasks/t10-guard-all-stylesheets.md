---
id: T10
title: "Guard every stylesheet and check the brand mark and widths across all screens"
layer: "tests"
repo: 1_mvp_pilot_fe
type: test
deps: ["T15", "T17", "T19", "T20"]
acs: ["AC-11", "AC-12", "AC-14", "AC-15", "AC-16"]
files_hint: ["tests/stylesheets.test.ts", "e2e/redesign-sweep.spec.ts"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t10-guard-all-stylesheets.md by sync-spec. Do not edit here. -->

# T10 — Guard every stylesheet and check the brand mark and widths across all screens

## Why

Closes [PRD AC-15](../PRD.md) and the 4-of-4 targets of [PRD §6, §7](../PRD.md), which are checked once the last screen has merged ([PRD §1](../PRD.md) Delivery).

## What

- Replace `GUARDED` with a scan of every `.css` file under `src/` except `src/styles/tokens.css`; a test that fails when a new stylesheet appears and is not scanned.
- Add `e2e/redesign-sweep.spec.ts`: moving from the landing page to sign-up, sign-in and the cabinet, and on the crash screen, shows the same brand mark; every screen passes width at 360, 768 and 1440 px, focus and reduced motion; the landing page is dark under light and dark emulation while the other screens follow the device (light with no preference); no font or image request leaves the app's origin (Public Sans and Space Grotesk are bundled, ADR-0006).

## Definition of Done

- [ ] The all-stylesheets scan is green on `develop` with every screen merged, and a deliberately added raw colour in a scratch stylesheet makes it fail (checked locally, not committed)
- [ ] Sweep spec green on 4 of 4 screens plus the crash screen at 360 px, 768 px and 1440 px: the same brand mark on each, the landing page dark under both emulations, the other screens in the device theme, and no font or image request leaving the app's origin
- [ ] `npm test`, `npm run e2e`, lint and typecheck clean

## Notes

Re-checked in the 2026-10-29 breakdown: still needed, deps now point at the last task of each screen (T15 landing, T17 sign-in, T19 cabinet, T20 crash). Test-only change; it is the earliest point where AC-15 can be called met. PR `Type: test`.
