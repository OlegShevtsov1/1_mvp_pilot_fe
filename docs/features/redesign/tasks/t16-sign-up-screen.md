---
id: T16
title: "Sign-up in the Mantis auth layout: brand, centred card with the switch link in its head, divider and fields"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T4", "T12"]
acs: ["AC-03", "AC-04", "AC-11", "AC-12", "AC-13", "AC-14", "AC-15", "AC-16"]
files_hint: ["src/routes/SignUp.tsx", "src/routes/SignUp.test.tsx", "src/routes/AuthForm.css", "src/routes/TextField.tsx", "src/styles/base.css", "e2e/signup.spec.ts", "tests/stylesheets.test.ts"]
owner: "OlegShevtsov1"
estimate: "M"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t16-sign-up-screen.md by sync-spec. Do not edit here. -->

# T16 — Sign-up in the Mantis auth layout: brand, centred card with the switch link in its head, divider and fields

## Why

Derives from [PRD AC-03, AC-04](../PRD.md), [sad §6 Sign up](../sad.md); [design spec](../design-spec.md) BR-04, BR-05, BR-06, BR-18 and the approved sign-up mockup.

## What

- RED: add `src/routes/AuthForm.css` to `GUARDED`; in `SignUp.test.tsx` expect a `header` with the brand mark, the card heading with "I already have an account" in the card head, the "or with email" divider only when Google is configured; add `e2e/signup.spec.ts` with the T4 width, theme (light, dark, no preference → light), focus, reduced-motion and request checks.
- GREEN: the brand at the top left, one centred auth card (max 475 px, full width on a phone), field markup of `TextField` reused with the error colour on the field border and an icon inside the error paragraph; `base.css` gains the primary, outline, text and small button sizes and the info alert for "Your account was created."; "Back to the start" and the legal links below the card.
- Field order, labels, the three field messages, `aria-describedby`, the taken-email alert and the disabled-while-pending submit stay word for word.

## Definition of Done

- [ ] `AuthForm.css` guarded: RED first, then green
- [ ] `SignUp.test.tsx` passes with behaviour assertions unchanged: each faulty field shows its message (AC-04), a valid submit reaches the cabinet (AC-03); changed assertions listed
- [ ] Sign-up e2e width, theme, focus, reduced-motion and request checks pass
- [ ] Screenshots at 360 and 1440 px, light and dark, of the screen, its field errors and the cabinet's new-project form (it shares `AuthForm.css`); owner approval requested on the PR

## Notes

`AuthForm.css` also styles the cabinet's project form and alerts; a rule that leaks there shows up in this PR's cabinet screenshot. The Google button is excluded from the look. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
