---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0002-guard-design-values-and-motion-with-a-vitest-stylesheet-scan.md by sync-spec. Do not edit here. -->

# 0002 — Guard design values and motion with a Vitest stylesheet scan

- **Status:** Accepted
- **Date:** 2026-10-28
- **Deciders:** OlegShevtsov1 (Architect), with Claude during the architecture-design walk

## Context

AC-15 requires that no screen of the application's own styles uses colours, type sizes, spacing, corner radii or
shadows outside the shared design values, and AC-14 that no animation or transition runs under a reduced-motion
setting. PRD §6 measures both with frontend unit tests over the stylesheets, the first written RED. Today only
`src/routes/Landing.css` is checked, for motion, focus and hover glow (`tests/design-tokens.test.ts`); the other
stylesheets are unchecked. The guard runs on every screen's pull request, so its form is decided once (sad.md §4).

## Decision drivers

- QG-2 One look from shared values: 0 raw values outside the design-value variables (PRD §6, Shared design values).
- QG-3 Accessible in both themes: 0 animation or transition declarations under a reduced-motion setting, on 4 of 4
  screens and the crash screen (PRD §6, Reduced motion).
- 0 new runtime dependencies (PRD §6) and the TDD check, which needs the first commit to fail the suite (sad.md §2).

## Considered options

1. **Vitest stylesheet scan** — a new `tests/stylesheets.test.ts` in the style of `tests/design-tokens.test.ts`, reading
   the CSS files under `src/` as text.
2. **Hand-written CSS tokenizer in the test** — the same test, but parsing declarations with a small tokenizer written
   in the test file instead of text patterns; no dependency, more code to maintain.
3. **Stylelint with a strict-value rule** (excluded by the no-new-dependency constraint, PRD §1; listed because a
   reader will ask why not a real CSS linter) — `stylelint` and `stylelint-declaration-strict-value` as dev
   dependencies, run in CI next to ESLint.

## Decision outcome

**Chosen:** Option 1. It is exactly the unit test PRD §6 names, so the TDD check sees it fail before the styles
change, and it adds no package; option 2 parses more exactly but is code to maintain for five small stylesheets;
option 3 is out because it adds packages, a config file and a lint step that is not the PRD's measurement.

What the scan checks, over every `.css` file under `src/` except `src/styles/tokens.css`, after stripping comments:

- **Values:** no colour literal (hex, `rgb()`, `hsl()` or a named colour other than `transparent` and `currentColor`)
  in any declaration, and no length literal in font-size, margin, padding, gap, inset, border-radius, box-shadow or
  text-shadow declarations. A short allow-list written in the test itself accepts `0`, `auto`, percentages,
  keywords and `@media` preludes (breakpoints cannot be variables, sad.md §2).
- **Motion:** no `animation` or `transition` declaration outside `@media (prefers-reduced-motion: no-preference)`,
  generalising the existing landing check to every stylesheet, the crash screen's included.
- Each failure names the file, the selector and the declaration, so a pull request author sees what to replace.

## Consequences

**Positive**
- One test holds the AC-14 and AC-15 rules for every stylesheet, including ones added later.
- No dependency, no config and the same file-reading test style the repository already uses.
- The scan runs in the existing `npm test` step, so CI needs no change.

**Negative**
- A pattern scan is not a full CSS parser: unusual syntax can slip past it, so the allow-list stays short and explicit
  and the test lists what it does not cover.
- Values the scan does not inspect (widths and heights of icons, for example) rely on review.

**Neutral**
- Moving to Stylelint later is a one-day change: the rules are written down here and in the test.

## Amendment (2026-10-29)

The decision stands; two points follow from PRD §1 (Clarified, 2026-10-29) and ADR-0005.

- **Growing list.** The scan runs over a list of stylesheets (`GUARDED` in `tests/stylesheets.test.ts`, started by
  T1). Each screen pull request adds its own stylesheet in its RED commit, and the last task widens the list to every
  `.css` file under `src/` except `src/styles/tokens.css`, the privacy and terms stylesheets included.
- **Gradients and the landing palette.** A gradient with colour literals is a raw value; gradients live as
  `--gradient-*` tokens in `tokens.css`, where the `.palette-landing` blocks are also allowed (ADR-0005). No other
  file may define a design value. The allow-list follows PRD §1: `0`, `auto`, percentages, 1 px borders and
  media-query breakpoints.
- **Option 3 reconsidered.** The scope change allows a self-hosted font package (PRD §6, ADR-0006), so "no new
  dependency" no longer excludes Stylelint on its own. It stays rejected because it is not the RED-first unit test
  PRD §6 names as the measurement, and it adds a config and a CI step. The stylesheet count is now about ten (sad.md
  §2), still small for a pattern scan.
- **Font families** are not scanned; that stylesheets name a family only through `--font-family-*` (ADR-0006) is
  enforced by review.

## Links

- PRD: [[../PRD.md]] §6, AC-14, AC-15
- SAD: [[../sad.md]] §4, §10
- Related ADR: [[0001-keep-one-semantic-token-layer-rewritten-in-place]]
