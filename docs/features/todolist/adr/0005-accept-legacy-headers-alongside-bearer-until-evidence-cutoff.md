---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0005-accept-legacy-headers-alongside-bearer-until-evidence-cutoff.md by sync-spec. Do not edit here. -->

# 0005 — Accept the legacy headers alongside bearer tokens until the evidence cutoff

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

The legacy access token is used today by `bin/swagger_smoke` on every deploy, by the request specs and by manual API
callers; the frontend has never used it (sad.md §2). The PRD keeps it working until the frontend has switched and no
legacy use has been seen for 7 days (AC-12, AC-13, KPI legacy retirement), and old and new code run side by side
during a deploy (CLAUDE.md, expand → backfill → contract).

## Decision drivers

- QG-2 no lockout during the switch; PRD §6 "existing users locked out: 0".
- PRD §6 "legacy access token use counted daily, history kept ≥ 30 days".
- Breaking contract changes need an ADR and a migration path (`.claude/rules/api.md`).

## Considered options

1. **Dual scheme with a daily count, then contract** — check a bearer access token first; if none, fall back to the
   legacy email + token headers and count each use per day; a later release removes the fallback and
   `simple_token_authentication`.
2. **Dual scheme with a fixed removal date** — same fallback and daily count, but the legacy access token is removed
   on a calendar date (for example 30 days after the release) instead of on evidence of non-use.

## Decision outcome

**Chosen:** option 1. It is the expand/contract path the repository requires, keeps the deploy smoke check passing
through the switch, and removes the legacy access token only when the data shows nobody uses it (PRD AC-13); a fixed
date could cut off a caller that has not moved.

## Consequences

**Positive**
- No lockout during deploys; the cutoff is decided on data, not on a date.
- Sign-out on a legacy device rotates the user's legacy access token, ending it for every device that uses it
  (AC-11b); Google linking cancels it (AC-06).

**Negative**
- Two authentication paths to test and secure until the cutoff; the contract documents both.
- A second release (the contract step) is needed to finish the feature.

**Neutral**
- The cutoff condition "frontend has switched" is met by the smoke script and the contract moving to access tokens,
  since the frontend never used the legacy token.

## Links

- PRD: [[../PRD.md]] US-06, AC-11b, AC-12, AC-13, §6, §7
- SAD: [[../sad.md]] §2, §4, §8, §11
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]]
