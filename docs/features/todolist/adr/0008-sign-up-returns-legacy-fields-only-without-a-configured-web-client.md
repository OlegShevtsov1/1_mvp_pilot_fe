---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "07"
ticket: "PILOT-233"
---
<!-- Copied from be@f8d0b86d06ead4db12af522fa3497992646bd2d0:docs/features/todolist/adr/0008-sign-up-returns-legacy-fields-only-without-a-configured-web-client.md by sync-spec. Do not edit here. -->

# 0008 — Sign-up returns the legacy fields only while no web client is configured

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (operator, T6 plan gate), Claude (T6 implementation)

## Context

Sign-up issues an access and refresh token pair for the public web client whose uid is `OAUTH_CLIENT_ID` (ADR-0003,
ADR-0006). That variable is optional on every deploy (`config/deploy.yml`, `config/deploy.dev.yml`: empty when
unset), and PR #69 promised the container behaves as before while it is unset. Without a client there is nothing
to issue a token for, yet the contract's `SignUpResult.data` listed the three token fields as required.

## Decision drivers

- QG-2 no lockout during the switch; legacy clients keep working until the cutoff (ADR-0005).
- `bin/swagger_smoke` signs up on every deploy, including environments the operator has not configured yet.
- The contract must describe every response the code gives (`.claude/rules/api.md`).

## Considered options

1. **Optional token fields** — sign-up succeeds and returns the legacy fields only while no web client is
   configured; `access_token`, `refresh_token` and `expires_in` are present whenever a pair was issued. A uid that
   names no application is reported to GlitchTip.
2. **Refuse sign-up without a client** — every sign-up fails until `OAUTH_CLIENT_ID` and its application exist.

## Decision outcome

**Chosen:** option 1. It keeps sign-up and the deploy smoke working on an unconfigured environment, which option 2
would break, and the contract now says when the token fields are absent.

## Consequences

**Positive**
- Rolling the feature out does not depend on configuring the web client first.

**Negative**
- A client must treat the token fields as optional and fall back to the legacy token until the cutoff.

**Neutral**
- Once every environment has its web client, the fields can be made required again in the contract release that
  removes the legacy token (ADR-0005).

## Links

- PRD: [[../PRD.md]] AC-02
- SAD: [[../sad.md]] §5, §9
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]], [[0005-accept-legacy-headers-alongside-bearer-until-evidence-cutoff]], [[0006-short-access-token-with-rotating-30-day-idle-refresh-token]]
