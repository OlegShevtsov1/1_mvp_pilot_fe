---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0005-scope-the-landing-palette-as-an-override-of-the-same-token-names.md by sync-spec. Do not edit here. -->

# 0005 — Scope the landing palette as an override of the same token names

- **Status:** Accepted (supersedes [ADR-0001](./0001-keep-one-semantic-token-layer-rewritten-in-place.md))
- **Date:** 2026-10-29
- **Deciders:** OlegShevtsov1 (owner, through the parent session), with Claude during the architecture-design revision

## Context

The owner's scope change of 2026-10-29 (PRD §1) ends the single palette that ADR-0001 was built on. The landing page now
takes the DarkSaaS look: dark background, gradients and accent colours. Sign-up, sign-in, the cabinet and the crash
screen keep the Mantis-derived values that T2 already wrote into `src/styles/tokens.css` (fe PR #76). AC-15 now asks for
one dark palette and gradient set for the landing page, which is always dark (owner, 2026-10-29; PRD AC-12), and one
palette for the other screens in a light and a dark theme.
Every screen stylesheet, the shared `src/styles/base.css` (ADR-0004, fe PR #77) and the contrast test
`tests/design-tokens.test.ts` read the role-named tokens. So where the second palette lives is decided once, for every
screen task.

## Decision drivers

- QG-2 One system of design values: 0 raw values outside the design-value variables, and two palettes that may differ
  (PRD §6 Shared design values, AC-15).
- QG-3 Accessible in both themes: every foreground and background pair the new styles use is in the contrast test
  (PRD §6).
- Shared controls (buttons, links, inputs, focus ring, alerts) are written once in `base.css` (ADR-0004) and should
  look native on the landing page without a second copy.
- No new dependency; the stylesheet guard (ADR-0002) stays unchanged.

## Considered options

1. **Scoped override of the same role names.** `:root` keeps the Mantis values. One hook class on the landing root
   element, `.palette-landing`, redefines the same `--color-*`, `--gradient-*` and `--shadow-*` names with the
   landing's dark values. Screen and shared stylesheets keep reading `var(--color-accent)` and the other role names.
2. **Separate prefixed tokens.** New `--landing-*` variables that only `Landing.css` reads. The shared controls on the
   landing page keep the Mantis colours unless `Landing.css` overrides each one.

## Decision outcome

**Chosen:** Option 1 (owner, 2026-10-29). A shared control picks up the landing colours on the landing page through
inheritance, so `base.css` stays the single definition and no landing-only copy of a control exists. Option 2 would
need a landing override for every shared control and two names for one role.

Rules that follow from it:

- `tokens.css` holds three colour blocks: the `:root` light and dark blocks (Mantis, from T2), and one
  `.palette-landing` block (DarkSaaS look, dark only, added by the landing task) outside any `prefers-color-scheme`
  query, with `color-scheme: dark` so native controls and scrollbars match. A role the landing page does not
  change is not repeated in its block.
- The hook class is the only selector, apart from `:root`, that may define a design value. It sits on the outermost
  element a screen renders, never on `body`.
- Gradients are tokens (`--gradient-*`) in the blocks that use them; a stylesheet never writes a gradient with colour
  literals (ADR-0002 already fails on them).
- Role names stay the contract of ADR-0001: a token is never reused for a role it does not describe, and a new role
  gets a new name, defined at least on `:root` so no screen reads an undefined variable.
- The contrast test learns to read the `.palette-landing` blocks. Every pair it checks on `:root` is also checked
  with the landing values wherever the landing block overrides one side. Text over a gradient is checked against the
  gradient's worst-case stop, listed by hand (PRD §6).
- Which screens carry the hook: the landing page. The privacy and terms pages (fe PILOT-419) reuse the landing header
  and footer, so they carry it too. They are not among the four screens and need no owner approval.
- The landing page is always dark: its block applies whatever the device's light or dark setting (owner,
  2026-10-29; PRD §1 Clarified, AC-12). A browser reports "no preference" as light, so the earlier "dark only with no
  preference" could not be built. Because `body` reads the `:root` values, the landing root paints its own background
  over the whole viewport; the landing end-to-end background assertion reads the landing root under both light and dark
  emulation and is listed as a visual-value assertion.

## Consequences

**Positive**
- `base.css` and every screen stylesheet keep one set of names, so the guard, the stylesheet structure and fe PR #77
  need no change.
- One file still holds every design value; a reviewer sees both palettes side by side.
- Adding a palette for another family of screens later is one more scoped block.

**Negative**
- The contrast test must resolve which block applies to a pair, which is more test code than ADR-0001's flat list.
- A rule written for the landing page that reads a role the landing block does not override silently gets the Mantis
  value. Screenshots of the landing pull request in both themes are the check.

**Neutral**
- The hook is a class on an element, not on `:root`; a custom property defined on the element wins over the inherited
  `:root` value in either device theme, so the landing block needs no media query.
- The privacy and terms pages that carry the hook are always dark too.

## Links

- PRD: [[../PRD.md]] §1 (Scope change, 2026-10-29), §6, AC-12, AC-15
- SAD: [[../sad.md]] §4, §5, §8
- Supersedes: [[0001-keep-one-semantic-token-layer-rewritten-in-place]]
- Related ADR: [[0002-guard-design-values-and-motion-with-a-vitest-stylesheet-scan]],
  [[0004-share-the-page-shell-and-controls-through-one-base-stylesheet]]
