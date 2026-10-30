---
id: T15
title: "Landing page, part 2: feature cards, \"How it works\" steps, the final call-to-action card and the footer"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T14"]
acs: ["AC-01", "AC-02", "AC-11", "AC-13", "AC-14", "AC-16"]
files_hint: ["src/routes/Landing.tsx", "src/routes/Landing.css", "src/routes/Landing.test.tsx", "src/routes/SiteChrome.tsx", "src/routes/SiteChrome.css", "e2e/landing.spec.ts"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t15-landing-sections.md by sync-spec. Do not edit here. -->

# T15 — Landing page, part 2: feature cards, "How it works" steps, the final call-to-action card and the footer

## Why

Derives from [PRD AC-01, AC-02](../PRD.md); [design spec](../design-spec.md) BR-01, BR-03 and the approved wording of §11 (BR-19).

## What

- RED: in `Landing.test.tsx` expect the eyebrows "Features" and "How it works", the sub-line under "Everything a personal plan needs", the four feature cards, the section "From a first idea to done in three steps" with its three steps, the line "Your projects and tasks are visible only to you." under the final heading, and the legal links in the `nav` labelled "Legal"; e2e at 768 px expects features two across and steps three across without overflow.
- GREEN: the four feature cards (4 across at 1440 px, 2 at 768 px, 1 on a phone), the three-step section, the final call-to-action card and the footer, with the exact approved wording of design spec §11; feature titles and texts kept word for word.
- Every call to action leads only to `/sign-up` or `/sign-in`; no new link, form or tracking.

## Definition of Done

- [ ] The new text and section assertions fail first (RED commit), then pass; existing behaviour assertions pass unchanged
- [ ] Landing e2e width, focus, reduced-motion and request checks stay green with the new sections
- [ ] Screenshots of the whole landing page at 360 and 1440 px (dark under both emulations) attached; the owner approves the landing page on this PR

## Notes

The owner's landing approval of PRD §6 is given on this PR, comparing against the approved mockup. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
