---
id: T18
title: "Cabinet, part 1: Mantis shell with the 280 px sidebar, the top bar with the search and the phone drawer"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T4", "T13"]
acs: ["AC-07", "AC-09", "AC-11", "AC-12", "AC-13", "AC-14", "AC-15", "AC-16"]
files_hint: ["src/routes/Dashboard.tsx", "src/routes/Dashboard.css", "src/routes/Dashboard.test.tsx", "e2e/dashboard.spec.ts", "tests/stylesheets.test.ts"]
owner: "OlegShevtsov1"
estimate: "L"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t18-cabinet-shell.md by sync-spec. Do not edit here. -->

# T18 — Cabinet, part 1: Mantis shell with the 280 px sidebar, the top bar with the search and the phone drawer

## Why

Derives from [PRD AC-07, AC-09, AC-11](../PRD.md), [sad §5, §6 Open the cabinet](../sad.md), [ADR-0003 amendment](../adr/0003-switch-token-values-first-then-restyle-one-screen-per-pr.md) (the shell and the states may be two tasks); [design spec](../design-spec.md) BR-07, BR-08, BR-18 and the approved cabinet mockup.

## What

- RED: add `src/routes/Dashboard.css` to `GUARDED`; in `Dashboard.test.tsx` expect the "Projects" caption inside the `nav` labelled "Project navigation", the brand mark in the sidebar head, the search before the content and the toggle still named "Projects menu" with `aria-expanded`; in the cabinet e2e (stubbed with the T4 helpers) at 360 px open the drawer from the toggle, check the toggle stays reachable and Escape closes it, and run width, theme, focus and reduced-motion checks.
- GREEN: at ≥ 768 px a 280 px sidebar (brand, New project, caption, All projects and each project with its task count, the shortcuts hint, Sign out) and a 64 px top bar holding the search (same id, name and `/` shortcut); below 768 px the drawer opens under the top bar with the `--color-scrim` scrim, the toggle becomes an icon button that keeps its accessible name and shows a close icon when open, and the search sits above the content.
- No action moves behind a second step; keyboard shortcuts and focus return unchanged.

## Definition of Done

- [ ] `Dashboard.css` guarded: RED first, then green
- [ ] `Dashboard.test.tsx` behaviour assertions pass unchanged (AC-07: every action keeps its result; AC-09: a visitor without tokens is sent to sign-in); changed assertions listed
- [ ] Cabinet e2e: drawer opens and closes from the one toggle at 360 px, no overflow at 360, 768 and 1440 px, both themes, focus and reduced motion
- [ ] Screenshots of the shell with the drawer closed and open at 360 px and at 1440 px, light and dark

## Notes

Split from the old T8 per the ADR-0003 amendment: this task takes the shell; T19 takes the cards and the states. If the diff passes 500 changed lines, move the drawer to its own task rather than growing it. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
