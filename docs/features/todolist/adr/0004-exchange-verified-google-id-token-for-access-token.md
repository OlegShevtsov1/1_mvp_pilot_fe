---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0004-exchange-verified-google-id-token-for-access-token.md by sync-spec. Do not edit here. -->

# 0004 — Exchange a verified Google ID token for our access token

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

Google sign-in must create a user (AC-05) or link to an existing user with the same email and cancel their password and
all existing access (AC-06), but only when Google confirms that the person owns that email (AC-07). The API is
API-only with no cookie session (sad.md §2), and tokens are issued by Doorkeeper (ADR-0003).

## Decision drivers

- QG-1 account safety: linking must happen only on an email Google vouches for (PRD §6.1 pre-registration abuse case).
- No cookie session or server-side state in the API.
- Public repository: no secret should be needed where it can be avoided.

## Considered options

1. **ID-token exchange** — the browser uses Google's sign-in button, receives a Google ID token (a signed statement of
   the account and its email) and sends it to our token endpoint as a custom grant; the backend verifies the
   signature against Google's published keys, the audience (our client id), the issuer, the expiry and the
   verified-email flag, then links or creates the user and issues our tokens.
2. **Server-side redirect flow** — the backend redirects to Google and handles the callback with a client secret,
   which needs a cookie session for the state check and a hand-off of our token back to the SPA.

## Decision outcome

**Chosen:** option 1. It fits the API-only, cookie-less design, keeps every token issue on one endpoint, needs only the
public client id, and puts the verified-email check — the condition that makes AC-06 safe — on the backend.

## Consequences

**Positive**
- One token endpoint for both sign-in methods; no session, no client secret.
- Email matching ignores capital letters (AC-06), so no second, empty account is created.

**Negative**
- The backend must fetch and cache Google's signing keys; a Google outage blocks Google sign-in (email sign-in keeps
  working).
- A new dependency for ID-token verification, to be justified in the pull request.

**Neutral**
- The link stores the Google account identifier (personal identifier, PRD §6.1); the shape is decided in the data
  model stage.

## Links

- PRD: [[../PRD.md]] AC-05, AC-06, AC-07, §6.1
- SAD: [[../sad.md]] §3, §4, §6
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]]
