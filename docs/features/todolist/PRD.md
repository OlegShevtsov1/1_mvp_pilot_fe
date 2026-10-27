---
status: Approved
owner: "OlegShevtsov1"
reviewers: ["Tech Lead", "Security Lead"]
updated_at: "2026-10-22"
feature_size: "M"
stage: "03"
ticket: "Trello #222 (card 6ad9e7a3497aff024e1928c0)"
---
<!-- Copied from be@f8d0b86d06ead4db12af522fa3497992646bd2d0:docs/features/todolist/PRD.md by sync-spec. Do not edit here. -->

# PRD — todolist

> **Inputs (required):** [idea-brief](./idea-brief.md) · [CONTEXT](../../../CONTEXT.md) — the repository's root glossary is the glossary of record for this feature (author's decision, 2026-10-22); no feature-level CONTEXT.md exists.
> **Reference module:** the existing users, sessions, projects and tasks modules (`app/models/`, `app/services/`, `app/controllers/api/v1/`) — ownership rule, project/task validation limits, task statuses, project-deletion rule, sign-in failure message.
> **External context channels used:** architecture-map: `docs/architecture-map.md`; reference module code (above).

## 1. Context

The backend already holds users, projects and tasks, but there is no public way to use them: no landing page, no open sign-up, no Google sign-in and no dashboard. The access token a user gets today never expires, is the same on every sign-in and cannot be revoked for one device, which is not acceptable once anyone on the internet can sign up. The people this is for are public individuals who want a simple place for personal projects and tasks (idea-brief §3), plus the users whose devices still sign requests the old way.

This is the first real product feature on top of the pilot platform, whose deploy, error-tracking and release pipeline is now in place (release 0.2.0, 2026-10-20). Trello card #222 opens the work; there is no external deadline, but the backend budget is about two weeks.

Committed approach (idea-brief §13, Approach C — Standard Tokens, Polished List): every sign-in, by Google or by email and password, gives the device its own revocable access token; the legacy access token keeps working until the frontend has switched and none has been seen for 7 days; a guided dashboard leads a new user to a first completed task. To fit the budget, signing out other devices, email confirmation, password reset by email and per-project progress counts are cut (§3). Two points amend idea-brief §13 at the PRD interview (2026-10-22): the published cutoff date for old clients is replaced by an evidence-based cutoff (frontend switched and no legacy use for 7 days), and the per-project completed counts are cut, so the task status filter (AC-20) is now the only progress view.

Traceability: the reference code fixes today's rules this PRD keeps — a project name is 5–20 characters and its description 20–120; a task needs a name and a description; a task status is one of not started, in progress, completed; a project that still has tasks cannot be deleted; a failed sign-in gives one message for a wrong email and a wrong password alike. Today another user's project is refused with "not allowed"; this PRD changes that to hiding its existence (AC-17). Authentication changes need an ADR and a regression test (repository rule), and so does any change in how the public API answers; both the sign-in change and the AC-17 change in how another user's project is answered fall under that ADR, handled at the architecture stage.

## 2. Goals

- A visitor reaches a first completed task on their own: landing page, a choice of Google or email sign-up, and a dashboard that guides the first project and task.
- Every signed-in device holds its own access, which the user can end by signing out on that device (a lost device cannot be signed out from another one in this release), and the legacy access token is retired on evidence of non-use rather than on a guessed date.
- No existing user loses access or data while the sign-in method changes.

## 3. Non-goals

- Sharing projects or teams — a project keeps exactly one owner, which keeps every access rule simple.
- Reminders, notifications and due dates — a task keeps only a name, a description and a status in this release.
- Sign-in providers other than Google — one extra provider is enough to test whether it helps sign-up.
- Signing out other devices, email confirmation, password reset by email and per-project progress counts — cut to fit the two-week backend budget (idea-brief §15); the account-takeover risk that email confirmation would close is handled by Google sign-in cancelling the password instead.
- A native mobile app — the product is web only.

## 4. User stories

### US-01: Understand the app before signing up
**As a** visitor
**I want** to see what the app does and how to start
**So that** I can decide to sign up

### US-02: Sign up with email and password
**As a** visitor
**I want** to sign up with my email and a password
**So that** I can use the app without a Google account

### US-03: Start with Google sign-in
**As a** visitor, or a user who already has an account with the same email
**I want** to sign up or sign in with Google sign-in
**So that** I can start without inventing a password

### US-04: Sign in with email and password
**As a** user
**I want** to sign in with my email and password
**So that** I get back to my projects

### US-05: Sign out on this device
**As a** user
**I want** to sign out on the device I am using
**So that** nobody else at this device can use my account

### US-06: Keep access during the switch
**As a** user whose device still uses the legacy access token
**I want** to keep working until my device has moved to the new sign-in
**So that** I am not locked out before the frontend has switched

### US-07: Create and organize my projects
**As a** project owner
**I want** to create, rename and delete (when empty) my projects
**So that** my work stays grouped the way I think about it

### US-08: Add tasks and move their status
**As a** project owner
**I want** to add tasks to my project and change a task's status in one step
**So that** I can track my progress

### US-09: See my work at a glance
**As a** project owner
**I want** to see all my projects and their tasks in one place, filtered by task status
**So that** I know what to do next

### US-10: Get guided to a first task
**As a** user who has no projects yet
**I want** to be guided to create a first project and a first task
**So that** I reach a first completed task quickly

## 5. Acceptance criteria

### AC-01 (US-01) — happy
**Given** a visitor who is not signed in
**When** the visitor opens the app
**Then** the visitor sees what the app does and the two ways to start (Google sign-in or email and password), and sees no projects or tasks

### AC-02 (US-02) — happy
**Given** a visitor whose email no user has
**When** the visitor signs up with that email and a valid password
**Then** the system records a new user, the device is signed in with its own access token, and the user lands on their dashboard

### AC-03 (US-02) — error
**Given** a visitor on the sign-up screen
**When** the visitor submits a malformed email, a password shorter than the minimum, or a password confirmation that does not match
**Then** the system does not create a user and shows the visitor which field is wrong and what it must be

### AC-04 (US-02) — error
**Given** a visitor whose email already belongs to a user
**When** the visitor tries to sign up with that email
**Then** the system does not create a second user and tells the visitor that an account with this email exists and to sign in instead (with Google sign-in or the password)

### AC-04b (US-02) — error
**Given** many sign-ups have come from the same source in a short time
**When** another sign-up arrives from that source
**Then** the system refuses it and tells the visitor to wait before trying again

### AC-05 (US-03) — happy
**Given** a visitor whose Google account email no user has
**When** the visitor completes Google sign-in
**Then** the system records a new user with that email, the device is signed in with its own access token, and the user lands on their dashboard

### AC-06 (US-03) — domain invariant
**Given** a user who signed up with an email and a password, and who has projects
**When** someone completes Google sign-in with a Google account confirmed for that same email (the same address ignoring capital letters, so no second, empty account is created)
**Then** the Google account is linked to that user; the user's password, every access token and the legacy access token stop working; the device that completed Google sign-in is signed in and sees the user's existing projects

### AC-07 (US-03) — cross-context
**Given** a visitor who starts Google sign-in
**When** Google does not confirm that the person owns the email, or the person cancels the Google step
**Then** no user is created or linked, the visitor is told that Google sign-in did not complete, and the visitor can try again or use email and password

### AC-08 (US-04) — happy
**Given** a user with a password who is signed in on another device
**When** the user signs in with the correct email and password
**Then** this device is signed in with its own access token and the user sees their dashboard, while the other device keeps its access

### AC-09 (US-04) — error
**Given** a visitor on the sign-in screen
**When** the visitor enters an email no user has, or a wrong password for an existing user
**Then** the system refuses the sign-in with the same message in both cases and does not reveal which part was wrong

### AC-10 (US-04) — error
**Given** many failed sign-in attempts have come from the same source in a short time
**When** another sign-in attempt arrives from that source
**Then** the system refuses it without checking the password and tells the visitor to wait before trying again

### AC-11 (US-05) — happy
**Given** a user signed in on device A and on device B
**When** the user signs out on device A
**Then** device A loses access at once and is shown the sign-in screen, while device B keeps working

### AC-11b (US-05, US-06) — domain invariant
**Given** a user whose device still uses the legacy access token, before the cutoff
**When** that device signs out
**Then** the legacy access token stops working for every device that uses it, because it belongs to the account and cannot be ended for one device, and those devices are asked to sign in again

### AC-12 (US-06) — cross-context
**Given** a user whose device still sends the email together with the legacy access token, before the cutoff
**When** the device opens or changes the user's projects and tasks
**Then** the user has the same access as with an access token, and the system records that the legacy access token was used that day

### AC-13 (US-06) — domain invariant
**Given** the frontend has switched to access tokens and no legacy access token has been used for 7 days, so the cutoff has happened
**When** a device presents a legacy access token
**Then** the system refuses it and tells the user to sign in again, and the user's projects and tasks are unchanged

### AC-14 (US-07) — happy
**Given** a signed-in user
**When** the user creates a project with a valid name and description, or renames one of their projects
**Then** the project appears on their dashboard with the new name and the user is its project owner

### AC-15 (US-07) — error
**Given** a project owner on the project form
**When** the project owner submits a name outside 5–20 characters or a description outside 20–120 characters
**Then** the system does not save the project and shows the allowed length for that field

### AC-16 (US-07) — domain invariant
**Given** a project owner whose project still has tasks
**When** the project owner tries to delete that project
**Then** the system keeps the project and its tasks and explains that a project that still has tasks cannot be deleted

### AC-17 (US-07, US-08, US-09) — authorization
**Given** a user and a project or task that belongs to another user
**When** the user tries to see, change or delete that project or task
**Then** the system answers exactly as if it did not exist, so the user learns nothing about it, not even that it exists

### AC-18 (US-08) — happy
**Given** a project owner viewing one of their projects
**When** the project owner adds a task with a name and a description and later changes its status
**Then** the task is recorded as not started, each status change to in progress or completed takes one action, and the dashboard shows the new status

### AC-19 (US-08) — error
**Given** a project owner adding or changing a task
**When** the task name or description is empty, or the status is not one of not started, in progress or completed
**Then** the system does not save the task and shows what is allowed

### AC-20 (US-09) — happy
**Given** a project owner with several projects and tasks in different statuses
**When** the project owner opens the dashboard and picks a task status filter
**Then** the dashboard lists all their projects with their tasks and statuses, and with the filter shows only projects that have tasks in that status; no other user's data appears

### AC-21 (US-10) — happy
**Given** a signed-in user who has no projects
**When** the user opens the dashboard
**Then** the dashboard guides the user to create a first project, and once it exists, to add a first task to it

### AC-22 (US-09) — authorization
**Given** a visitor, or a device that has signed out
**When** it tries to open the dashboard or any project
**Then** it is sent to the sign-in screen and nothing about any project or task is shown

## 6. Non-functional requirements

| Aspect | Target | Measurement |
|---|---|---|
| Sign-in time p95, our part (email and password, or completing Google sign-in) | ≤ 800 ms | Server request timing, reviewed weekly |
| Dashboard list p95, for a user with up to 50 projects and 500 tasks | ≤ 300 ms | Server request timing, reviewed weekly |
| Task status change p95 | ≤ 300 ms | Server request timing, reviewed weekly |
| Availability | 99.5 % per month | Health check uptime, monthly |
| Existing users locked out by the sign-in change | 0 | Sign-in failures and refused requests in the 24 hours after each deploy, compared with the previous 7 days |
| Access token lifetime | Valid until sign-out, or until 30 days pass without use | Age and last use of an access token when it is refused |
| Abuse limits | ≤ 10 failed sign-ins per minute per source; ≤ 5 sign-ups per hour per source | Refusals counted per source |
| Legacy access token use | Counted daily, history kept ≥ 30 days | The daily count, read before the cutoff decision |

## 6.1 Security / privacy

- **Data classification:** confidential — accounts hold personal emails and the user's own project and task text.
- **Personal data touched:** email (existing); new: the identifier of the linked Google account (personal identifier, moderate sensitivity); per-device access tokens (secrets); daily legacy access token use per user (operational, low sensitivity).
- **AuthZ/AuthN impact:** a new way to sign in (Google sign-in) with automatic linking to an existing user of the same email that cancels the password and all existing access; access tokens issued per sign-in, ending at sign-out or after 30 idle days; the legacy access token accepted only until the cutoff; another user's projects and tasks hidden as if they did not exist instead of refused.
- **Abuse cases:**
  - Cross-tenant access (opening another user's project or task by guessing its number): hide existence (AC-17), so nothing is learned.
  - Account pre-registration (someone signs up with another person's email and a password): when the real owner completes Google sign-in, the password and all existing access are cancelled (AC-06); only an email Google confirms can trigger this (AC-07).
  - Password guessing and leaked-password lists: at most 10 failed sign-ins per minute per source, then refused for a while (AC-10).
  - Learning which emails are registered through sign-up: accepted for clearer sign-up (AC-04), limited to 5 sign-ups per hour per source.
  - Stolen access token (lost device, a script on the page): it ends at sign-out on that device or after 30 idle days, and Google sign-in cancels all of the user's existing access. Remaining risk, accepted for this release: a lost device cannot be signed out from another device, and a thief who keeps using the token never reaches 30 idle days. Sign-out on a device using the legacy access token ends it for all devices (AC-11b).
  - Injection through project or task text: shown to people only as plain text, never run as code or markup.
- **Security review:** Required — new authentication path, change of the access rules and new personal identifier; the repository rule also requires an ADR and a regression test for authentication changes, and the ADR also covers the change in how another user's project or task is answered (AC-17).

## 7. Metrics / KPIs

- **Time to first completed task (median, from landing to a completed task, unaided)** — baseline: not measurable (the journey does not exist); target: under 3 minutes in a first moderated session of 5 people before launch, then tracked for the first 30 days after launch.
- **Activation (share of new users who complete a first task within their first day)** — baseline: 0 (new); target: ≥ 40 % in the first 30 days after launch, computed from sign-up time and first task completion time.
- **Sign-ups per quarter** — baseline: 0; target: 500 per quarter (idea-brief §11 Reach assumption, to be checked against reality).
- **Legacy access token retirement** — baseline: every current device uses it; target: 0 uses for 7 days in a row after the frontend has switched, then the legacy way is removed in the next release.

## 8. Open questions

- [ ] Relax the project description rule (20–120 characters) for the first-project journey, since it adds typing against the 3-minute target? Default now: keep 20–120. — owner: OlegShevtsov1, due: before /sdlc-architecture-design
- [ ] What event marks "the frontend has switched" for the cutoff (a frontend release that no longer sends the legacy access token)? Default now: that frontend release. — owner: OlegShevtsov1, due: before /sdlc-break-tasks
- [ ] Who runs the moderated session of 5 people for the first KPI, and when? Default now: the owner, before launch. — owner: OlegShevtsov1, due: before /sdlc-ship-feature
- [ ] What is the real expected sign-up figure (marketing plan or audience)? Default now: 500 per quarter. — owner: OlegShevtsov1, due: before /sdlc-ship-feature
- [ ] Which cut feature comes back first after launch (signing out other devices, to close the lost-device gap)? Default now: signing out other devices. — owner: OlegShevtsov1, due: after launch review
- [ ] Does the cut scope fit two weeks of backend work (idea-brief §12 Time is still TBD)? Default now: yes, to be confirmed by the task estimate. — owner: OlegShevtsov1, due: /sdlc-break-tasks
