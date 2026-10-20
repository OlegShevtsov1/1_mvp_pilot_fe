# Pilot Frontend

React 18 + Vite 6 + TypeScript single-page app for the Pilot project: the browser client of the
[1_mvp_pilot_be](https://github.com/OlegShevtsov1/1_mvp_pilot_be) REST API (projects and tasks). One Docker image
(nginx serving the built bundle) runs in every environment; the backend URL, the error-reporting DSN and the
environment name are read when the container starts, never baked into the bundle. The delivery process that
built and deploys it (Claude Code plugins and the Archon factory) is in
[1_mvp_sdlc](https://github.com/OlegShevtsov1/1_mvp_sdlc).

## Live

- **Production app:** <https://app.pilot.up.km.ua>
- **Dev app:** <https://app.dev.pilot.up.km.ua>
- **Backend API (prod):** <https://pilot.up.km.ua/health> · Swagger <https://pilot.up.km.ua/api-docs/index.html>

## Architecture

The SPA talks only to the backend API (`API_URL` from `/config.js`); browser errors are sent through the
backend's `/api/errors` tunnel to GlitchTip, so no third-party host is contacted from the page. The C4 container
diagram, module inventory, conventions and known technical debt are in
[docs/architecture-map.md](docs/architecture-map.md); the domain glossary is [CONTEXT.md](CONTEXT.md).

## Deployment

One image per commit, built once by CI and promoted to production unchanged. Kamal 2 runs it as `pilot-fe-dev`
on the dev host (every merge into `develop` deploys automatically after Front CI, see [Deploy (dev)](#deploy-dev))
and as `pilot-fe` on the prod host, deployed only from an annotated release tag `vX.Y.Z` on `main` after the
matching backend release is live (see [Deploy (prod)](#deploy-prod) and
[Releases and hotfixes](#releases-and-hotfixes)). Each deploy waits for `/health` and the expected `/config.js`;
production is watched for ten minutes afterwards and can be rolled back from the console or GitHub Actions.

## Requirements

- Node.js 24 (the version in `.nvmrc`; `nvm use` picks it up)
- npm (bundled with Node.js)
- Ruby (any recent version; `npm test` renders the Kamal config with it)
- For deploys from a console: Docker, Ruby with `gem install kamal -v 2.12.0`,
  the AWS CLI, and access to the shared CI VPN; for prod also
  [crane](https://github.com/google/go-containerregistry/tree/main/cmd/crane)
  and `jq`

## Development

```bash
npm ci
npm run dev        # dev server on http://localhost:3000
```

Without a runtime config the page shows `API status: not configured` and error
reporting stays off. To talk to a backend locally, create the gitignored
`public/config.js`:

```js
window.APP_CONFIG = {
  API_URL: "http://localhost:3001",
  SENTRY_DSN: "",
  ENV_NAME: "local",
  APP_VERSION: "local",
};
```

## Checks

The same checks run in CI, in this order:

```bash
bash scripts/check-public-repo.sh   # no internal hosts, IPs, IDs or local paths in tracked files
npm run lint                        # ESLint
npm run typecheck                   # tsc -b
npm test                            # Vitest: src/**/*.test.{ts,tsx} and tests/**/*.test.ts
npm audit --audit-level=high        # fails on high or critical advisories
npm run build                       # production bundle in dist/
bash scripts/check-bundle-config.sh src dist   # no hosts or DSN values in src/ or dist/
bash scripts/check-asset-hashes.sh dist        # every JS/CSS bundle name carries a content hash
```

`tests/` covers the container's config script, the deploy scripts for dev and
prod (with fake `kamal`, `aws`, `curl`, `gh` and a fake `crane` registry), the
prod guards, the structure of the Dev Deploy, Kamal Deploy and Kamal Manage
workflows, and that the image, service and host Kamal resolves from
`config/deploy*.yml` match what the scripts build, label and wait on. It also
covers the SDLC scripts (`tdd-check`, `main-guard`, the bundle check,
`bin/wait-dev-deploy`, `bin/dev-rollback`) and the SDLC setup files, and the
release tooling: versions, CHANGELOG sections and checks on git fixtures, the
release and changelog-check workflows, the tag pre-push hook, release-watch,
the backend release-order check, `bin/sdlc-metrics`, the nginx cache
headers, and the AI review workflow and its report script.

CI also scans the full git history for secrets with
[gitleaks](https://github.com/gitleaks/gitleaks) and lints the workflows with
[actionlint](https://github.com/rhysd/actionlint). To run them locally, install
both tools and run `gitleaks git --redact .` and `actionlint`.

## CI

[`.github/workflows/front-ci.yml`](.github/workflows/front-ci.yml) ("Front CI")
runs on every pull request and on every push to `main`, `develop` and `hotfix/*`.
A single job checks out
the full history, runs gitleaks, the public-repo check and actionlint, then
`npm ci`, lint, typecheck, unit tests, `npm audit --audit-level=high` and the
build, then `scripts/check-bundle-config.sh`, which fails when `src/` or the
built `dist/` contains a host of the project zone, an error-tracker host or a
DSN value. Every step is blocking. A new push to a pull request cancels the run
still in progress for it; runs on `main` are never cancelled.

[`.github/workflows/tdd-check.yml`](.github/workflows/tdd-check.yml) checks
the TDD commit order of every pull request that changes code.
[`.github/workflows/main-guard.yml`](.github/workflows/main-guard.yml) checks
that every commit on `main` came from a merged pull request, and its twin
[`.github/workflows/develop-guard.yml`](.github/workflows/develop-guard.yml)
does the same for `develop`.
[`.github/workflows/pr-conventions-check.yml`](.github/workflows/pr-conventions-check.yml)
checks the branch name, title and `Type:` line of pull requests into `develop`
and `main`. All are described under "Development process (SDLC)".
[`.github/workflows/ai-review.yml`](.github/workflows/ai-review.yml) is the
switchable AI review of pull requests, described under "AI PR review".

The repository is meant to be public, so `scripts/check-public-repo.sh` rejects
internal IP addresses, internal hostnames, cloud account and DNS zone IDs, and
task-tracker or chat IDs. Keep such values in secrets or private configuration,
never in committed files.

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) opens grouped
weekly updates for npm (minor and patch) and GitHub Actions.

## AI PR review

[`.github/workflows/ai-review.yml`](.github/workflows/ai-review.yml) reviews
pull requests with Claude (decision 32). The repository variable `AI_REVIEW`
switches it: only the exact value `on` enables it. Unset or any other value is
off: the `AI review` check is green in seconds with
`AI review disabled (AI_REVIEW=off)`, and no model is called. Switch it with
`gh variable set AI_REVIEW -b on` or `-b off`; decision 32 keeps it `off` by
default.

It runs when a pull request is opened, reopened, marked ready for review,
pushed to (`synchronize`, also the push after "changes requested") or gets a
review request. It skips `archon/task-factory-*` heads (the factory reviews its
own pull requests, decision R-C5), Dependabot, drafts and the release pull request
`develop → main`.

The review uses Sonnet (decision R-C12), at most 20 turns and read-only tools: the
model cannot write files or post to GitHub. It returns its findings as
structured output, and `scripts/ai-review-report.sh` posts them as one
`AI review` comment (updated in place on later runs) whose third line is
`AI-REVIEW: P0=… P1=… P2=…`, and writes `ai-review/result.json`. Red means at
least one P0 or P1, or no summary at all (the review failed, hit its turn limit
or the secret is missing): review is required before merge. Fix the code and
push; the new run updates the same comment. P2 findings alone stay green. The
factory does not merge while the check is red; making it a required check in
branch protection is deferred to PUB.

A comment containing `@claude review` by an owner, member or collaborator on
an open pull request asks for a re-review. GitHub runs comment-triggered
workflows from `main`, so this works once `ai-review.yml` has reached `main`
with a release. It refreshes the comment but is not a check on the pull
request head; to change the check, push or use "Re-run jobs" on the pull
request's run. Comment re-reviews do not apply the factory, draft and release
skips.

Secrets (names only): `ANTHROPIC_API_KEY`, passed as the action input
`anthropic_api_key`. A Claude subscription token `CLAUDE_CODE_OAUTH_TOKEN` is
the alternative: replace that input in `ai-review.yml` with
`claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`.

Cost: with `on`, every push, reopen or review request on a pull request that is
not skipped is one billed review; a new push cancels the run still in progress.
The cost shows in the Anthropic console for the key. Leave it `off` unless
needed.

## Development process (SDLC)

Work follows the SDLC process in
[`OlegShevtsov1/1_mvp_sdlc`](https://github.com/OlegShevtsov1/1_mvp_sdlc) (`docs/sdlc/`).
Here it is set up by:

- [`CLAUDE.md`](CLAUDE.md) and `.claude/` (settings and rules). The
  per-developer `.claude/sdlc.local.md` is not committed:
  `/mvp-sdlc:bootstrap-project fe` creates it, then set
  `cmd_vet: "npm run typecheck"`;
- [`docs/architecture-map.md`](docs/architecture-map.md), the current
  architecture, and [`CONTEXT.md`](CONTEXT.md), the glossary;
- the pull request template
  [`.github/pull_request_template.md`](.github/pull_request_template.md);
- [`docs/sdlc-bootstrap-checks.md`](docs/sdlc-bootstrap-checks.md), the operator checks
  run after the bootstrap was merged;
- [`docs/git-branching-checks.md`](docs/git-branching-checks.md), the operator checks
  run after the `develop` branch model was merged.
- [`docs/ai-review-checks.md`](docs/ai-review-checks.md), the operator checks
  run after the AI review was merged.

Work branches off `develop`: `feature/PILOT-<n>-<slug>` or, for a fix of
production, `hotfix/PILOT-<n>-<slug>`, where `<n>` is the Trello card number
and `<slug>` comes from the card title. The Archon factory's
`archon/task-factory-*` branches are accepted too. Features reach `develop` by
squash pull request, which the factory merges once CI and review are green.
Hotfixes go to `main`, then back to `develop`. The operator merges the release
pull request `develop → main` and hotfix pull requests into `main` by hand.
`pr-conventions-check` ([`scripts/pr-conventions.sh`](scripts/pr-conventions.sh))
requires, on every pull request into `develop` or `main`, such a branch name
(or `develop` as the head of a release pull request into `main`), the title
`PILOT-<n>: <card title>`, and exactly one line
`Type: feat|fix|chore|docs|refactor|test|ci` in the body, which becomes the
squash commit body. The check reports "not applicable" until the `develop`
branch exists.

`tdd-check` ([`scripts/tdd-check.sh`](scripts/tdd-check.sh)) applies to a
pull request that changes non-test files under `src/`, `bin/`, `deploy/`,
`scripts/` or `docker/` (Markdown files do not count as code). Its first commit must be `test(...)`, and `npm test`
must fail at that commit: the check reproduces this and records it there as
the failing commit status `tdd-check/red`. A later `feat(...)` or `fix(...)`
commit must follow. Tests (`tests/` and `*.test.*` files under those code
directories) must not change between the two. It does not apply to the
release PR `develop` → `main`, and commits already on `main` (a back-merge
after a hotfix) are not checked again.

`main-guard` ([`scripts/main-guard.sh`](scripts/main-guard.sh)) runs on every
push to `main`, and its twin `develop-guard` on every push to `develop`. A
commit that did not come from a merged pull request, or one it cannot check,
fails the run and alerts the dev alerts Telegram topic. Check an older commit
with `gh workflow run main-guard.yml --ref main -f sha=<full git sha>` or
`gh workflow run develop-guard.yml --ref develop -f sha=<full git sha>`.

The Archon factory ([`.archon/factory-profile.yaml`](.archon/factory-profile.yaml))
deploys with [`bin/wait-dev-deploy`](bin/wait-dev-deploy): it waits up to
20 minutes for the automatic Dev Deploy run of the merge commit (the run
titled `Dev Deploy sha-<sha>`) and fails if none appears, without dispatching
one. Its pull requests target `develop`. It rolls back with
[`bin/dev-rollback`](bin/dev-rollback), which dispatches Dev Deploy with
`rollback_to` set to the commit before the merge and waits for that run.

## Runtime config

When the container starts, [`docker/40-config-js.sh`](docker/40-config-js.sh)
(run by the nginx image's entrypoint) writes `/config.js` from the container
environment:

| Variable | `/config.js` field | Notes |
|----------|--------------------|-------|
| `API_URL` | `API_URL` | Required. Backend base URL, e.g. `https://dev.pilot.up.km.ua` |
| `SENTRY_DSN` | `SENTRY_DSN` | Optional. Empty turns error reporting off |
| `ENV_NAME` | `ENV_NAME` | Required. Sent as the error `environment`, e.g. `dev` |
| `KAMAL_VERSION` | `APP_VERSION` | Set by Kamal to the deployed image tag; `local` otherwise. Sent as the error `release` |

Values may only contain URL characters (`A-Z a-z 0-9 . _ ~ : / ? # @ & = % + -`).
A missing required value or any other character stops the container with
`config.js: <NAME> ...`, so a bad config fails Kamal's health check instead of
being served. nginx serves `/config.js` with `Cache-Control: no-store`, and
`index.html` loads it before the app. To try the image locally:

```bash
docker build -t pilot-front-local .
docker run --rm -p 8080:80 -e API_URL=http://localhost:3001 -e ENV_NAME=local pilot-front-local
curl -s localhost:8080/config.js
```

The page calls `GET <API_URL>/health` and shows the reported status
(`API status: ok`), or `unreachable` when the request fails.

## Error reporting

The Sentry SDK sends every event to the backend tunnel `<API_URL>/api/errors`,
which forwards it to the error tracker, so the browser never contacts the
tracker itself. To check reporting end to end, open the app with
`?error-test=<kind>&marker=<id>`, where `<kind>` is `runtime` (uncaught
error), `rejection` (unhandled promise rejection) or `render` (a component
throws while rendering; the error boundary shows a fallback), and `<id>` is
1–64 letters, digits or dashes. The marker appears in the event message.

## Deploy (dev)

Kamal 2 runs the image as service `pilot-fe-dev` on the shared dev host, behind
the `kamal-proxy` already running there, as `app.dev.pilot.up.km.ua`. TLS is
terminated in front of that proxy, so Kamal does not manage certificates.

- [`config/project.env`](config/project.env): the project name and DNS zone,
  the only place they are written. Everything else derives from them.
- [`config/deploy.yml`](config/deploy.yml): settings shared by every
  destination. [`config/deploy.dev.yml`](config/deploy.dev.yml): the dev
  destination. The host comes from `DEV_HOST`, the registry from
  `ECR_REGISTRY`.
- [`.kamal/secrets-common`](.kamal/secrets-common): references only. Kamal takes
  `KAMAL_REGISTRY_PASSWORD` and `SENTRY_DSN` from the environment. Never commit
  `.kamal/secrets` or `.kamal/secrets.*` (both are gitignored).

### Dev Deploy workflow

[`.github/workflows/dev-deploy.yml`](.github/workflows/dev-deploy.yml) runs:

- after a successful Front CI push run on `develop` or a `hotfix/*` branch,
  but only when the repository variable `DEV_AUTO_DEPLOY` is `true` (otherwise
  the run is skipped). Pushes to `main` (release merges) do not deploy dev;
- on demand: `gh workflow run dev-deploy.yml --ref develop` (or `main`, or a
  `hotfix/*` branch), optionally with `-f rollback_to=<full git sha>`.

The guard steps fail fast, naming what is missing, when:

- the ref is not `main`, `develop` or a `hotfix/*` branch;
- a required secret is missing. Repository secrets: `AWS_ROLE_ARN`,
  `VPN_CI_OVPN`, `SRV_DEPLOY_SSH_KEY`. Environment `dev` secrets: `SENTRY_DSN`,
  `TELEGRAM_PILOT_DEV_ALERTS_BOT_TOKEN`, `TELEGRAM_PILOT_DEV_ALERTS_CHAT_ID`,
  `TELEGRAM_PILOT_DEV_ALERTS_THREAD_ID`;
- the `vpn-up` and `vpn-down` actions from `OlegShevtsov1/1_mvp_infra@env/dev`
  cannot be used (missing, or that repository does not share its actions).

The deploy job then:

1. builds the image once and pushes it to ECR as `pilot-front:sha-<git sha>`,
   with the build cache in `pilot-front-build-cache`. The build is skipped when
   that tag already exists, so a redeploy or rollback reuses the same image;
2. connects the shared CI VPN with `vpn-up`. This takes a lock shared with other
   projects;
3. runs `deploy/deploy.sh` (or `deploy/rollback.sh`);
4. always disconnects with `vpn-down`.

The result goes to the dev alerts Telegram topic.

### Console deploy and rollback

Both scripts deploy an image that is already in ECR, then wait until
`https://app.dev.<zone>/health` answers and `/config.js` shows the expected
`APP_VERSION` and `ENV_NAME`. If that does not happen within
`DEPLOY_WAIT_SECONDS` (default 300), they fail. They print variable names,
never values.

```bash
# On a machine connected to the VPN, with SSH access to the dev host as user "dev":
export DEV_HOST=<the dev host's VPN address>
export AWS_PROFILE=<profile with ECR access>     # the registry and its password come from AWS
read -rs SENTRY_DSN && export SENTRY_DSN          # the dev front-end DSN

deploy/deploy.sh dev sha-<full git sha>          # deploy an image already pushed by Dev Deploy
deploy/rollback.sh dev <full git sha>            # switch back to an earlier dev deploy
```

## Deploy (prod)

Kamal 2 runs the same image as service `pilot-fe` on the prod host, as
`app.pilot.up.km.ua`, behind the `kamal-proxy` the backend already runs there.
That proxy terminates TLS with a Let's Encrypt certificate
([`config/deploy.prod.yml`](config/deploy.prod.yml)). Kamal reaches the host
over SSH only through the mvp VPN, at `PROD_VPN_IP`, the host's VPN address.
It is a secret and is never committed.

### Build once

Prod never builds. Kamal only runs an image labelled with its service, and
Dev Deploy labels `pilot-front:sha-<git sha>` for `pilot-fe-dev`. So
[`deploy/promote.sh`](deploy/promote.sh) uses crane to copy it as
`pilot-front:prod-sha-<git sha>`, changing only the label to
`service=pilot-fe`. It then checks that the layers are identical and that the
configs differ in nothing but that label. An existing `prod-sha-<git sha>` is
reused only if it passes the same check. The label lives in the image config,
so the prod manifest digest differs from the dev one, while every layer
digest is the same. On prod, `/config.js` shows
`APP_VERSION: "prod-sha-<git sha>"`, and errors carry it as their release.

After a deploy or rollback is served, the ECR tag `prod-current` points at
the live image, and the image it replaced becomes `prod-previous`.

### Kamal Deploy and Kamal Manage workflows

Both workflows only run when dispatched from `main`. They share one
concurrency group, so two prod operations never overlap.

- [`.github/workflows/kamal-deploy.yml`](.github/workflows/kamal-deploy.yml)
  ("Kamal Deploy"). Inputs: `environment=prod`, `version` (a release tag
  `vX.Y.Z`; a git sha is refused) and `confirm=prod`:

  ```bash
  gh workflow run "Kamal Deploy" --ref main -f environment=prod -f version=v<X.Y.Z> -f confirm=prod
  ```

- [`.github/workflows/kamal-manage.yml`](.github/workflows/kamal-manage.yml)
  ("Kamal Manage"). Input `action`:
  - `status` and `logs` need no confirmation;
  - `restart` reboots the running version and needs `confirm=prod`;
  - `rollback` needs `version` (`prod-previous` or the git sha of an earlier
    prod deploy) and the typed confirmation `confirm=ROLLBACK-prod`;
  - `remove` needs `confirm=remove-prod` and removes only this app's
    containers, images and route. The prod `kamal-proxy` stays, because the
    backend uses it.

Each run checks, in this order, and stops at the first failure:

1. Guard, without the `prod` environment: the ref is `main`, the inputs and
   confirmation are valid, and (Kamal Deploy) the version is an annotated
   release tag ([`deploy/tag_check.sh`](deploy/tag_check.sh)) whose commit is on
   `main`.
2. Preflight, in the `prod` environment: every required secret is set. Only
   names are printed. Repository secrets: `AWS_ROLE_ARN`, `VPN_CI_OVPN`.
   Environment `prod` secrets: `PROD_SSH_KEY`, `PROD_VPN_IP`, `SENTRY_DSN` (the
   prod frontend DSN), `TELEGRAM_PILOT_PROD_ALERTS_BOT_TOKEN`,
   `TELEGRAM_PILOT_PROD_ALERTS_CHAT_ID`, `TELEGRAM_PILOT_PROD_ALERTS_THREAD_ID`;
   Kamal Deploy also needs `BE_REPO_READ_TOKEN` (fine-grained token, Contents:
   read on the backend repository, for the release-order check),
   `GLITCHTIP_API_URL` (secret because the GlitchTip host is reachable only over
   the VPN) and `GLITCHTIP_API_TOKEN` (read access to the prod frontend
   project), both for release-watch.
3. The `vpn-up` and `vpn-down` actions from `OlegShevtsov1/1_mvp_infra@env/dev`
   can be used.

Kamal Deploy then promotes the image before connecting the VPN, so a missing
or altered image fails without taking the shared VPN lock. Next it connects
the VPN, checks that the prod host answers on SSH, runs
`deploy/deploy.sh prod`, and always disconnects. The result goes to the prod
alerts Telegram topic. After a successful deploy, the job `release-watch`
watches prod for 10 minutes (see [Releases and hotfixes](#releases-and-hotfixes)).

### Console deploy, rollback and manage

All scripts print variable names, never values. Prod waits up to
`DEPLOY_WAIT_SECONDS` (default 600) until `https://app.<zone>/health` answers
and `/config.js` shows the expected `APP_VERSION` and `ENV_NAME: "prod"`.

```bash
# On a machine connected to the VPN, with SSH access to the prod host as user "ubuntu":
export PROD_VPN_IP=<the prod host's VPN address>
export AWS_PROFILE=<profile that can read and push ECR>
read -rs SENTRY_DSN && export SENTRY_DSN          # the prod front-end DSN

deploy/promote.sh sha-<full git sha>             # only promote (deploy.sh prod does it too)
deploy/deploy.sh prod v<X.Y.Z>                   # check tag and backend, promote, deploy, wait, move prod-current
deploy/rollback.sh prod prod-previous            # back to the previous release (type ROLLBACK-prod)
deploy/rollback.sh prod <full git sha>           # back to an earlier prod deploy (type ROLLBACK-prod)
deploy/manage.sh status|logs|restart|remove      # remove: this app only
```

`deploy/deploy.sh prod` reads GitHub with `gh` (logged in, or `GH_TOKEN`); its
tag, `main` and backend checks run before anything needs a prod secret.
`deploy/rollback.sh prod` asks for `ROLLBACK-prod` on a terminal, or takes it
from `ROLLBACK_CONFIRM`.

#### Stopping and starting by hand

Kamal names containers after the version it runs, and our versions are
`sha-<git sha>` on dev and `prod-sha-<git sha>` on prod. After
`kamal app stop`, a `kamal app start` without `--version` looks for a container
named after the bare git sha, which does not exist, so the app stays down. Prefer
`deploy/manage.sh restart`, which boots the running version with
`kamal app boot --version`. When you must start by hand, read the running
version first with `kamal app version -d <dev|prod> -q` and always pass it:

```bash
kamal app start -d prod --version prod-sha-<full git sha>
kamal app start -d dev --version sha-<full git sha>
```

## Releases and hotfixes

Prod runs only released versions: annotated tags `vX.Y.Z` on `main`, each with
a section in [`CHANGELOG.md`](CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/)).

### Versions

The PR body becomes the squash commit body, so its one `Type:` line is the
commit's trailer. [`scripts/next-version.sh`](scripts/next-version.sh) reads it
on every squash commit since the previous tag: a `BREAKING CHANGE:` footer
bumps MAJOR, else any `feat` bumps MINOR, else any `fix` bumps PATCH; only
`chore`/`docs`/`refactor`/`test`/`ci` means nothing to release. A commit with
no or several `Type:` lines stops it with the list of such commits; it never
guesses. The first release is `0.1.0`. Merge commits (release PRs,
back-merges) are skipped.

### CHANGELOG discipline

A `Type: feat` or `Type: fix` PR adds its entry under `## [Unreleased]`
(changelog-check, [`scripts/changelog-check.sh`](scripts/changelog-check.sh)).
Small changes that need no entry carry the label `skip-changelog`. A hotfix PR
into `main` adds its `## [X.Y.Z] - <date>` section directly. Every section
keeps the line `Minimum backend version: vX.Y.Z`, which must equal
[`deploy/min-be-version`](deploy/min-be-version), the one place that declares
it.

### Cutting a release

1. Release prep PR into `develop` (`Type: docs`): rename `## [Unreleased]` to
   `## [X.Y.Z] - <date>` (the number `scripts/next-version.sh origin/develop`
   prints), drop its empty headings, keep the minimum backend line, and add a
   fresh `## [Unreleased]` with the six headings above it.
   `scripts/release-notes.sh vX.Y.Z` prints the section.
2. Release PR `develop → main`, merged by the operator with a merge commit.
3. Tag the merge commit and push the tag:

   ```bash
   git fetch origin && scripts/next-version.sh origin/main
   git tag -a vX.Y.Z -m vX.Y.Z origin/main && git push origin vX.Y.Z
   ```

4. [`.github/workflows/release.yml`](.github/workflows/release.yml) checks the
   tag ([`scripts/release-check.sh`](scripts/release-check.sh): annotated, on
   `main`, the number `next-version.sh` gives, a CHANGELOG section whose
   minimum backend version equals `deploy/min-be-version`), creates a **draft**
   GitHub Release whose text is exactly that section, prints the release metrics
   line ([`bin/sdlc-metrics`](bin/sdlc-metrics)) and reports ✅/❌ to the prod
   alerts topic. No LLM writes anything. The operator reviews the draft and
   publishes it.
5. Deploy the tag to prod with Kamal Deploy (`version=vX.Y.Z`).

Seven days after a release, `bin/sdlc-metrics --escaped vX.Y.Z` prints the
escaped-defects line (new GlitchTip issues of the prod frontend in that week).

### Release order: backend first

A frontend release names the oldest backend it works with in
`deploy/min-be-version`. `deploy/deploy.sh prod` reads the release sha the
prod backend reports on `/health` and asks GitHub whether it contains that
backend tag ([`deploy/be_version_check.sh`](deploy/be_version_check.sh)). If
not, it refuses with an explanation and deploys nothing: deploy that backend
release to prod first.

### release-watch

After every successful Kamal Deploy, the job `release-watch`
([`deploy/release_watch.sh`](deploy/release_watch.sh)) checks every 30 seconds
for 10 minutes that `https://app.<zone>/health` answers and that no new
GlitchTip issue appeared in the prod frontend project (read through the
GlitchTip API over the VPN, so the shared VPN lock is held meanwhile). It
reports ✅, or ❌ naming the new issues, to the prod alerts topic, stopping at
the first problem. It never rolls back: that is the operator's decision.

### Rollback

Both ways move the ECR tags the same way: the image rolled back to becomes
`prod-current`, the one it replaces `prod-previous`, so the same command again
goes forward.

```bash
deploy/rollback.sh prod prod-previous            # console; type ROLLBACK-prod
gh workflow run "Kamal Manage" --ref main -f action=rollback -f version=prod-previous -f confirm=ROLLBACK-prod
```

### Hotfix

A hotfix branch `hotfix/PILOT-<n>-<slug>` from `main` (Dev Deploy runs from it
before the merge) goes by PR into `main` and adds its `## [X.Y.Z]` section
(PATCH). The operator merges it, tags `main` and deploys the tag as above. Then
a back-merge PR `main → develop` is merged with a merge commit (not squash), so
`develop` keeps the fix.

### Published tags are immutable

Do not move or delete a published `v*` tag. In each clone, install the
pre-push hook that refuses it:

```bash
git config core.hooksPath scripts/git-hooks
```

`git push --no-verify` skips the hook. In Claude Code, `.claude/settings.json`
denies the same pushes and `git tag -d`/`-f`.

### Browser cache

Vite names every JS and CSS file after its content hash, and Front CI checks
it ([`scripts/check-asset-hashes.sh`](scripts/check-asset-hashes.sh)). nginx
serves `/assets` as `public, immutable`, `index.html` as `no-cache` (browsers
revalidate it) and `/config.js` as `no-store`. A normal reload after a deploy
therefore loads the new `index.html` and, through it, the new bundle.

## Checking a deployed app

[Playwright](https://playwright.dev) tests in `e2e/` check a deployed app
against its real backend. They are not part of CI.

- `e2e/runtime-config.spec.ts` (needs `E2E_ENV_NAME`, the environment the
  app runs as):
  - `/health` answers and `/config.js` is not cached;
  - `/config.js` names that environment, its API host and an image version;
  - no app or API host is baked into the bundle.
- `e2e/api.spec.ts`:
  - the page shows `API status: ok` from a real cross-origin call;
  - the API allows the app origin;
  - the API does not allow a foreign origin.
- `e2e/error-tunnel.spec.ts`:
  - each error kind is posted to `<API_URL>/api/errors`;
  - no request goes to another host;
  - it prints the marker, so the event can be found in the error tracker.

```bash
npx playwright install chromium
E2E_BASE_URL=https://app.dev.pilot.up.km.ua E2E_ENV_NAME=dev npm run e2e
E2E_BASE_URL=https://app.dev.pilot.up.km.ua E2E_MARKER_PREFIX=check-1 npx playwright test e2e/error-tunnel.spec.ts

# prod smoke
E2E_BASE_URL=https://app.pilot.up.km.ua E2E_ENV_NAME=prod npx playwright test e2e/runtime-config.spec.ts e2e/api.spec.ts
```
