---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-29"
feature_size: S
stage: "04-05"
ticket: "PILOT-368"
---
<!-- Copied from be@5663ab6a7e9aeaf70237a282dabec48f2c6b1ca4:docs/features/redesign/adr/0006-self-host-public-sans-for-body-text-and-keep-space-grotesk-for-display.md by sync-spec. Do not edit here. -->

# 0006 — Self-host Public Sans for body text and keep Space Grotesk for display

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** OlegShevtsov1 (owner, through the parent session), with Claude during the architecture-design revision

## Context

The scope change of 2026-10-29 (PRD §1) lets the typefaces change. Fonts must be free-licence, self-hosted and listed
with their licence in the pull request, and no font request may leave the application's own origin (PRD §6). The PRD
§8 question "which typefaces" is due before T3. Today body text uses the system stack (`--font-family-base`), and
display text and the brand use Space Grotesk Variable, imported from `@fontsource-variable/space-grotesk` in
`src/main.tsx`. Mantis sets its screens in Public Sans. The choice touches every screen and adds a package, so it is
decided once.

## Decision drivers

- PRD §6 New runtime dependencies and assets: 0 component libraries, 0 paid assets; a self-hosted free-licence font
  package is allowed, named with its licence.
- PRD §6 Third-party font or image requests: 0 from the application's own styles. The Content-Security-Policy in
  `nginx.conf` has no `font-src`, so fonts fall back to `default-src 'self'`; a font from another host is blocked.
- Goal 1 (PRD §2): each screen matches its reference; the cabinet and auth screens follow Mantis.
- US-08: one product across screens, joined by the brand mark and one system of design values.

## Considered options

1. **Public Sans for body text everywhere, Space Grotesk kept for display and the brand.** Add
   `@fontsource-variable/public-sans` (SIL Open Font License 1.1), imported in `src/main.tsx` next to Space Grotesk.
   `--font-family-base` starts with `'Public Sans Variable'` and keeps the system stack as fallback.
2. **Keep the current fonts.** System stack for body text and Space Grotesk for display; no package.
3. **Public Sans for sign-up, sign-in and the cabinet, and Inter for the landing page** (body and display). Two
   packages, and a per-palette font override.

## Decision outcome

**Chosen:** Option 1 (owner, 2026-10-29). It brings the Mantis screens to their reference type with one package and
keeps one body face across all screens, which serves US-08. The landing page keeps the display face it already has,
so its hero and the brand mark keep their character. Option 2 leaves the Mantis screens visibly off-reference. Option 3
doubles the font weight downloaded and splits the product's body type.

Rules that follow from it:

- Fonts come only from `@fontsource-variable/*` packages bundled by Vite and served from the app's own origin;
  no font file is copied into `src/` by hand and no `@import` points at another host.
- Families are design values: `--font-family-base` and `--font-family-display` in `tokens.css`; stylesheets never
  name a family directly (enforced by review; the scan of ADR-0002 does not cover font families).
- The pull request that adds the package (T3, or the first screen task if T3 has already merged) lists the package,
  its version and "SIL Open Font License 1.1" in its description. It updates the visual-value assertions that pin the
  font in `tests/design-tokens.test.ts` (PRD §8, lines 99–103) and lists them.

## Consequences

**Positive**
- The cabinet and auth screens read like Mantis; one body face holds the product together.
- No third-party request and no Content-Security-Policy change.

**Negative**
- A second web font adds to the first load of every screen. Only the Latin subset is shipped (the task imports
  fontsource's Latin-only entry rather than the all-subsets default), and fontsource's `font-display: swap` keeps text
  visible while it loads.
- Text metrics change on every screen at once, so the first screenshots after the import show every screen.

**Neutral**
- Swapping the body face later is one token value and one import.

## Links

- PRD: [[../PRD.md]] §1, §6, §8, US-08
- SAD: [[../sad.md]] §2, §4, §8
- Related ADR: [[0005-scope-the-landing-palette-as-an-override-of-the-same-token-names]],
  [[0003-switch-token-values-first-then-restyle-one-screen-per-pr]]
