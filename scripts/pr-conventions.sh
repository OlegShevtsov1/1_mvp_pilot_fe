#!/usr/bin/env bash
# Enforces the pull request conventions of the develop branch model (decisions 24-26, 29) on PRs
# into develop and main:
#   1. the head branch is feature/PILOT-<n>-<slug> or hotfix/PILOT-<n>-<slug> (lowercase slug),
#      the factory's archon/task-factory-*, or develop as the head of a release PR into main;
#   2. the title is PILOT-<n>: <card title>;
#   3. the body, which becomes the squash commit body, has exactly one valid Type: line;
#   4. a release PR, titled PILOT-<n>: Release vX.Y.Z, has a "## Changelog" heading followed by the
#      non-empty [X.Y.Z] section of CHANGELOG.md (decision 64); blank lines and trailing spaces
#      do not count, and the heading may carry a suffix such as "(vX.Y.Z)";
#   5. a release PR or release-prep PR is titled with the release's own card, never PILOT-0 (decision 91).
# Not applicable until the develop branch exists: before that the repository is on GitHub Flow.
# The title and body are data: they are only matched, never printed or executed.
# Env: REPO (owner/name), BASE_REF, HEAD_REF, PR_TITLE, PR_BODY; GH_TOKEN for gh;
# CHANGELOG_FILE (default CHANGELOG.md in the current directory, the PR's merge result in CI).
# Exit 0: conventions kept or not applicable. Exit 1: broken. Exit 2: bad input or GitHub API error.
set -uo pipefail
here=$(dirname "${BASH_SOURCE[0]}")
repo=${REPO:-}
base_ref=${BASE_REF:-}
head_ref=${HEAD_REF:-}
title=${PR_TITLE:-}
body=${PR_BODY:-}

[[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo "pr-conventions: invalid REPO '${repo}'" >&2; exit 2; }
[[ "${base_ref}" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo "pr-conventions: invalid BASE_REF '${base_ref}'" >&2; exit 2; }
[[ "${head_ref}" =~ ^[A-Za-z0-9._/-]+$ ]] || { echo "pr-conventions: invalid HEAD_REF '${head_ref}'" >&2; exit 2; }

if ! develop=$(gh api "repos/${repo}/git/matching-refs/heads/develop" \
  --jq '[.[] | select(.ref == "refs/heads/develop")] | length'); then
  echo "pr-conventions: GitHub API error; cannot decide" >&2
  exit 2
fi
if [ "${develop}" = 0 ]; then
  echo "pr-conventions: not applicable (no develop branch yet: GitHub Flow until the decision-24 branch model starts)"
  exit 0
fi

card_branch='^(feature|hotfix)/PILOT-[0-9]+-[a-z0-9-]+$'
factory_branch='^archon/task-factory-[A-Za-z0-9._-]+$'
card_title='^PILOT-[0-9]+: .+$'
release_title='^PILOT-[0-9]+: Release v([0-9]+\.[0-9]+\.[0-9]+)$'
no_card_release='^PILOT-0[0-9]*: Release '
checked='branch, title, Type line'
failed=0

if ! [[ "${head_ref}" =~ ${card_branch} || "${head_ref}" =~ ${factory_branch} ]] \
  && ! [[ "${head_ref}" = develop && "${base_ref}" = main ]]; then
  echo "::error::pr-conventions: branch '${head_ref}' must match feature/PILOT-<n>-<slug> or hotfix/PILOT-<n>-<slug> (lowercase slug), or be archon/task-factory-* (develop only as the head of a release PR into main)"
  failed=1
fi

if ! [[ "${title}" =~ ${card_title} ]]; then
  echo '::error::pr-conventions: PR title must match ^PILOT-[0-9]+: .+$'
  failed=1
fi

body=${body//$'\r'/}
types=$(printf '%s\n' "${body}" | grep -c '^Type:')
if [ "${types}" -ne 1 ]; then
  echo "::error::pr-conventions: the PR body must have exactly one Type: line (found ${types})"
  failed=1
elif ! grep -qxE 'Type: (feat|fix|chore|docs|refactor|test|ci)' <<<"${body}"; then
  echo '::error::pr-conventions: the Type: line must be one of feat, fix, chore, docs, refactor, test, ci'
  failed=1
fi

squeeze() { sed -e 's/[[:space:]]*$//' -e '/^$/d'; }

if [[ "${title}" =~ ${release_title} ]]; then
  version=${BASH_REMATCH[1]}
  checked="${checked}, changelog"
  if ! notes=$(CHANGELOG_FILE=${CHANGELOG_FILE:-CHANGELOG.md} "${here}/release-notes.sh" "v${version}" 2>/dev/null); then
    echo "::error::pr-conventions: a release PR for v${version} needs a non-empty section [${version}] in CHANGELOG.md"
    failed=1
  else
    notes=$(printf '%s\n' "${notes}" | squeeze)
    changelog=$(printf '%s\n' "${body}" | "${here}/markdown-section.sh" '## Changelog' | squeeze)
    if ! [[ "${changelog}" == "${notes}" || "${changelog}" == "${notes}"$'\n'* ]]; then
      echo "::error::pr-conventions: the body of a release PR must have a '## Changelog' heading followed by the [${version}] section of CHANGELOG.md (scripts/release-notes.sh v${version} prints it)"
      failed=1
    fi
  fi
fi

if [[ "${title}" =~ ${no_card_release} ]]; then
  echo "::error::pr-conventions: a release PR is titled PILOT-<n>: Release vX.Y.Z (release-prep: PILOT-<n>: Release X.Y.Z changelog) with the release's own card, never PILOT-0 (decision 91: every release has its own card; PILOT-0 is only for card-less chores)"
  failed=1
fi

[ "${failed}" -eq 0 ] || exit 1
echo "pr-conventions: ok (${checked})"
