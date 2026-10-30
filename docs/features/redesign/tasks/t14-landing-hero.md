---
id: T14
title: "Landing page, part 1: always-dark palette hook, header and the hero with the decorative preview"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T4", "T13"]
acs: ["AC-01", "AC-02", "AC-11", "AC-12", "AC-13", "AC-14", "AC-16"]
files_hint: ["src/routes/Landing.tsx", "src/routes/Landing.css", "src/routes/Landing.test.tsx", "src/routes/Legal.tsx", "src/routes/SiteChrome.tsx", "src/routes/SiteChrome.css", "e2e/landing.spec.ts", "tests/stylesheets.test.ts"]
owner: "OlegShevtsov1"
estimate: "L"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t14-landing-hero.md by sync-spec. Do not edit here. -->

# T14 — Landing page, part 1: always-dark palette hook, header and the hero with the decorative preview

## Why

Derives from [PRD AC-01, AC-02, AC-12](../PRD.md), [sad §6 Landing page](../sad.md), [ADR-0005](../adr/0005-scope-the-landing-palette-as-an-override-of-the-same-token-names.md); [design spec](../design-spec.md) BR-01 (header and hero), BR-02, BR-03, BR-12, BR-16 and the approved landing mockup.

## What

- RED: add `src/routes/Landing.css` to `GUARDED`; in `e2e/landing.spec.ts` read the landing root background under light and under dark emulation and expect the dark value in both (visual-value assertion, listed); add the T4 width (360, 768, 1440 px), focus, reduced-motion and request checks with Google configured and unconfigured; in `Landing.test.tsx` expect the badge "Personal projects and tasks", one `h1`, both starts and the `aria-hidden` preview.
- GREEN: put `.palette-landing` on the landing root and on the legal pages' root (they share the chrome); the landing root paints the full-viewport background. Header with the brand and Sign in; hero with the badge, the gradient headline (`--gradient-title`), the lead, the two starts (stacked full width on a phone) and the decorative cabinet preview with its status chips over the glowing orb. The orb glow and preview fade-in run only under `prefers-reduced-motion: no-preference`.
- Keep the wording of the headline, lead and call-to-action labels; the Google and email-only labels stay as they are (AC-02). Update and list the landing visual-value and selector-only assertions the change touches.

## Definition of Done

- [ ] `Landing.css` guarded: RED first, then green with 0 raw values and 0 unguarded motion
- [ ] Landing e2e: dark background under both emulations, width at 360, 768 and 1440 px, focus, reduced motion, and no third-party font or image request with Google configured and unconfigured
- [ ] `Landing.test.tsx` behaviour assertions pass unchanged (AC-01, AC-02: both starts lead only to sign-up and sign-in, no Google mention without a client); each changed assertion is listed in the PR
- [ ] Screenshots of the landing page at 360 and 1440 px under light and dark emulation, and of `/privacy`, attached

## Notes

Split from the old T5 to stay under 500 changed lines: this task takes the palette, header and hero; T15 takes the sections below the hero. Inline SVG only, drawn in our code; nothing copied from DarkSaaS. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
