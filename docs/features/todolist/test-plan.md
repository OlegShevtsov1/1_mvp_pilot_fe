---
status: Draft
owner: "OlegShevtsov1"
reviewers: ["OlegShevtsov1 (implementing engineer)", "Tech Lead"]
updated_at: "2026-10-22"
feature_size: "M"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/test-plan.md by sync-spec. Do not edit here. -->

# Test plan — todolist

A visitor signs up with Google sign-in or email and password, every sign-in gives the device its own revocable access
token, the legacy access token keeps working until the cutoff, and a user manages their own projects and tasks from a
dashboard (PRD §2). Levels were confirmed by the author on 2026-10-22. Backend tests run in this repository; the
component and e2e-through-UI tests run in `1_mvp_pilot_fe`.

## Levels

| Level | Scope | Strategy (generic — no tool names) |
|---|---|---|
| Unit | Pure logic: a validator, a limit rule, the Google token check. | In-memory, no external dependency. |
| Integration | The backend against a real database and a real cache. | An ephemeral real database and cache started for the suite; Google is the only faked party, through fixture signing keys. |
| Contract | The API's request and response shapes against `contracts/openapi.yaml`, through the generated `swagger/v1/swagger.json`. | Request specs that validate each response against its schema; a spec fails if a response drifts. |
| E2E | N/A for the backend alone — the one end-to-end journey runs through the UI (below). | — |
| Load | The three numeric speed targets of PRD §6. | The load tool already in the repository, or one appropriate for the stack, against an ephemeral environment. |
| Component *(web-frontend)* | A screen or component in isolation: props and state → rendered output and interactions. | Render in a component harness with the network stubbed; no full app boot. |
| Visual-regression *(web-frontend)* | <!-- N/A: author chose not to commit to baselines while the design is being introduced --> | — |
| E2E-through-UI *(web-frontend)* | One user-story flow driven through the real UI. | The flow exercised through the rendered app against an ephemeral backend. |

## AC coverage

| AC (PRD.md §5) | Test name (intent-based) | Level | Expected outcome |
|---|---|---|---|
| AC-01 visitor sees the app and both ways to start | landing page explains the app and offers both starts | component + e2e-through-UI | explanation and both start options shown, no projects or tasks |
| AC-02 sign up with email and password | sign-up with a new email signs the device in | integration + contract | user recorded, token pair returned, dashboard opens |
| AC-03 invalid sign-up input | malformed email, short password and mismatched confirmation are blocked | unit + integration | no user created, the wrong field is named |
| AC-04 email already belongs to a user | sign-up with a taken email is refused | integration | no second user, told an account exists and to sign in |
| AC-04b too many sign-ups from one source | sixth sign-up in an hour from one source is refused | integration | refused, told to wait |
| AC-05 Google sign-in, unknown email | verified Google account with a new email creates a user | integration + contract | user created, token pair returned, dashboard opens |
| AC-06 Google sign-in, email of a password user | Google sign-in links the account and cancels password and all access | integration | old password, every earlier token and the legacy token refused, existing projects visible, capital-letter email variant links the same user |
| AC-07 Google does not confirm the email | unconfirmed or cancelled Google sign-in changes nothing | unit + integration | nothing created or linked, told it did not complete |
| AC-08 sign in with email and password | correct password gives this device its own token | integration + contract | token pair returned, other devices keep access |
| AC-09 wrong email or wrong password | wrong email and wrong password get the same refusal | integration | identical message, no hint which part was wrong |
| AC-10 too many failed sign-ins | eleventh failed sign-in in a minute is refused before the password is checked | integration | refused, told to wait; correct sign-ins not counted |
| AC-11 sign out on this device | sign-out ends one device only | integration + contract | that device refused at once, the other keeps working |
| AC-11b sign out on a legacy device | legacy sign-out rotates the legacy token | integration | the old legacy token stops working for every device using it |
| AC-12 legacy token before the cutoff | legacy headers work and are counted | integration | same access as a token, today's count for the user goes up by one, a pipeline-marked call adds nothing |
| AC-13 legacy token after the cutoff | legacy headers are refused when the legacy path is switched off | integration | refused, told to sign in again, data unchanged |
| AC-14 create or rename a project | valid project is created and renamed | contract + integration | project on the dashboard, caller is its owner |
| AC-15 project length limits | name or description outside the limits is blocked | unit + contract | not saved, allowed length shown |
| AC-16 delete a project with tasks | project with tasks cannot be deleted | integration | project and tasks kept, reason given |
| AC-17 another user's project or task | another user's item looks like a missing one | integration + contract | same answer as for a missing item, for projects and tasks, on read, change and delete |
| AC-18 add a task and change its status | new task starts not started and changes status in one action | contract + component | status recorded and shown |
| AC-19 invalid task input | empty name or description and a status outside the three are blocked | unit + contract | not saved, allowed values shown |
| AC-20 dashboard and status filter | dashboard lists own projects and filters by status | integration + component | only own data, only matching projects with the filter |
| AC-21 user with no projects | empty dashboard guides to a first project and then a first task | component + e2e-through-UI | guidance shown, then first task added |
| AC-22 signed-out visitor opens the dashboard | signed-out device is sent to sign-in | integration + component | nothing about any project shown |

## Edge cases / error paths

Each error and authorization acceptance criterion above (AC-03, AC-04, AC-04b, AC-07, AC-09, AC-10, AC-13, AC-15, AC-17,
AC-19, AC-22) has its own row; none is folded into a happy path. Additional cases from the SAD and the PRD:

- Access token expires while the user is working → refreshed once and the request repeated, typed input kept (integration + component).
- Refresh token revoked or 30 days old → refused, user sent to sign-in (integration).
- Refresh token used twice → the second use is refused (integration).
- Google signing keys unknown or rotated → keys refetched once, then the sign-in is refused if the key is still unknown (unit).
- Google token with the wrong audience, issuer, signature, expiry or an unverified email → refused (unit).
- Google account email differing only in capital letters from a password user → links the same user, no second account (integration).
- Deleting a user with tokens, an identity and legacy-use rows → succeeds and removes them (integration).
- Client address behind the proxy → the limit keys on the address the proxy forwards, never on a header from an untrusted caller (integration).
- Legacy sign-in is rate limited together with the token endpoint (integration).
- Purge job → old revoked or expired token rows and old legacy-use rows are deleted, active rows kept (integration).
- Deploy moment, old and new code side by side → a token issued by one is accepted by the other (checked in the smoke run).

## Test data

- Seed strategy: factories for users (password user, Google-only user), projects, tasks, access tokens and identities, matching `data-model.md`; fixture signing keys and fixture Google ID tokens for the Google tests; no real Google call and no real email.
- Integration dependency: an ephemeral real database and cache (throwaway containers in CI), NOT a mocked store. The rate-limit counters live in the real cache.
- Cleanup boundary: per-test — each test runs in its own transaction or is reset afterwards, and the rate-limit counters and the cache are cleared between tests so the limits cannot leak between tests.
- Placeholder values only (`user@example.test`); no real personal data.

## NFR validation (load)

- Sign-in time p95 ≤ 800 ms → scenario: 20 sign-ins a second for 2 minutes against the ephemeral environment, assert p95 ≤ 800 ms.
- Dashboard list p95 ≤ 300 ms for a user with up to 50 projects and 500 tasks → scenario: one seeded user, 100 list requests at 10 a second, assert p95 ≤ 300 ms.
- Task status change p95 ≤ 300 ms → scenario: 100 status changes at 10 a second on the seeded user, assert p95 ≤ 300 ms.
- Availability 99.5 % per month, the zero-lockout target and the abuse limits are not load scenarios: availability is the monthly health-check measure, the lockout target is checked by the post-deploy comparison and the smoke run (SAD §10 QG-2), and the abuse limits are the integration rows above.

## CI placement

- On every PR: unit, contract, integration (backend) and component (frontend) — the fast suites; integration uses throwaway containers and is still fast enough for a pull request.
- Pre-release or scheduled: the e2e-through-UI journey (landing, sign-up, first project, first task, completed — the PRD §7 time-to-first-task path) and the load scenarios, against dev after a Dev Deploy.
- After every deploy: `bin/swagger_smoke` with a bearer pass and, while the legacy path is on, a marked legacy pass (task T16).
