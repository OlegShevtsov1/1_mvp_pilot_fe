---
id: T11
title: "Refresh the frontend architecture map and record the screen approvals"
layer: "docs"
repo: 1_mvp_pilot_fe
type: docs
deps: ["T10"]
acs: ["AC-15"]
files_hint: ["docs/architecture-map.md", "docs/features/redesign/"]
owner: "OlegShevtsov1"
estimate: "S"
status: "todo"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/tasks/t11-close-out-docs.md by sync-spec. Do not edit here. -->

# T11 — Refresh the frontend architecture map and record the screen approvals

## Why

Mitigates the stale-map risk in [sad §11](../sad.md) and keeps the owner's per-screen approvals on record ([PRD §7](../PRD.md)).

## What

- In `1_mvp_pilot_fe`, run `/sdlc-map-architecture` so its architecture map records `base.css`, `BrandMark`, the token layer with its `.palette-landing` block (ADR-0005), Public Sans (ADR-0006) and the stylesheet guard.
- Record, in the PR descriptions' linked screenshots or in `tracker.md` notes, the owner's approval of each of the four screens and the crash screen.

## Definition of Done

- [ ] `docs/architecture-map.md` in the frontend names `src/styles/base.css`, `src/routes/BrandMark.tsx`, the `.palette-landing` block, Public Sans and `tests/stylesheets.test.ts`, and its `reflects_commit` is current
- [ ] Every screen's approval is linked from the feature's tracker

## Notes

Docs-only PR (`Type: docs`), exempt from the RED-first rule of the TDD check. The glossary follow-up of [sad §12](../sad.md) (`/sdlc-fix-term` for crash screen, design value, brand mark, visual-value assertion) can ride along.
