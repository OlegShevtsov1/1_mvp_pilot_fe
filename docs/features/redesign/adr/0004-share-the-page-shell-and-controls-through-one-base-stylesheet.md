---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0004-share-the-page-shell-and-controls-through-one-base-stylesheet.md by sync-spec. Do not edit here. -->

# 0004 — Share the page shell and controls through one base stylesheet

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** OlegShevtsov1 (Architect), with Claude during the architecture-design walk

## Context

The five screens must look like one product: the same brand mark, colours and typography on every screen (AC-15).
Today the shared `.page` shell is defined in `src/routes/Landing.css` although sign-in, sign-up and the cabinet use it,
the body rules sit in `src/index.css`, and button, link and focus rules are written per screen (`.auth-form button`,
`.landing-start`). Where the rules shared by several screens live decides the shape of every screen pull request
(sad.md §5).

## Decision drivers

- QG-2 One look from shared values: shared controls must be identical on every screen (PRD AC-15).
- QG-3 Accessible in both themes: one visible focus indicator on every link, button and field (PRD AC-13).
- Plain global CSS per module, no component library, no own component set (sad.md §2, idea brief §14).
- Small screen pull requests, at most 500 changed lines each (sad.md §2, ADR-0003).

## Considered options

1. **One shared base stylesheet** — a new `src/styles/base.css`, imported in `src/main.tsx` right after `tokens.css`,
   holds the rules shared by several screens.
2. **Keep shared rules per screen** — each screen stylesheet writes its own button, link and focus rules from the same
   tokens, and `.page` stays in `Landing.css`.

## Decision outcome

**Chosen:** Option 1. A shared control is then written once, so "identical on every screen" holds by construction
rather than by review, and sign-in, sign-up and the cabinet stop depending on the landing stylesheet; the cost is a
first pull request that moves rules between files.

What `base.css` holds: the body (moved from `src/index.css`), the `.page` shell (moved from `Landing.css`, with the
1200 px content width of AC-16), the header with the brand mark (`src/routes/BrandMark.tsx`), and the base look of
buttons, links, inputs, the focus ring and alerts. Screen stylesheets keep only what is specific to their screen. Base
rules use class selectors, not bare element selectors, so they never reach into the Google button's slot.

## Consequences

**Positive**
- One place to change a shared control; screen pull requests stay focused on layout.
- The crash screen gets the shared look by wrapping its text in the page shell, with no stylesheet of its own.
- The guard of ADR-0002 checks `base.css` like any other stylesheet.

**Negative**
- The first pull request is larger because it moves `.page` and the body rules.
- Every stylesheet is bundled into one file, so a base rule applies to all screens at once; a careless selector can
  restyle a screen that is not part of the current pull request.

**Neutral**
- If a shared component set is ever built (idea brief §14, Approach C), these rules are its starting point.

## Amendment (2026-10-29)

The decision stands. The drivers "same brand mark, colours and typography on every screen" and "identical on every
screen" now mean: shared controls have one structure everywhere and take their colours from the palette of the screen
they are on (PRD AC-15 allows the two palettes to differ). With the landing palette (ADR-0005), the controls in `base.css` read the same role names, so on
the landing page they take the landing colours by inheritance; `base.css` gets no landing-only rules. The `.page` shell
(at most 1200 px) is the content column for sign-up, sign-in, the crash screen and the landing sections. The cabinet
keeps its own layout (sidebar, top bar, content column), and only its content column is limited to 1200 px; full-width
backgrounds, header bars and the sidebar may span the screen (PRD AC-16). The privacy and terms pages (fe PILOT-419)
share the landing header, which moves to `BrandMark` and `.brand` like the other headers.

## Links

- PRD: [[../PRD.md]] AC-13, AC-15, AC-16
- SAD: [[../sad.md]] §5
- Related ADR: [[0001-keep-one-semantic-token-layer-rewritten-in-place]],
  [[0003-switch-token-values-first-then-restyle-one-screen-per-pr]]
