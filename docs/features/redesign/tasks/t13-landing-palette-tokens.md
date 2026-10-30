---
id: T13
title: "Add the landing palette block, the gradient tokens and the new role tokens with their contrast pairs"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T12"]
acs: ["AC-12", "AC-15"]
files_hint: ["src/styles/tokens.css", "tests/design-tokens.test.ts"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t13-landing-palette-tokens.md by sync-spec. Do not edit here. -->

# T13 — Add the landing palette block, the gradient tokens and the new role tokens with their contrast pairs

## Why

Derives from [ADR-0005](../adr/0005-scope-the-landing-palette-as-an-override-of-the-same-token-names.md) and [design spec](../design-spec.md) §9 (BR-12, BR-14, BR-17): the landing and cabinet tasks read values that do not exist yet. Putting the design values and their contrast pairs in one pull request keeps the screen pull requests under 500 lines.

## What

- RED: teach `tests/design-tokens.test.ts` to read the `.palette-landing` block: every pair it checks on `:root` is also checked with the landing values wherever the block overrides one side; add the new pairs of the approved mockups (violet accent, landing text on the dark surfaces, white button text on the accent gradient at its worst stop `#7c3aed`, landing links in `--color-accent-strong`, status chip text on `--color-status-*-soft`, scrim) in every palette and theme they apply to.
- GREEN: add one `.palette-landing` block outside any `prefers-color-scheme` query, with `color-scheme: dark`, overriding only the roles the landing mockup changes, plus `--gradient-hero`, `--gradient-accent`, `--gradient-title`, `--gradient-orb`, `--gradient-grid` and `--shadow-glow`; add `--color-status-progress-soft`, `--color-status-done-soft` and `--color-scrim` on `:root` in light and dark.
- No screen carries the hook class yet, so nothing visible changes; the landing tasks apply it.

## Definition of Done

- [ ] The contrast test fails first (RED commit) on the missing block and pairs, then passes for every pair in every palette and theme it applies to
- [ ] Every new role is defined at least on `:root`; the hook class is the only selector apart from `:root` that defines a design value
- [ ] `tests/stylesheets.test.ts`, lint and typecheck stay green; no screen changes visually (all existing suites pass unchanged)

## Notes

Values come from the approved landing and cabinet mockups (design spec §13); a pair that fails contrast is changed here, never in the screen task. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
