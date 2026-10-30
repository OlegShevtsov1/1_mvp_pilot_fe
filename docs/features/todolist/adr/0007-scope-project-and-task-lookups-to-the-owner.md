---
status: Accepted
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: M
stage: "04-05"
ticket: "PILOT-222"
---
<!-- Copied from be@e189f0f581b7fb19b3d94dd70de5e0d2b9d57633:docs/features/todolist/adr/0007-scope-project-and-task-lookups-to-the-owner.md by sync-spec. Do not edit here. -->

# 0007 — Scope project and task lookups to the owner, so other users' items are not found

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** OlegShevtsov1 (Architect), Claude (architecture-design walk)

## Context

PRD AC-17 requires that a user who tries to see, change or delete another user's project or task learns nothing about
it, not even that it exists. Today the controllers load the record by id and CanCanCan refuses access with "You are
not authorized to perform this action" (`app/controllers/concerns/authorization.rb:6`), which confirms that the id
exists. Changing that answer changes an operation's status in the public contract, which needs an ADR (CLAUDE.md Hard
Rules).

## Decision drivers

- QG-1 account safety; PRD §6.1 cross-tenant abuse case.
- The contract (`swagger/v1/swagger.json`) and `bin/swagger_smoke` depend on the answers of the project and task
  operations.

## Considered options

1. **Scope lookups to the owner** — projects are loaded only from the signed-in user's projects and tasks only from
   those projects, so another user's item is simply not found.
2. **Translate refusals to not found** — keep loading by id and checking with CanCanCan, but answer its refusal with
   the not-found answer.

## Decision outcome

**Chosen:** option 1. There is a single path for "not yours" and "does not exist", so the two cannot drift apart or be
told apart by their answer; `Ability` remains as a second line of defence.

## Consequences

**Positive**
- Another user's project or task is indistinguishable from a missing one.
- Simpler controllers: the owner scope does the work the authorization check did.

**Negative**
- Contract change: the project and task operations no longer return the "not authorized" answer for other users'
  items; the rswag specs, `swagger/v1/swagger.json`, `bin/swagger_smoke` (user B reading user A's project) and the
  frontend must expect "not found". Shipped with this feature's contract release.

**Neutral**
- The `Authorization` concern stays for any future rule that is not about ownership.

## Links

- PRD: [[../PRD.md]] AC-17, §6.1
- SAD: [[../sad.md]] §8
- Related ADR: [[0003-issue-revocable-opaque-tokens-with-doorkeeper]]
