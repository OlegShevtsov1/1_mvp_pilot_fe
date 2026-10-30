---
id: T3
title: "Add base.css (page shell, header, controls, focus ring, alerts) and the shared BrandMark"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T2"]
acs: ["AC-13", "AC-14", "AC-15", "AC-16"]
files_hint: ["src/styles/base.css", "src/index.css", "src/main.tsx", "src/routes/BrandMark.tsx", "src/routes/Landing.tsx", "src/routes/Landing.css", "tests/stylesheets.test.ts"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t3-base-stylesheet-brand-mark.md by sync-spec. Do not edit here. -->

# T3 — Add base.css (page shell, header, controls, focus ring, alerts) and the shared BrandMark

## Why

Derives from [ADR-0004](../adr/0004-share-the-page-shell-and-controls-through-one-base-stylesheet.md) and [sad §5](../sad.md); serves [PRD AC-13, AC-14, AC-15, AC-16](../PRD.md).

## What

- RED: add `src/styles/base.css` to `GUARDED` in `tests/stylesheets.test.ts` and add a Testing Library test that `BrandMark` renders as decorative content (hidden from assistive technology).
- GREEN: create `src/styles/base.css` with the body rules moved from `src/index.css` (the file is then removed), the `.page` shell moved from `Landing.css` (centred, at most `--content-width-max`), the header with the brand mark, and the base look of buttons, links, inputs, one `:focus-visible` outline in `var(--color-focus)` and alerts; motion only inside `prefers-reduced-motion: no-preference`. Class selectors only, never bare element selectors, so nothing reaches into the Google button's slot.
- Import `base.css` in `src/main.tsx` right after `tokens.css`.
- Extract the existing landing logo graphic into `src/routes/BrandMark.tsx` and use it in `Landing.tsx` inside the existing link; no visible word changes.

## Definition of Done

- [ ] `tests/stylesheets.test.ts` with `base.css` guarded fails first, then passes
- [ ] All five screens still render with the same words and behaviour; existing suites pass unchanged (QG-1)
- [ ] Landing page still passes its focus and reduced-motion end-to-end checks with the rules now in `base.css`
- [ ] PR description: file list shows 0 font or image files; screenshots of all five screens, since a base rule applies everywhere at once

## Notes

Largest move-only PR of the feature ([ADR-0004](../adr/0004-share-the-page-shell-and-controls-through-one-base-stylesheet.md) consequences); keep it under 500 changed lines by moving rules, not rewriting screens. Shares `Landing.css`, `tests/stylesheets.test.ts` with T5 and later screens, so they depend on it.
