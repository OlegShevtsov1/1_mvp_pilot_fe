---
id: T1
title: "Add the stylesheet guard for design values and motion, starting with App.css"
layer: "tests"
repo: 1_mvp_pilot_fe
type: test
deps: []
acs: ["AC-14", "AC-15"]
files_hint: ["tests/stylesheets.test.ts", "src/App.css"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t1-stylesheet-guard.md by sync-spec. Do not edit here. -->

# T1 — Add the stylesheet guard for design values and motion, starting with App.css

## Why

Derives from [ADR-0002](../adr/0002-guard-design-values-and-motion-with-a-vitest-stylesheet-scan.md), [PRD §6](../PRD.md) (Shared design values, Reduced motion) and [sad §10 QG-2, QG-3](../sad.md). It is the RED-first unit test every later screen task builds on.

## What

- Add `tests/stylesheets.test.ts`: a scanner that reads a CSS file as text, strips comments and reports, with file, selector and declaration, any colour literal, any length literal in font-size, margin, padding, gap, inset, border-radius, box-shadow and text-shadow, and any `animation` or `transition` outside `@media (prefers-reduced-motion: no-preference)`. The allow-list (`0`, `auto`, percentages, keywords, `@media` preludes) is written in the test; the test also lists what it does not cover.
- The real scan runs over a **guarded list** of stylesheets (`GUARDED`), not over every file yet: screen stylesheets that still hold old values cannot be scanned until their screen task restyles them (ADR-0003 delivery order). The list starts with `src/App.css` and **grows by one entry in the RED commit of each screen task** (T3, T5, T6, T7, T8); T10 replaces it with a scan of every `.css` file under `src/` except `src/styles/tokens.css`.
- Scanner unit tests run on small inline fixtures (a raw hex, an `rgb()`, a named colour, `transparent` and `currentColor` accepted, a raw `font-size`, a `transition` outside and inside the reduced-motion media block).
- GREEN: move the raw values of `src/App.css` (the dev-only footer) onto existing `var(--…)` names so the guarded list passes.

## Definition of Done

- [ ] `tests/stylesheets.test.ts` fails first (RED commit) because the scanner and the real `App.css` scan fail, then passes (GREEN commit)
- [ ] Fixture tests show each rule failing on a bad sample and passing on a good one; a failure message names the file, the selector and the declaration
- [ ] `npm test`, lint and typecheck clean; no new dependency in `package.json`

## Notes

Hard rule: no new dependency (PRD §6). The scan is a pattern scan, not a CSS parser; that limit is accepted debt in [sad §11](../sad.md). Lane: `GUARDED` is edited by every screen task, so those tasks run one after another (`files_hint` overlap).
