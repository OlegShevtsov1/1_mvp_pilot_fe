---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0006-short-access-token-with-rotating-30-day-idle-refresh-token.md by sync-spec. Do not edit here. -->

# 0006 — Use a one-hour access token with a rotating refresh token that dies after 30 idle days

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

PRD §6 says an access token is valid until sign-out, or until 30 days pass without use, and the idea-brief edge case
warns against signing people out mid-work. The browser app has no storage in use today (sad.md §2), and a token kept
where page scripts can read it is exposed to a compromised script (PRD §6.1 stolen-token abuse case). Tokens are issued
by Doorkeeper (ADR-0003).

## Decision drivers

- QG-1 account safety: limit how long a stolen token is useful.
- PRD §6 lifetime rule; QG-3 no extra write on every request.
- Frontend and API may be on different sites, so cross-site cookies cannot be relied on.

## Considered options

1. **One-hour access token plus rotating refresh token, both in localStorage** — every refresh replaces the refresh
   token, and a refresh token older than 30 days is refused, which is exactly "30 days without use"; mitigated by a
   strict Content-Security-Policy, no third-party scripts and text-only rendering.
2. **Same lifetimes, refresh token in an httpOnly cookie** — scripts cannot read it, but it needs cross-site cookies
   between frontend and API and request-forgery protection on the refresh call.
3. **One 30-day sliding access token** — its expiry moves forward on each use; simplest client, but a stolen token
   lives as long as the thief keeps using it and every request writes.

## Decision outcome

**Chosen:** option 1. It meets the lifetime rule exactly, caps a stolen access token at one hour, avoids per-request
writes and cross-site cookie problems, and fits the budget; its script-theft exposure is handled by the frontend's
Content-Security-Policy and the absence of third-party scripts.

## Consequences

**Positive**
- Active users are never signed out mid-work; idle devices end after 30 days.
- Sign-out revokes both tokens of the device.

**Negative**
- A script running on the page could read both tokens; the frontend must ship a strict Content-Security-Policy and no
  third-party scripts (recorded in sad.md §8 and §11).
- The frontend must refresh before or on expiry and retry once, and must not lose typed input on a refresh.

**Neutral**
- Moving the refresh token into a cookie later needs only frontend and refresh-endpoint changes, not a data migration.

## Links

- PRD: [[../PRD.md]] §6 (token lifetime), §6.1, AC-11
- SAD: [[../sad.md]] §4, §8, §11
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]]
