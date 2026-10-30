---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-28"
feature_size: M
stage: "07"
ticket: "PILOT-234"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0009-refuse-sign-ins-after-ten-failures-a-minute-per-source.md by sync-spec. Do not edit here. -->

# 0009 — Refuse sign-ins from a source after ten failures a minute, before the password is checked

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** OlegShevtsov1 (operator, T7 plan gate), Claude (T7 implementation)

## Context

Both password doors, `POST /oauth/token` (password grant, ADR-0003) and the legacy `POST /api/v1/sign_in`
(ADR-0005), checked the password on every request, so a source could guess without limit. AC-10 asks that many
failed sign-ins from one source in a short time get the next attempt refused without the password being checked,
telling the visitor to wait; AC-09 asks that an unknown email and a wrong password get the same answer. The contract
already lists `429 TooManyAttempts` with `Retry-After` on both operations. The Hard Rules require an ADR for a change
to authentication code and for a new status on a public operation.

## Decision drivers

- Successful sign-ins must not count (T7 definition of done); a user who signs in often is never refused.
- Failures at both doors are one budget, or an attacker doubles it by alternating.
- The source is the client address kamal-proxy forwards, believed only when the request comes from the proxy
  (SAD §7); Rails' `remote_ip` believes `X-Forwarded-For` from any caller.
- Prefer what the project already uses (`.claude/rules/security.md`); the SAD names the existing `RateLimitStore`.

## Considered options

1. **Count failures in the existing `RateLimitStore`, check before the password** — `Auth::FailedSignInLimit`
   counts each password attempt under `failed-sign-in:<source>:<minute>` before any credential lookup, in one atomic
   increment, and gives the count back unless the credentials were wrong, so a success or a server error during the
   check does not count; both doors answer 429 with `Retry-After: 60` to
   the attempt that takes the source past 10 in its window, the clock minute the key names. Counting before the check keeps attempts in
   flight together from all passing a count none of them has added to yet. The OAuth
   door does this in `Oauth::TokensController`, a `Doorkeeper::TokensController` subclass, because Doorkeeper
   renders its own errors only with OAuth statuses. The source is `remote_ip` when the direct peer is in Rails'
   trusted-proxy list, otherwise the direct peer.
2. **Rails `rate_limit`** — counts every request, successful sign-ins included.
3. **`rack-attack`** — a new dependency for what the existing store already does.
4. **Per-account lockout** — anyone who knows an email could lock its owner out; the PRD says per source.

## Decision outcome

**Chosen:** option 1. It is the only option that counts failures alone, shares one budget across both doors, and
adds no dependency; the source rule keeps a caller from picking its own bucket with a forged header.

## Consequences

**Positive**
- Password guessing from one source is capped at 10 a minute on both doors; the refused attempt reveals nothing
  about the account.

**Negative**
- Visitors behind one NAT or office address share a bucket.
- The window is fixed (windows are clock minutes), so up to 20 failures can land across a window edge.

**Neutral**
- A refused (429) attempt adds to the count without moving the window's end; a success gives back only its own
  attempt and does not reset the failures before it. A give-back returns the attempt to the minute it was counted
  in, whichever store remembers it, so one that lands after that minute changes nothing the next minute counts, and
  a minute whose count was lost is not taken below zero (PILOT-288).
- "The proxy" is any address in Rails' trusted-proxy list (loopback and private ranges); no proxy address is pinned
  in config. Narrowing it later is a config change; the list is matched with `===`, as Rails' `RemoteIp` does, so
  addresses, ranges and patterns all work.
- When Redis fails, the count falls back to per-process memory, like the other limits.
- Devise's default routes (`devise_for :users`) were a third password door, `POST /users/sign_in`, that checked
  passwords outside this limit, and an unlimited sign-up door, `POST /users` (AC-04b); they are not mounted
  (`devise_for :users, skip: :all`), which keeps the Devise model methods the password grant uses. Only the two doors
  above check passwords; `spec/routing/auth_routes_spec.rb` pins the authentication routes (PILOT-362).

## Links

- PRD: [[../PRD.md]] AC-09, AC-10
- SAD: [[../sad.md]] §7, §8, §9
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]], [[0005-accept-legacy-headers-alongside-bearer-until-evidence-cutoff]]
