---
id: T17
title: "Sign-in in the Mantis auth layout with the wrong-credentials alert"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T16"]
acs: ["AC-05", "AC-06", "AC-11", "AC-12", "AC-13", "AC-14", "AC-15", "AC-16"]
files_hint: ["src/routes/SignIn.tsx", "src/routes/SignIn.test.tsx", "src/routes/AuthForm.css", "e2e/signin.spec.ts"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t17-sign-in-screen.md by sync-spec. Do not edit here. -->

# T17 — Sign-in in the Mantis auth layout with the wrong-credentials alert

## Why

Derives from [PRD AC-05, AC-06](../PRD.md), [sad §6 Sign in](../sad.md); [design spec](../design-spec.md) BR-04, BR-06, BR-18 and the approved sign-in mockup.

## What

- RED: in `SignIn.test.tsx` expect the `header` with the brand mark, "Create an account" in the card head and the divider only with Google; add `e2e/signin.spec.ts` with the T4 checks and the wrong-credentials state.
- GREEN: reuse the auth card of T16; "Wrong email or password." as the error alert above the full-width button.

## Definition of Done

- [ ] `SignIn.test.tsx` passes with behaviour assertions unchanged: the wrong-credentials message shows and the visitor stays (AC-06), correct credentials reach the cabinet (AC-05)
- [ ] Sign-in e2e width, theme, focus, reduced-motion and request checks pass
- [ ] Screenshots including the wrong-credentials state at 360 and 1440 px, light and dark; owner approval requested on the PR

## Notes

Mostly markup; the card styles come from T16. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
