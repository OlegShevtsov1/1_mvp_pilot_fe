---
id: T2
title: "Rewrite the design token values in place from the Mantis palette and type scale, both themes"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T1"]
acs: ["AC-12", "AC-15"]
files_hint: ["src/styles/tokens.css", "tests/design-tokens.test.ts", "e2e/landing.spec.ts"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t2-token-values.md by sync-spec. Do not edit here. -->

# T2 — Rewrite the design token values in place from the Mantis palette and type scale, both themes

## Why

Derives from [ADR-0001](../adr/0001-keep-one-semantic-token-layer-rewritten-in-place.md) and [ADR-0003](../adr/0003-switch-token-values-first-then-restyle-one-screen-per-pr.md) step 1; serves [PRD AC-12 and AC-15](../PRD.md).

## What

- Rewrite the values in `src/styles/tokens.css`: one layer of role-named custom properties; existing names stay where the role fits, new role names are added where the new look needs them (type scale, spacing steps, radii, shadows, motion timings, `--content-width-max: 1200px`). Every `--color-*` exists in the light set and in the dark set under `@media (prefers-color-scheme: dark)`; no toggle. The typefaces do not change (Space Grotesk, system stack).
- Palette and type scale are taken from the Mantis look only (looked at, never copied); Mantis for the auth and dashboard pages and DarkSaaS for the landing layout rhythm are the default references from [PRD §8](../PRD.md).
- Update the known visual-value assertions openly: the dark background colour in `e2e/landing.spec.ts` and the colour token names, glow and font checks in `tests/design-tokens.test.ts`. Behaviour assertions are not touched. List each changed assertion in the PR description.
- Add every foreground/background pair the new values create to the contrast test in both themes (≥ 4.5:1 text and controls, ≥ 3:1 focus and status marks). Adding pairs is strengthening, not weakening.

## Definition of Done

- [ ] The contrast test (RED first: new pairs and updated names) passes for every new pair in the light and the dark theme
- [ ] Every screen still renders and the existing unit and end-to-end suites pass unchanged apart from the listed visual-value assertions (AC-12)
- [ ] `tests/stylesheets.test.ts` stays green; no raw colour outside `tokens.css`
- [ ] PR description lists each updated visual-value assertion, with before-and-after screenshots of all five screens at 360 px and 1440 px, light and dark

## Notes

After this PR dev shows the new colours on the old layouts; this is the mixed look [PRD §1](../PRD.md) accepts. Contrast of text over gradients is checked as an explicit worst-case solid pair (the hex test cannot see gradients; [sad §11](../sad.md)).
