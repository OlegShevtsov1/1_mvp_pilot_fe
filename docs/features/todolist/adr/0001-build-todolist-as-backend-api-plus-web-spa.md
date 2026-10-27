---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@f8d0b86d06ead4db12af522fa3497992646bd2d0:docs/features/todolist/adr/0001-build-todolist-as-backend-api-plus-web-spa.md by sync-spec. Do not edit here. -->

# 0001 — Build todolist as a backend API plus a web SPA

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

The PRD's success measure is a browser journey: landing → sign-up → first project → first task → completed (PRD §7,
AC-01, AC-21), while the rules behind it (sign-up, sign-in, ownership, task statuses) live in the API (AC-02–AC-20,
AC-22). The backend lives in this repository and the browser app in `1_mvp_pilot_fe`, which today has one status
screen and no sign-in (sad.md §2).

## Decision drivers

- PRD §7 KPI "time to first completed task under 3 minutes" is measured in the browser.
- QG-2 no lockout during the switch, QG-3 responsiveness (sad.md §1).
- Two repositories, one contract (`swagger/v1/swagger.json`) owned by this repository.

## Considered options

1. **`[backend-service, web-frontend]`** — design the API and the screens together in this SAD.
2. **`[backend-service]` only** — design the API here; the frontend designs its screens separately against the
   contract.

## Decision outcome

**Chosen:** option 1. The journey and the guided empty states are acceptance criteria of this feature, so the
screens need an architecture owner, and designing both together keeps the contract and the screens consistent.

## Consequences

**Positive**
- Downstream stages (contracts, flows, tasks, tests) produce frontend work and browser-level tests too.
- The contract is designed for its real consumer.

**Negative**
- More tasks and test tiers; frontend tasks land in another repository with its own pull requests.

**Neutral**
- Data stores are not surfaces; they stay with the backend container.

## Links

- PRD: [[../PRD.md]]
- SAD: [[../sad.md]] §4, §5
- Related ADR: [[0002-client-side-spa-in-existing-react-app]]
