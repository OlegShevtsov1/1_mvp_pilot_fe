#!/usr/bin/env bash
# Release order backend first: refuses a prod frontend deploy while the backend on prod is older
# than the minimum backend version this release declares in deploy/min-be-version. The backend's
# /health reports only its release sha (a primary commit), which is checked one of two ways:
# - on the primary with BE_REPO_TOKEN: git ancestry in the private BE_REPO, the backend on prod must
#   contain the commit of that backend tag;
# - on the mirror (MIRROR=true) or without BE_REPO_TOKEN: no token, the public backend mirror's
#   MIRROR_SOURCE.json maps the release sha to its release tag, which must be at least the minimum.
#   raw.githubusercontent.com can serve that file a few minutes stale right after a backend
#   publish; the check then refuses and a retry later passes.
# Env: MIN_BE_VERSION_FILE (default deploy/min-be-version), BE_REPO (default OlegShevtsov1/1_mvp_pilot_be),
# BE_MIRROR_REPO (default OlegShevtsov1/1_mvp_pilot_be), BE_REPO_TOKEN (gh token for BE_REPO, used
# only for that read), MIRROR.
# Exit 0: the backend on prod is new enough. Exit 1: refused; nothing was deployed.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

min_file=${MIN_BE_VERSION_FILE:-deploy/min-be-version}
be_repo=${BE_REPO:-OlegShevtsov1/1_mvp_pilot_be}
be_mirror_repo=${BE_MIRROR_REPO:-OlegShevtsov1/1_mvp_pilot_be}
minimum=$(tr -d '[:space:]' <"$min_file" 2>/dev/null) || true
[[ $minimum =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "$min_file must hold one backend release tag vX.Y.Z"

load_project_env
health_url="https://$PROJECT_ZONE/health"
health=$(curl -fsS --max-time 10 "$health_url" 2>/dev/null) ||
  die "$health_url does not answer, so the backend version on prod is unknown. Nothing was deployed."
release=$(jq -r '.release // empty' <<<"$health" 2>/dev/null) || true
[[ $release =~ ^[0-9a-f]{40}$ ]] || die "backend /health reports no release sha. Nothing was deployed."

retry="Release order is backend first: deploy backend $minimum or later to prod, then retry. Nothing was deployed."

if [ "${MIRROR:-}" != true ] && [ -n "${BE_REPO_TOKEN:-}" ]; then
  status=$(GH_TOKEN=$BE_REPO_TOKEN gh api "repos/$be_repo/compare/$minimum...$release" --jq .status 2>/dev/null) || true
  case $status in
    ahead | identical) echo "backend on prod ${release:0:7} contains $minimum (minimum for this release)" ;;
    *) die "backend on prod (${release:0:7}) is older than $minimum, the minimum this frontend release needs ($min_file; compare status: ${status:-unknown}). $retry" ;;
  esac
  exit 0
fi

source_url="https://raw.githubusercontent.com/$be_mirror_repo/main/MIRROR_SOURCE.json"
mirror_source=$(curl -fsS --max-time 10 "$source_url" 2>/dev/null) ||
  die "$source_url does not answer, so the backend version on prod is unknown. Nothing was deployed."
entries=$(mirror_source_tags <<<"$mirror_source") ||
  die "$source_url is not a MIRROR_SOURCE.json with a tags list, so the backend version on prod is unknown. Nothing was deployed."
found=$(awk -F '\t' -v sha="$release" '$2 == sha { print $1 }' <<<"$entries" | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1) || true
[ -n "$found" ] ||
  die "backend on prod (${release:0:7}) is not a release tag listed in $be_mirror_repo MIRROR_SOURCE.json, so its version is unknown. $retry"
if [ "$(printf '%s\n' "$minimum" "$found" | sort -V | head -1)" != "$minimum" ]; then
  die "backend on prod (${release:0:7}, $found) is older than $minimum, the minimum this frontend release needs ($min_file). $retry"
fi
echo "backend on prod ${release:0:7} is $found ($be_mirror_repo), at least $minimum (minimum for this release)"
