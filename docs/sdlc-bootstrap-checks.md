# SDLC bootstrap checks (C3)

Operator-side checks of the frontend SDLC bootstrap (C3, PR #9), run after the pull request that adds this file
is merged. The same section is in that pull request's body, where the `post-merge` workflow reads it.

## After merge (operator)

Executed by the `post-merge` workflow or by the operator, from an up-to-date clone of `OlegShevtsov1/1_mvp_pilot_fe`
on `main` (`git switch main && git pull --ff-only`), in bash, with `gh` authenticated for the repository. Run every
step exactly, compare with **Expected**, and **STOP on any mismatch**. Never print a secret. 🔒 = needs the operator
at execution time. Nothing here changes `main`: the branches and pull requests of A3 and A4 are throwaway, are never
merged, and A5 deletes them. These are the operator-side checks of C3 (PR #9), which shipped without this section.

**A0 — baseline: CI on `main` green, HEAD recorded (read-only).**
```bash
git switch main && git pull --ff-only && git rev-parse HEAD
gh run list -R OlegShevtsov1/1_mvp_pilot_fe --commit "$(git rev-parse HEAD)" --json workflowName,status,conclusion --jq '.[] | "\(.workflowName) \(.status) \(.conclusion)"' | sort
curl -s -o /dev/null -w '%{http_code}\n' https://app.dev.pilot.up.km.ua/health
```
**Expected:** the full HEAD sha is printed and recorded (the merge commit of this PR or a later one); the run list
contains `Dev Deploy completed success`, `Front CI completed success` and `main-guard completed success`; health →
`200`.

**A1 🔒 — operator gate on `docs/architecture-map.md` (manual; may be deferred to the P3 session).**
Spot-check five conventions of the map against the code they cite, and that the map still describes the app:
```bash
sed -n '20p' src/main.tsx
sed -n '22p' src/App.tsx
sed -n '17p' src/App.tsx
sed -n '2p' src/App.tsx
sed -n '46p' src/App.test.tsx
sed -n '27p' tests/support.ts
sed -n 's/^reflects_commit: //p' docs/architecture-map.md
git diff --quiet 09a7cc6 HEAD -- src index.html package.json docker nginx.conf Dockerfile && echo app-unchanged
```
**Expected:** 1. module wiring (`src/main.tsx:20`) contains `<App config={config} errorTest={errorTest} />`;
2. error handling (`src/App.tsx:22`) contains `} catch {`; 3. inter-module communication (`src/App.tsx:17`)
contains `await fetch(`; 4. UI / styling (`src/App.tsx:2`) is `import './App.css'`; 5. tests (`src/App.test.tsx:46`,
`tests/support.ts:27`) contain `it('shows the status the backend reports from /health'` and
`export function fakeCommand(`; `reflects_commit` is `"09a7cc6"` and `app-unchanged` is printed (the map was
written before the squash merge of #9, which changed no application file). Then the operator reads the map's
"Module inventory" and "Frontend / UI foundation" and confirms the boundaries: components, styles, design tokens,
runtime `/config.js`, routing, API client. Confirmed → a follow-up docs PR removes the line "Boundaries pending
operator confirmation (C3 after-merge gate)." from the map. Deferred → answer the gate `skip` with the note
`deferred to P3`.

**A2 — `.claude/sdlc.local.md` commands are the CI commands, string for string.**
The file is per-developer and gitignored; when it is missing it is created with the CI strings (the template of
`/mvp-sdlc:bootstrap-project fe` writes `cmd_vet: "npx tsc --noEmit"`, which checks nothing here — see the README).
`sdlc.local.md` has no build or secret-scan key, so `build` and `gitleaks` are compared through `CLAUDE.md`
§Commands (CI runs the downloaded binary as `./gitleaks`).
```bash
test -f .claude/sdlc.local.md && echo present || { printf '%s\n' '---' 'tdd: true' 'cmd_test_unit: "npm test"' 'cmd_lint: "npm run lint"' 'cmd_vet: "npm run typecheck"' '---' > .claude/sdlc.local.md && echo created; }
git check-ignore -q .claude/sdlc.local.md && echo ignored
git status --porcelain
sed -nE 's/^cmd_(test_unit|lint|vet): *"(.*)"$/\2/p' .claude/sdlc.local.md | wc -l
diff <(sed -nE 's/^cmd_(test_unit|lint|vet): *"(.*)"$/\2/p' .claude/sdlc.local.md | sort) <(sed -nE 's/^ +run: (npm test|npm run lint|npm run typecheck)$/\1/p' .github/workflows/front-ci.yml | sort) && echo identical-sdlc-local
diff <(sed -nE 's/^- (Secrets in the full history|Lint|Build): `(.*)`$/\2/p' CLAUDE.md | sort) <(sed -nE 's/^ +(run: |\.\/)(gitleaks git .*|npm run lint|npm run build)$/\2/p' .github/workflows/front-ci.yml | sort) && echo identical-claude-md
```
**Expected:** `present` or `created`; `ignored`; `git status --porcelain` prints nothing; `3`; `identical-sdlc-local`
and `identical-claude-md`, with no diff lines. A diff line is a mismatch: STOP (the fix goes into the local file
only, never into a commit).

**A3 — `tdd-check` dry run, correct order → green (throwaway branch `chore/tdd-dryrun-green`).**
```bash
git switch -c chore/tdd-dryrun-green origin/main
printf '%s\n' "import { expect, it } from 'vitest'" "import { tddDryRun } from './tddDryRun'" "" "it('answers ok', () => {" "  expect(tddDryRun()).toBe('ok')" "})" > src/tddDryRun.test.ts
git add src/tddDryRun.test.ts && git commit -q -m 'test(dryrun): tdd-check dry run, RED'
printf '%s\n' "export function tddDryRun(): string {" "  return 'ok'" "}" > src/tddDryRun.ts
git add src/tddDryRun.ts && git commit -q -m 'feat(dryrun): tdd-check dry run, GREEN'
git push -q -u origin chore/tdd-dryrun-green
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --draft --base main --head chore/tdd-dryrun-green --title 'DO NOT MERGE: tdd-check dry run (green)' --body 'Throwaway pull request of the C3 after-merge checks; closed without merging.'
sleep 30 && gh pr checks chore/tdd-dryrun-green -R OlegShevtsov1/1_mvp_pilot_fe --watch
```
**Expected:** a draft PR URL is printed; `gh pr checks` ends with `TDD commit order` and
`Lint, typecheck, test, build` both `pass`, exit 0.

**A4 — `tdd-check` dry run, tests edited in the `feat(` commit → red (`chore/tdd-dryrun-red`).**
```bash
git switch -c chore/tdd-dryrun-red chore/tdd-dryrun-green~1
printf '%s\n' "export function tddDryRun(): string {" "  return 'ok'" "}" > src/tddDryRun.ts
sed -i "s/answers ok/answers ok, test edited after RED/" src/tddDryRun.test.ts
git add src/tddDryRun.ts src/tddDryRun.test.ts && git commit -q -m 'feat(dryrun): tdd-check dry run, tests changed'
git push -q -u origin chore/tdd-dryrun-red
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --draft --base main --head chore/tdd-dryrun-red --title 'DO NOT MERGE: tdd-check dry run (red)' --body 'Throwaway pull request of the C3 after-merge checks; closed without merging.'
sleep 30 && gh pr checks chore/tdd-dryrun-red -R OlegShevtsov1/1_mvp_pilot_fe --watch || echo checks-failed
gh run view -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow tdd-check.yml --branch chore/tdd-dryrun-red --limit 1 --json databaseId --jq '.[0].databaseId')" --log-failed | grep -E 'tests changed between|src/tddDryRun.test.ts' | head -n 3
```
**Expected:** a draft PR URL is printed; `TDD commit order` is `fail` and `checks-failed` is printed; the failed log
contains `tdd-check: tests changed between the test commit and the feat/fix commit:` and `src/tddDryRun.test.ts`.

**A5 — delete the throwaway branches and pull requests of A3 and A4.**
```bash
git switch main
gh pr close chore/tdd-dryrun-green -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch --comment 'C3 after-merge dry run done.'
gh pr close chore/tdd-dryrun-red -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch --comment 'C3 after-merge dry run done.'
git branch -D chore/tdd-dryrun-green chore/tdd-dryrun-red 2>/dev/null; git fetch -q --prune origin
git ls-remote --heads origin 'chore/tdd-dryrun-*' | wc -l
git branch --list 'chore/tdd-dryrun-*' | wc -l
gh pr list -R OlegShevtsov1/1_mvp_pilot_fe --state open --search 'tdd-check dry run in:title' --json number --jq length
git status --porcelain
```
**Expected:** both PRs closed (not merged); `0`, `0`, `0`; `git status --porcelain` prints nothing.

**A6 — `main-guard` dry run on a commit that did not come from a pull request → alert.**
`0e825973808dbf6372c76922c17211dc01fc2143` ("feat: migrate to Vite + add Docker/Traefik deployment") was pushed to
`main` directly, before the pull request rule.
```bash
gh workflow run main-guard.yml -R OlegShevtsov1/1_mvp_pilot_fe --ref main -f sha=0e825973808dbf6372c76922c17211dc01fc2143
sleep 20
gh run watch -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow main-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" > /dev/null
gh run view -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow main-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" --json conclusion,jobs --jq '.conclusion, (.jobs[] | "\(.name) \(.conclusion)")'
```
**Expected:** `failure`; `Commit came from a merged PR failure`; `Notify Telegram success`; the pilot dev alerts
Telegram topic shows `❌ main-guard: commit 0e82597 on main has no merged PR …`.

**A7 — `main-guard` dry run on a merge commit → no alert.**
```bash
gh workflow run main-guard.yml -R OlegShevtsov1/1_mvp_pilot_fe --ref main -f sha=5520bbf145a38c2ee0c80233f4cca7f3d48629be
sleep 20
gh run watch -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow main-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" > /dev/null
gh run view -R OlegShevtsov1/1_mvp_pilot_fe "$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow main-guard.yml --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')" --json conclusion,jobs --jq '.conclusion, (.jobs[] | "\(.name) \(.conclusion)")'
```
**Expected:** `success`; `Commit came from a merged PR success`; `Notify Telegram skipped`; no new Telegram message.

**A8 — no environment values in `src/` or in a fresh `dist/` build.**
```bash
rm -rf dist && npm ci && npm run build
grep -rnE 'dev\.pilot\.up\.km\.ua|pilot\.up\.km\.ua|track\.' src/ dist/ | wc -l
grep -rnE 'DSN' src/ dist/ | grep -vE 'SENTRY_DSN|without a DSN|No DSN provided|DSN not configured' | wc -l
bash scripts/check-bundle-config.sh src dist
```
**Expected:** build exit 0; `0`; `0`; `bundle-config check: clean`. The plan's pattern also lists the bare word
`DSN`; it matches only the config key name `SENTRY_DSN` (`src/config.ts`, `src/sentry.ts`, their tests), one test
title and two log messages of the Sentry SDK in `dist/`, none of which is a value — the second command filters
exactly those, and a DSN value (a URL with credentials) is caught by the third.

**A9 — dry run of the factory up to Gate 2 on a trivial brief: DEFERRED to C8.T1.**
No command. The first factory task of the pilot feature (C8.T1) runs the factory on this repository with the new
`CLAUDE.md`, rules and hooks and shows whether Gate 2 passes without unexpected blocks.
**Expected:** recorded as `DEFERRED` (C8.T1).

**A10 — bookkeeping: Trello, Notion, execution log.**
The C3 card (label `run`) stays in `Done`, with a comment linking this PR and the verdicts of A0–A9; the Notion
page "Execution log — C3" and the C3 execution log of the SDLC addendum record the same, including A9 deferred to
C8.T1 and A1 if it was deferred to P3.
**Expected:** card, Notion page and execution log updated.
