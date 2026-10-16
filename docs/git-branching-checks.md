# Git branching checks (C3b)

Operator-side checks of the `develop` branch model of the frontend (C3b: develop-guard, pr-conventions-check, Dev
Deploy from `develop`), run after the pull request that adds this file is merged. The same section is in that pull
request's body, where the `post-merge` workflow reads it.

## After merge (operator)

Executed by the `post-merge` workflow or by the operator, from an up-to-date clone of `OlegShevtsov1/1_mvp_pilot_fe`
on `main` (`git switch main && git pull --ff-only`), in bash, with `gh` authenticated for the repository. Run every
step exactly, compare with **Expected**, and **STOP on any mismatch**. Never print a secret. 🔒 = a GitHub write
that needs the operator at execution time. The branches and pull requests of A3–A6 are throwaway, are never
merged, and A7 deletes them. The squash merge of this PR deliberately triggered no Dev Deploy: from now on dev
deploys from `develop` and `hotfix/*` (decision 28), and A1/A2 deploy the same commit from `develop`.

**A0 — baseline: the merge commit on `main`, its checks, dev health (read-only).**
```bash
git switch main && git pull --ff-only && git rev-parse HEAD && git log -1 --format=%s
test -f .github/workflows/develop-guard.yml && test -f .github/workflows/pr-conventions-check.yml && echo files-present
gh run list -R OlegShevtsov1/1_mvp_pilot_fe --commit "$(git rev-parse HEAD)" --json workflowName,status,conclusion --jq '.[] | "\(.workflowName) \(.status) \(.conclusion)"' | sort
git ls-remote --heads origin develop | wc -l
curl -s -o /dev/null -w '%{http_code}\n' https://app.dev.pilot.up.km.ua/health
```
**Expected:** the full HEAD sha is printed and recorded, and the subject is this PR's squash subject (C3b);
`files-present`; the run list has `Front CI completed success` and `main-guard completed success` and no
`Dev Deploy` line; `0` (no `develop` yet); health → `200` (the previous deploy, same application code).

**A1 🔒 — create `develop` from the current `main` HEAD (GitHub write: new branch on origin).**
```bash
git fetch -q origin
git ls-remote --heads origin develop | wc -l
git push origin "$(git rev-parse origin/main):refs/heads/develop"
git fetch -q origin && git rev-parse origin/main origin/develop
```
**Expected:** `0` before the push (if it prints `1`, STOP: never overwrite an existing `develop`); the push prints
`* [new branch]` ending in `-> develop`; the last command prints two identical shas, equal to the A0 HEAD unless
`main` moved since A0.

**A2 — the creation push is the real push to `develop`: Front CI, develop-guard and Dev Deploy of that commit, health.**
```bash
sleep 60
bin/wait-dev-deploy "$(git rev-parse origin/develop)"
gh run list -R OlegShevtsov1/1_mvp_pilot_fe --branch develop --event push --json workflowName,conclusion,headSha --jq '.[] | "\(.workflowName) \(.conclusion) \(.headSha)"' | sort
gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow dev-deploy.yml --event workflow_run --limit 1 --json displayTitle,headBranch,headSha,conclusion --jq '.[0] | "\(.displayTitle) | \(.headBranch) \(.headSha) \(.conclusion)"'
curl -s -o /dev/null -w '%{http_code}\n' https://app.dev.pilot.up.km.ua/health
```
**Expected:** `Dev Deploy https://…: success` (within 1200 s); `Front CI success <develop sha>` and
`develop-guard success <develop sha>`; the Dev Deploy line starts with `Dev Deploy sha-<develop sha> |` and ends
in `success`. Record its `headBranch headSha` pair in the execution log: it shows whether GitHub reports the
triggering branch or the default branch for `workflow_run` runs. Health → `200`. The pilot dev alerts Telegram
topic shows `✅ Dev Deploy (deploy) sha-<develop sha> …`.

**A3 — `develop-guard` negative: a commit pushed directly to a twin of `develop` → ❌ alert.**
```bash
git switch -c develop-twin-guard-test origin/develop
git commit -q --allow-empty -m 'test: develop-guard dry run, direct push (throwaway)'
git push -q -u origin develop-twin-guard-test
gh workflow run develop-guard.yml -R OlegShevtsov1/1_mvp_pilot_fe --ref develop -f sha="$(git rev-parse develop-twin-guard-test)"
sleep 20
gh run watch -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow develop-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" > /dev/null
gh run view -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow develop-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" --json conclusion,jobs --jq '.conclusion, (.jobs[] | "\(.name) \(.conclusion)")'
git switch main
```
**Expected:** `failure`; `Commit came from a merged PR failure`; `Notify Telegram success`; the pilot dev alerts
Telegram topic shows `❌ develop-guard: commit <7 chars> on develop has no merged PR …`. The positive case is the
`develop-guard success` of A2.

**A4 — `pr-conventions-check` negative: branch `wip-test`, title without `PILOT-<n>:`, no `Type:` line → red with the exact reasons.**
```bash
git switch -c wip-test origin/develop
git commit -q --allow-empty -m 'chore: pr-conventions dry run (throwaway)'
git push -q -u origin wip-test
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --draft --base develop --head wip-test --title 'DO NOT MERGE: pr-conventions dry run (red)' --body 'Throwaway pull request of the C3b after-merge checks; closed without merging.'
sleep 30 && gh pr checks wip-test -R OlegShevtsov1/1_mvp_pilot_fe --watch || echo checks-failed
gh run view -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow pr-conventions-check.yml --branch wip-test --limit 1 --json databaseId --jq '.[0].databaseId')" --log-failed | grep -oE 'pr-conventions: .*' | sort -u
git switch main
```
**Expected:** a draft PR URL; `Branch name, PR title, Type line` is `fail` and `checks-failed` is printed; the
last command prints exactly three lines:
`pr-conventions: PR title must match ^PILOT-[0-9]+: .+$`,
`pr-conventions: branch 'wip-test' must match feature/PILOT-<n>-<slug> or hotfix/PILOT-<n>-<slug> (lowercase slug), or be archon/task-factory-* (develop only as the head of a release PR into main)`,
`pr-conventions: the PR body must have exactly one Type: line (found 0)`.

**A5 — `pr-conventions-check` positive: factory branch `archon/task-factory-test`, `PILOT-0:` title, one `Type:` line → green.**
```bash
git switch -c archon/task-factory-test origin/develop
git commit -q --allow-empty -m 'chore: pr-conventions dry run (throwaway)'
git push -q -u origin archon/task-factory-test
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --draft --base develop --head archon/task-factory-test --title 'PILOT-0: DO NOT MERGE pr-conventions dry run (green)' --body "$(printf '%s\n\n%s\n' 'Throwaway pull request of the C3b after-merge checks; closed without merging.' 'Type: test')"
sleep 30 && gh pr checks archon/task-factory-test -R OlegShevtsov1/1_mvp_pilot_fe --watch
git switch main
```
**Expected:** a draft PR URL; `gh pr checks` ends with `Branch name, PR title, Type line`, `TDD commit order` and
`Lint, typecheck, test, build` all `pass`, exit 0 (the `archon/task-factory-*` exception, decision 26).

**A6 — a PR with base `main` is not auto-merged: verify, do not merge.**
```bash
sed -n 's/^  base_branch: //p' .archon/factory-profile.yaml
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --draft --base main --head archon/task-factory-test --title 'PILOT-0: DO NOT MERGE base-main dry run' --body "$(printf '%s\n\n%s\n' 'Throwaway pull request of the C3b after-merge checks; closed without merging.' 'Type: test')"
sleep 30 && gh pr checks "$(gh pr list -R OlegShevtsov1/1_mvp_pilot_fe --base main --head archon/task-factory-test --json number --jq '.[0].number')" -R OlegShevtsov1/1_mvp_pilot_fe --watch
sleep 300
gh pr list -R OlegShevtsov1/1_mvp_pilot_fe --base main --head archon/task-factory-test --state all --json number,state,mergedAt --jq '.[] | "\(.number) \(.state) \(.mergedAt)"'
```
**Expected:** `"develop"`, so the factory opens and auto-merges PRs only into `develop` (decision 27); a draft PR
URL; checks pass; five minutes after green the PR is `OPEN` with `mergedAt` `null`, so nothing merged it. The
operator got only GitHub's own notification of the new PR. A factory-engine "notify instead of merge" for base
`main` does not exist (the factory always merges its own PR into `base_branch`), so file it as a follow-up card in
A11.

**A7 — delete every throwaway branch and pull request of A3–A6.**
```bash
git switch main
gh pr close "$(gh pr list -R OlegShevtsov1/1_mvp_pilot_fe --base main --head archon/task-factory-test --json number --jq '.[0].number')" -R OlegShevtsov1/1_mvp_pilot_fe --comment 'C3b after-merge dry run done.'
gh pr close archon/task-factory-test -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch --comment 'C3b after-merge dry run done.'
gh pr close wip-test -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch --comment 'C3b after-merge dry run done.'
gh api -X DELETE repos/OlegShevtsov1/1_mvp_pilot_fe/git/refs/heads/develop-twin-guard-test
git branch -D wip-test archon/task-factory-test develop-twin-guard-test 2>/dev/null; git fetch -q --prune origin
git ls-remote --heads origin wip-test archon/task-factory-test develop-twin-guard-test | wc -l
gh pr list -R OlegShevtsov1/1_mvp_pilot_fe --state open --search 'DO NOT MERGE in:title' --json number --jq length
git ls-remote --heads origin develop | wc -l
git status --porcelain
```
**Expected:** the three PRs are closed and not merged; `0`; `0`; `1` (`develop` itself stays); `git status
--porcelain` prints nothing.

**A8 🔒 — squash commits take the PR title and body (decision 25; GitHub write: repository setting).**
```bash
gh api repos/OlegShevtsov1/1_mvp_pilot_fe --jq '.squash_merge_commit_title, .squash_merge_commit_message'
gh api -X PATCH repos/OlegShevtsov1/1_mvp_pilot_fe -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=PR_BODY --jq '.squash_merge_commit_title, .squash_merge_commit_message'
```
**Expected:** first `COMMIT_OR_PR_TITLE` and `COMMIT_MESSAGES` (the current setting), then `PR_TITLE` and
`PR_BODY`. From now on a squash merge, including the factory's `gh pr merge --squash`, uses the subject
`PILOT-<n>: <card title>` and puts the PR body, with its `Type:` line, in the commit body.

**A9 🔒 — branch protection for `develop` (GitHub write; only on a public repository).**
```bash
gh repo view OlegShevtsov1/1_mvp_pilot_fe --json visibility --jq .visibility
```
**Expected:** `PRIVATE` → this step is **DEFERRED to PUB Крок 7**. GitHub Free answers branch protection on a
private repository with `403 Upgrade to GitHub Pro or make this repository public`; do not look for a workaround.
Record DEFERRED and move on. `PUBLIC` → run:
```bash
gh api -X PUT repos/OlegShevtsov1/1_mvp_pilot_fe/branches/develop/protection --input - <<'JSON'
{"required_status_checks":{"strict":false,"contexts":["Lint, typecheck, test, build","TDD commit order","Branch name, PR title, Type line"]},"enforce_admins":true,"required_pull_request_reviews":{"required_approving_review_count":0},"restrictions":null,"allow_force_pushes":false,"allow_deletions":false}
JSON
gh api repos/OlegShevtsov1/1_mvp_pilot_fe/branches/develop/protection --jq '.required_status_checks.contexts, .enforce_admins.enabled, .allow_force_pushes.enabled, .allow_deletions.enabled'
```
**Expected (public only):** the contexts are CI (`Lint, typecheck, test, build`), tdd-check (`TDD commit order`)
and pr-conventions-check (`Branch name, PR title, Type line`); then `true`, `false`, `false`. `develop-guard` is
deliberately not a required check: it runs on `push` after a merge and never reports on a pull request's head
commit, so requiring it would block every PR into `develop`. Direct pushes are refused by this protection, and any
commit that still lands on `develop` without a PR is reported by `develop-guard` (A3).

**A10 — the shared session hook `check-branch-name` is picked up by the plugin: DEFERRED until S3b is merged.**
No command. The hook ships in `1_mvp_sdlc` (`plugins/mvp-sdlc`, S3b) and is not part of this repository. Once S3b is
merged and the plugin updated, a Claude session in this repo running `git checkout -b wip-x` shows the
branch-name hint, and `git checkout -b feature/PILOT-1-x` or `archon/task-factory-x` shows none. Extending the
plugin's `block-main-push` to `develop` is not in S3b as written; file it as a follow-up card in A11.
**Expected:** recorded as `DEFERRED` (S3b).

**A11 — bookkeeping: Trello, Notion, execution log.**
The C3b card (label `run`) → `Done`, with a comment linking this PR and the verdicts of A0–A10. Record the A2
`headBranch headSha` observation, and A9 as applied or deferred to PUB Крок 7. The Notion page "Execution log —
C3b" and the C3b execution log of the SDLC addendum record the same. Follow-up cards:
1. The factory engine refuses or only notifies for a PR with base `main` (decision 27).
2. `block-main-push` in `mvp-sdlc` also protects `develop` (decision 27).
3. PUB Крок 7: `main-guard`/`develop-guard` cannot be required PR checks (push-only).
4. PR conventions for Dependabot PRs and for release PRs `develop → main` (C5).
5. If A2 showed the default branch as `headBranch`: the backend's `bin/wait-dev-deploy` (C2b) needs the
   display-title match of this PR.

**Expected:** card, Notion page and execution log updated; the follow-up cards exist.
