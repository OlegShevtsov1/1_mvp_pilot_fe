---
id: T19
title: "Cabinet, part 2: filter card, project cards with status chips, and every state (loading, empty, first task, no match, failure, delete refused)"
layer: "ui"
repo: 1_mvp_pilot_fe
type: feat
deps: ["T17", "T18"]
acs: ["AC-07", "AC-08", "AC-10", "AC-11", "AC-12", "AC-13", "AC-14", "AC-16"]
files_hint: ["src/routes/Dashboard.tsx", "src/routes/Dashboard.css", "src/routes/Dashboard.test.tsx", "src/routes/ProjectForm.tsx", "src/routes/AuthForm.css", "e2e/dashboard.spec.ts"]
owner: "OlegShevtsov1"
estimate: "L"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t19-cabinet-cards-states.md by sync-spec. Do not edit here. -->

# T19 — Cabinet, part 2: filter card, project cards with status chips, and every state (loading, empty, first task, no match, failure, delete refused)

## Why

Derives from [PRD AC-07, AC-08, AC-10](../PRD.md), [sad §6 Work in the cabinet](../sad.md); [design spec](../design-spec.md) BR-07, BR-09, BR-10, §8 state inventory and the approved cabinet mockup.

## What

- RED: in `Dashboard.test.tsx` expect each task's status label as a chip beside its status icon with unchanged text, the loading state as `role="status"` with "Loading your projects…" and static placeholders, and the empty-state guidance card; in the cabinet e2e stub each state (loading, empty, first task, no match, load failure with Retry, delete refused) and check it renders in both themes, at 360 and 1440 px, and with no motion under reduced motion.
- GREEN: the filter card (status chips and the Task status select), one card per project with Rename, Delete, Add task and its task rows (status chip on `--color-status-*-soft`, the two "Mark …" buttons wrapping under the task on a phone), the guidance cards with the drawn folder illustration, the static loading ring, the failure and delete-refused alerts, the no-match card and the new-project form.
- Every state text of design spec BR-10 stays word for word; every accessible name stays.

## Definition of Done

- [ ] `Dashboard.test.tsx` passes with behaviour assertions unchanged: create, rename, delete an empty project, add task, change status, filter and sign out keep their results (AC-07); a project with tasks is kept with its readable explanation (AC-08); failure, loading, empty and first-task states render (AC-10)
- [ ] Cabinet e2e for every stubbed state passes width, theme, focus and reduced-motion checks
- [ ] Screenshots of the states PRD §6 lists (loading, empty list, first-task guidance, filtered, load failure, delete refused) at 360 and 1440 px, light and dark; the owner approves the cabinet on this PR

## Notes

Touches `AuthForm.css` for the project form, so it follows T17. If the diff passes 500 changed lines, split the states (guidance, loading, empty, failure) from the cards and filter. Every PR starts with a failing `test(...)` commit (TDD check) and stays under 500 changed lines ([CLAUDE.md](../../../../CLAUDE.md)).
