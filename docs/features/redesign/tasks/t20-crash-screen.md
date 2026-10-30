---
id: T20
title: "Crash screen with the brand, a drawn illustration and the message in the display face"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T4", "T12"]
acs: ["AC-10", "AC-11", "AC-12", "AC-14", "AC-15"]
files_hint: ["src/ErrorFallback.tsx", "src/ErrorFallback.test.tsx", "src/styles/base.css", "e2e/crash-screen.spec.ts"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t20-crash-screen.md by sync-spec. Do not edit here. -->

# T20 — Crash screen with the brand, a drawn illustration and the message in the display face

## Why

Derives from [PRD AC-10](../PRD.md), [sad §5, §6 Crash screen](../sad.md); [design spec](../design-spec.md) BR-11, BR-18 and the approved crash mockup.

## What

- RED: in `ErrorFallback.test.tsx` expect the brand mark (not a link) and a decorative, `aria-hidden` illustration, with the `alert` role and its readable text unchanged for the reported and unreported variants; add `e2e/crash-screen.spec.ts` (through the existing error-test trigger) with width, theme and reduced-motion checks.
- GREEN: wrap the alert in the `.page` shell with the brand, an inline SVG illustration drawn in our code and "Something went wrong." in the display face, "The error was reported." as a second line when it applies. No stylesheet of its own: any rule it needs goes into `base.css` with design values only. No action added.

## Definition of Done

- [ ] `ErrorFallback.test.tsx` fails first, then passes; the alert's accessible text is the same as before for both variants
- [ ] Crash-screen e2e passes in light and dark, at 360 and 1440 px and under reduced motion
- [ ] One screenshot of each variant attached; owner approval requested on the PR

## Notes

It renders inside `Sentry.ErrorBoundary` outside the router, so `BrandMark` is used without a link. Shares `base.css` with T16; if both are open at once, the second rebases. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
