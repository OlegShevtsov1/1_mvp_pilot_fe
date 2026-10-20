#!/usr/bin/env bash
# Deploys an image already pushed to ECR and waits until the app serves it.
# Usage: deploy/deploy.sh dev sha-<40-hex git sha>
#        deploy/deploy.sh prod vX.Y.Z
# Prod deploys only a release tag: an annotated tag on GitHub whose commit is on main, and only
# while the backend on prod is at least deploy/min-be-version. These read-only checks need gh
# (GH_REPO defaults to this clone's repository; BE_REPO_TOKEN optionally reads the backend) and run
# before anything needs a prod secret, so a refusal touches nothing.
# From the mirror (MIRROR=true, decision 43) SOURCE_SHA is the primary commit of the tag: the tag is
# checked on the mirror, MIRROR_SOURCE.json must pair it with SOURCE_SHA, and the image deployed is
# sha-<SOURCE_SHA> that the primary's Dev Deploy built. Without MIRROR, SOURCE_SHA is refused.
# dev needs DEV_HOST, prod needs PROD_VPN_IP plus crane and jq; both need SENTRY_DSN and AWS
# credentials (or ECR_REGISTRY + KAMAL_REGISTRY_PASSWORD). Nothing is built: prod promotes the
# dev image sha-<sha> to prod-sha-<sha>, and once that is served points prod-current at it.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ $# -eq 2 ] || die "usage: deploy/deploy.sh dev sha-<git sha> | deploy/deploy.sh prod vX.Y.Z"
dest=$1 version=$2
select_destination "$dest"
if [ "$dest" = prod ]; then
  [[ $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "prod deploys only a release tag vX.Y.Z (got '$version')"
  if [ "${MIRROR:-}" != true ] && [ -n "${SOURCE_SHA:-}" ]; then
    die "source_sha is only for a deploy from the mirror (MIRROR=true)"
  fi
  load_project_env
  GH_REPO=${GH_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}
  export GH_REPO
  resolved=$(deploy/tag_check.sh "$version")
  sha=$(sed -n 's/^sha=//p' <<<"$resolved")
  echo "$version is the annotated tag of $sha"
  VERSION=sha-$sha deploy/main_commit_check.sh
  if [ "${MIRROR:-}" = true ]; then
    sha=$(deploy/mirror_source_check.sh "$version" "${SOURCE_SHA:-}" | sed -n 's/^source_sha=//p')
  fi
  version=sha-$sha
  deploy/be_version_check.sh
else
  require_version "$version"
  load_project_env
fi
require_vars "$HOST_VAR" SENTRY_DSN
ecr_env
release=$(kamal_version "$version")

if [ "$dest" = prod ]; then
  crane_login
  promote_prod_image "$version"
fi
"$KAMAL" deploy -d "$dest" --skip-push --version "$release"
wait_ready "$(destination_url "$dest")" "$release" "$dest"
if [ "$dest" = prod ]; then
  rotate_prod_tags "$release"
fi
