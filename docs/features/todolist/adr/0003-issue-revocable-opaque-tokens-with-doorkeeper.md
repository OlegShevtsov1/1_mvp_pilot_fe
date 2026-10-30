---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0003-issue-revocable-opaque-tokens-with-doorkeeper.md by sync-spec. Do not edit here. -->

# 0003 — Issue revocable opaque access tokens with Doorkeeper

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

Today each user has one never-expiring access token compared from the `X-User-Email` / `X-User-Token` headers
(`app/services/base_application/authenticate.rb:18`, `simple_token_authentication`). The PRD needs an access token per
sign-in (AC-02, AC-05, AC-08), sign-out that ends only the current device (AC-11), and Google sign-in linking that
cancels every existing access of the user (AC-06). This is an authentication change, so it needs this ADR and a
regression test (CLAUDE.md Hard Rules).

## Decision drivers

- QG-1 account safety: per-device revocation and revoke-all must be possible.
- PRD §6 token lifetime: valid until sign-out, or until 30 days pass without use.
- Devise 5 already manages accounts and password hashing (sad.md §2).

## Considered options

1. **Doorkeeper opaque tokens** — the Rails OAuth 2 provider issues random tokens, one database row each, stored
   hashed, on top of Devise (password grant for email sign-in).
2. **Signed JWT tokens** — self-contained tokens checked without a database lookup; revocation needs a separate
   deny-list.
3. **Per-device legacy tokens** — extend today's email + token scheme with a table of tokens per device, without a new
   gem.

## Decision outcome

**Chosen:** option 1. Revocation is the core requirement (sign-out, linking), and an opaque token row makes it a
single update, whereas JWT needs a deny-list that removes its lookup-free advantage, and a home-made token table means
custom security code with no standard flow for Google sign-in.

## Consequences

**Positive**
- Sign-out revokes the device's rows; Google linking revokes all rows of the user.
- Standard token endpoint and error shapes the frontend can follow; tokens stored hashed.

**Negative**
- One token lookup per request (cacheable; within the QG-3 budget).
- A new gem and new tables; the token endpoint and errors become part of the public contract.

**Neutral**
- The legacy access token stays until ADR-0005's cutoff; `simple_token_authentication` is removed in that contract
  release.

## Links

- PRD: [[../PRD.md]] AC-02, AC-05, AC-06, AC-08, AC-11, §6, §6.1
- SAD: [[../sad.md]] §4, §8
- Related ADR: [[0004-exchange-verified-google-id-token-for-access-token]],
  [[0005-accept-legacy-headers-alongside-bearer-until-evidence-cutoff]],
  [[0006-short-access-token-with-rotating-30-day-idle-refresh-token]]
