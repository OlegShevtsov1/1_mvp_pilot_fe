---
status: "Superseded by 0005"
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0001-keep-one-semantic-token-layer-rewritten-in-place.md by sync-spec. Do not edit here. -->

# 0001 — Keep one semantic token layer, rewritten in place

- **Status:** Superseded by [ADR-0005](./0005-scope-the-landing-palette-as-an-override-of-the-same-token-names.md) (2026-10-29)
- **Date:** 2026-10-28
- **Deciders:** OlegShevtsov1 (Architect), with Claude during the architecture-design walk

> **Superseded (2026-10-29).** The owner's scope change (PRD §1) gives the landing page its own palette and
> gradients, so "one set shared by all screens" no longer holds. ADR-0005 keeps this ADR's single layer of role-named,
> literal-valued tokens and adds a scoped override of the same names for the landing page. The values T2 wrote under
> this ADR stay as the Mantis set on `:root`.

## Context

The redesign gives all four screens and the crash screen one look from one shared set of colour and type values, with
Mantis as the source of the palette and typography (PRD §1, AC-15). The frontend already keeps its design values as
CSS custom properties on `:root` in `src/styles/tokens.css`, named by role (`--color-accent`, `--color-surface`,
`--space-3`, `--radius-md`), with a dark set under `@media (prefers-color-scheme: dark)`. Every screen stylesheet and
two tests (`tests/design-tokens.test.ts`, the landing end-to-end spec) read these names, so how the values are organised
is decided once for the whole feature (sad.md §4).

## Decision drivers

- QG-2 One look from shared values: 0 raw colours, type sizes, spacing, radii or shadows outside the design-value
  variables (PRD §6, AC-15).
- QG-3 Accessible in both themes: the contrast test in `tests/design-tokens.test.ts` checks every foreground and
  background pair and requires each `--color-*` value to be a literal `#rrggbb` colour (PRD §6).
- One set shared by all screens, with a light landing variant from the same values (PRD §1, Clarified).
- No new dependency and a small effort budget, about 2 person-weeks (sad.md §2).

## Considered options

1. **One semantic layer, rewritten in place** — `tokens.css` keeps a single layer of role-named variables; values are
   re-derived from Mantis, existing names are kept where the role still fits, and new role names are added where the new
   look needs them.
2. **Palette plus semantic layers** — a raw palette (`--blue-500: #1677ff`) and role tokens that point at it
   (`--color-accent: var(--blue-500)`); screens read only role tokens.

## Decision outcome

**Chosen:** Option 1. It is the smallest change that gives every screen one set of values, and it keeps the contrast
test working unchanged, because every `--color-*` stays a literal colour; option 2's extra layer pays off only when
palettes are swapped often, which a single re-skin does not need.

Rules that follow from it:

- Screens and shared stylesheets read only `var(--…)` names from `tokens.css`; values live nowhere else (enforced by
  ADR-0002).
- A role the new look needs but no token names (for example a raised surface or a 1200 px content width) gets a new
  role name in `tokens.css`; a token is never reused for a role it does not describe.
- Every new `--color-*` exists in both themes and every new foreground and background pair is added to the contrast
  test (PRD §1: adding pairs is strengthening).
- Renamed or removed tokens are visual-value assertions in the sense of PRD §1 and are listed in the pull request.

## Consequences

**Positive**
- One file holds every design value; a reviewer sees the whole palette and scale in one diff.
- The contrast test keeps reading literal colours, so no test infrastructure changes before the visual work.
- Screens keep their current `var(--…)` references, so the first pull request already restyles every screen
  (ADR-0003).

**Negative**
- A future palette swap edits values one by one rather than one palette layer.
- Light and dark values sit side by side in two blocks, so a colour change touches both by hand.

**Neutral**
- Splitting into palette and semantic layers later is possible; it needs the contrast test to resolve `var()` chains
  first.

## Links

- PRD: [[../PRD.md]] §1, §6, AC-12, AC-15
- SAD: [[../sad.md]] §4
- Related ADR: [[0002-guard-design-values-and-motion-with-a-vitest-stylesheet-scan]],
  [[0003-switch-token-values-first-then-restyle-one-screen-per-pr]]
