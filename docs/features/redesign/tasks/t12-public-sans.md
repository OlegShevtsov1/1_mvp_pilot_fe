---
id: T12
title: "Self-host Public Sans as the body face"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T3"]
acs: ["AC-12", "AC-15"]
files_hint: ["package.json", "package-lock.json", "src/main.tsx", "src/styles/tokens.css", "tests/design-tokens.test.ts"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t12-public-sans.md by sync-spec. Do not edit here. -->

# T12 — Self-host Public Sans as the body face

## Why

Derives from [ADR-0006](../adr/0006-self-host-public-sans-for-body-text-and-keep-space-grotesk-for-display.md) and [design spec](../design-spec.md) BR-13; Public Sans did not ride along with T3 (fe #77), so per ADR-0006 it is its own pull request before the first screen task. Every screen's text metrics change at once, so it lands before any screen is restyled.

## What

- RED: in `tests/design-tokens.test.ts`, expect `@fontsource-variable/public-sans` in `package.json`, its Latin-only import in `src/main.tsx` next to Space Grotesk, and `--font-family-base` starting with `'Public Sans Variable'` with the system stack as fallback.
- GREEN: add the package (SIL Open Font License 1.1), import its Latin-only entry, change the one token value. No stylesheet names a family directly.
- Update and list the font assertions this replaces (PRD §8, `tests/design-tokens.test.ts` lines 99–103).

## Definition of Done

- [ ] `tests/design-tokens.test.ts` fails first (RED commit) on the missing package, import and token value, then passes
- [ ] The only new dependency is `@fontsource-variable/public-sans`; the PR names it with its version and "SIL Open Font License 1.1"
- [ ] The T4 request check passes on the landing page with Google configured and unconfigured: no font request leaves the app's origin
- [ ] Screenshots of the five screens at 1440 px, since every screen's body text changes

## Notes

Small shared change; no screen layout moves. If `--font-family-display` needs no change it stays as it is. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
