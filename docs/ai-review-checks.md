# AI review checks (C3c)

Operator-side checks of the AI review of pull requests (C3c, decision 32: `.github/workflows/ai-review.yml`,
`scripts/ai-review-report.sh`, the repository variable `AI_REVIEW`), run after the pull request that adds this file
is merged into `develop`. The same section is in that pull request's body, where the `post-merge` workflow reads it.

## After merge (operator)

Executed by the `post-merge` workflow or by the operator, from an up-to-date clone of `OlegShevtsov1/1_mvp_pilot_fe`, in
bash, with `gh` authenticated for the repository. Run every step exactly, compare with **Expected**, and **STOP on
any mismatch**. Never print a secret value. 🔒 = a GitHub write that needs the operator at execution time. The probe
branches and PRs of A3–A4 are throwaway and are never merged; A4 deletes them.

**A0 — baseline: the squash commit on `develop`, its checks, Dev Deploy and dev health (read-only).**
```bash
git fetch -q origin && git switch develop && git pull --ff-only && git log -1 --format='%H %s'
test -f .github/workflows/ai-review.yml && test -x scripts/ai-review-report.sh && echo files-present
gh run list -R OlegShevtsov1/1_mvp_pilot_fe --commit "$(git rev-parse HEAD)" --json workflowName,conclusion --jq '.[] | "\(.workflowName) \(.conclusion)"' | sort
gh variable list -R OlegShevtsov1/1_mvp_pilot_fe | grep -c '^AI_REVIEW' || true
curl -s -o /dev/null -w '%{http_code}\n' https://app.dev.pilot.up.km.ua/health
```
**Expected:** the subject is `PILOT-0: AI PR review workflow with AI_REVIEW switch (decision 32) (#<n>)`;
`files-present`; `Front CI success`, `develop-guard success` and `Dev Deploy success` (application unchanged);
`0` (variable not set, so off); health `200` within 600 s.

**A1 — the review secret is present (value never printed).**
```bash
gh secret list -R OlegShevtsov1/1_mvp_pilot_fe | cut -f1 | grep -x CLAUDE_CODE_OAUTH_TOKEN
```
**Expected:** the list prints `CLAUDE_CODE_OAUTH_TOKEN` (set by the operator, decision 33 a). If not, set it 🔒 with
`gh secret set CLAUDE_CODE_OAUTH_TOKEN -R OlegShevtsov1/1_mvp_pilot_fe` (paste the token at the prompt; never as an
argument). Using `ANTHROPIC_API_KEY` instead needs a reviewed PR switching the input back to `anthropic_api_key`
(README "AI PR review").

**A2 🔒 — switch AI review on.**
```bash
gh variable set AI_REVIEW -b on -R OlegShevtsov1/1_mvp_pilot_fe
gh variable get AI_REVIEW -R OlegShevtsov1/1_mvp_pilot_fe
```
**Expected:** `on`.

**A3 🔒 — `on`: red on a P1, green after the fix, factory head skipped, comment re-review.**
```bash
git switch develop && git pull --ff-only && git switch -c feature/PILOT-0-ai-review-probe
cat > scripts/ai-review-probe.js <<'EOF'
// Throwaway probe for the AI review (C3c A3); never merged.
const params = new URLSearchParams(window.location.search)
document.getElementById('out').innerHTML = params.get('q')
EOF
git add scripts/ai-review-probe.js && git commit -q -m 'chore(ci): AI review probe' && git push -u origin feature/PILOT-0-ai-review-probe
printf 'Probe for ai-review, will be closed.\n\nType: chore\n' > /tmp/ai-review-probe-body.md
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --base develop --head feature/PILOT-0-ai-review-probe --title 'PILOT-0: AI review probe' --body-file /tmp/ai-review-probe-body.md
gh pr checks feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --watch | grep 'AI review'
gh pr view feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --json comments --jq '[.comments[] | select(.body | startswith("<!-- ai-review -->"))] | length, (last.body)'
```
**Expected:** `AI review` → `fail`. Exactly `1` ai-review comment. Its body has `AI-REVIEW: P0=0 P1=1` (P1 ≥ 1) and a
P1 naming `scripts/ai-review-probe.js:3` (XSS via `innerHTML` from a URL parameter). Front CI and tdd-check may be red
on this probe; they do not matter here.
```bash
sed -i 's/\.innerHTML = /.textContent = /' scripts/ai-review-probe.js
git commit -qam 'chore(ci): AI review probe uses textContent' && git push
gh pr checks feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --watch | grep 'AI review'
gh pr view feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --json comments --jq '[.comments[] | select(.body | startswith("<!-- ai-review -->"))] | length, (last.body | split("\n")[2])'
```
**Expected:** the run for the new head (`synchronize`) gives `AI review` → `pass`, still exactly `1` ai-review comment
(updated in place), and its third line `AI-REVIEW: P0=0 P1=0 P2=<n>`.
```bash
git switch -c archon/task-factory-ai-review-probe && git push -u origin archon/task-factory-ai-review-probe
gh pr create -R OlegShevtsov1/1_mvp_pilot_fe --base develop --head archon/task-factory-ai-review-probe --title 'PILOT-0: AI review factory-skip probe' --body-file /tmp/ai-review-probe-body.md
sleep 60; gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow ai-review.yml --branch archon/task-factory-ai-review-probe --json conclusion --jq '.[0].conclusion'
git switch feature/PILOT-0-ai-review-probe
gh pr close archon/task-factory-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch
```
**Expected:** `skipped`; the factory-skip probe PR is closed and its branch deleted.
```bash
git show origin/main:.github/workflows/ai-review.yml >/dev/null 2>&1 && echo on-main || echo not-on-main
gh pr comment feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --body '@claude review'
sleep 90; gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow ai-review.yml --event issue_comment --json conclusion,createdAt --jq '.[0]'
```
**Expected:** if `on-main`, a fresh `issue_comment` run with conclusion `success`, and the ai-review comment is
updated again (still one). If `not-on-main`, there is no new run: GitHub takes comment-triggered workflows from
`main`. Record "comment re-review: deferred until ai-review.yml reaches main with the next release PR". This is not a
STOP.

**A4 🔒 — `off`: green in seconds, no model call; leave it off; record the cost; clean up.**
```bash
gh variable set AI_REVIEW -b off -R OlegShevtsov1/1_mvp_pilot_fe
git switch feature/PILOT-0-ai-review-probe && git commit -q --allow-empty -m 'chore(ci): AI review probe, switch off' && git push
gh pr checks feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --watch | grep 'AI review'
RUN=$(gh run list -R OlegShevtsov1/1_mvp_pilot_fe --workflow ai-review.yml --branch feature/PILOT-0-ai-review-probe --json databaseId --jq '.[0].databaseId')
gh run view "$RUN" -R OlegShevtsov1/1_mvp_pilot_fe --json jobs --jq '.jobs[0] | (.steps[] | "\(.name) \(.conclusion)"), "\(.startedAt) \(.completedAt)"'
gh run view "$RUN" -R OlegShevtsov1/1_mvp_pilot_fe --log | grep -c 'AI review disabled (AI_REVIEW=off)'
gh variable get AI_REVIEW -R OlegShevtsov1/1_mvp_pilot_fe
git switch develop
gh pr close feature/PILOT-0-ai-review-probe -R OlegShevtsov1/1_mvp_pilot_fe --delete-branch
git branch --list feature/PILOT-0-ai-review-probe archon/task-factory-ai-review-probe | wc -l
git ls-remote --heads origin feature/PILOT-0-ai-review-probe archon/task-factory-ai-review-probe | wc -l
```
**Expected:** `AI review` → `pass`. Steps: `AI_REVIEW switch success`. `actions/checkout`, `Review the pull request
(read-only)` and `Post the review and fail on P0 or P1` are all `skipped`. The job lasts well under a minute. The log
count is ≥ `1`. The variable is `off` and **stays off** (decision 32). Probe PR closed; both branch counts are `0` (gh deletes the local branches too). Record the
usage of the A3 reviews (the Claude subscription's usage page, today) in the execution log.

**A5 — bookkeeping.** Move the Trello card C3c (label `run`) to `Done`. Write the execution log C3c with: the A0
sha and run URLs, the A3/A4 run URLs and conclusions, the A3 comment-re-review outcome (run or deferred), the cost
from A4, and `AI_REVIEW=off`. Note: making `ai-review` a required check in branch protection is deferred to PUB. Until
then the factory merge-gate is what refuses non-green checks. **Expected:** card in `Done`; the log entry exists and
every claim has its machine evidence (run URL, command output).
