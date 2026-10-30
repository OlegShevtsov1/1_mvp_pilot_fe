---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0003-switch-token-values-first-then-restyle-one-screen-per-pr.md by sync-spec. Do not edit here. -->

# 0003 — Switch token values first, then restyle one screen per pull request

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** OlegShevtsov1 (Architect), with Claude during the architecture-design walk

## Context

PRD §1 (Delivery) fixes one pull request per screen with the shared design values first, and accepts that dev shows a
mixed old and new look until the last screen has merged; test edits, screenshots and the owner's approval are per pull
request. What it leaves open is whether the first pull request changes the token values every screen already reads,
or adds a second token set that the screens move to one at a time. The answer shapes every task of break-tasks
(sad.md §4).

## Decision drivers

- One set of colour and type values shared by all screens (PRD §1, AC-15; ADR-0001).
- QG-1 Behaviour preserved: each pull request changes only appearance and lists its visual-value assertions
  (PRD §1, §6).
- At most one day and 500 changed lines per task, and 4 of 4 screens approved by 2026-11-30 (sad.md §2).

## Considered options

1. **Change values first** — the first pull request rewrites the token values in place; each later pull request
   restyles one screen's layout and states.
2. **Side-by-side token sets** — the first pull request adds the new values under new names, each screen pull request
   moves its stylesheet over, and a final pull request deletes the old set.

## Decision outcome

**Chosen:** Option 1. There is only ever one token set, so the "one shared set" rule holds from the first merge and no
cleanup pull request is needed; the cost — five screens changing colour at once before their layouts follow — is the
mixed look the PRD already accepts.

The order:

1. **Shared values:** `tokens.css` rewritten (ADR-0001), the stylesheet guard (ADR-0002) and the new contrast pairs,
   the shared base stylesheet and brand mark (sad.md §5); visual-value assertions such as the dark background
   `rgb(8, 9, 12)` in the landing end-to-end spec are updated here and listed.
2. **Landing page** — DarkSaaS layout rhythm in the light and dark variants.
3. **Sign-up.**
4. **Sign-in.**
5. **Cabinet and the crash screen.**

Each screen pull request carries its own before-and-after screenshots and the owner's approval; AC-15 and the 4-of-4
targets are checked once the last one has merged (PRD §1).

## Consequences

**Positive**
- One token set at every point in time; the guard and the contrast test check one thing.
- No cleanup pull request and no risk of a screen mixing old and new names.
- Screen pull requests touch only their own stylesheet and markup, so they stay small.

**Negative**
- The first pull request changes the colours of all five screens at once; its screenshots cover every screen, and until
  a screen's own pull request lands it shows the new colours on its old layout.
- The "before" screenshot of a screen pull request already has the new colours, so the owner judges the layout change
  against an intermediate state.

**Neutral**
- If a screen's pull request is delayed, dev keeps the mixed look longer; nothing breaks.

## Amendment (2026-10-29)

The order stands; the scope change of 2026-10-29 (PRD §1) changes what some steps carry.

- Step 1 (shared values) is done or in review: T1 guard, T2 Mantis values on `:root`, T4 visual-check helpers merged;
  T3 (`base.css`, `BrandMark`) is fe PR #77. Public Sans (ADR-0006) arrives with T3 if it has not merged yet, else with
  the first screen task.
- **Landing page:** the full DarkSaaS look, not layout rhythm only, always dark (no light variant). Its pull request adds the `.palette-landing`
  blocks and gradient tokens (ADR-0005), may change wording and sections (PRD AC-01), and lists the landing text and
  section assertions it updates.
- **Sign-up and sign-in:** the Mantis auth look (a centred card on the page background).
- **Cabinet:** the Mantis dashboard look on the sidebar, top bar and cards the cabinet already has. If one pull
  request would exceed 500 changed lines, `break-tasks` splits it into the shell (sidebar, top bar, phone toggle) and
  the states (list, filter, guidance, loading, empty, failure, delete refused).
- The driver "one set of colour and type values shared by all screens (ADR-0001)" and the outcome's "one shared set"
  now read "one token file with one set of role names, holding the Mantis palette and the landing palette
  (ADR-0005)". Step 1's "`tokens.css` rewritten (ADR-0001)" is the Mantis set on `:root` that T2 wrote.

## Links

- PRD: [[../PRD.md]] §1 (Delivery), §6, §7
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0001-keep-one-semantic-token-layer-rewritten-in-place]],
  [[0002-guard-design-values-and-motion-with-a-vitest-stylesheet-scan]]
