#!/usr/bin/env bash
# Dual control for the prod workflows, checked before any job can read the prod secrets.
# Usage: deploy/prod_guard.sh deploy|manage
# Env: REF (github.ref), CONFIRM, and ENVIRONMENT + VERSION + MIRROR + SOURCE_SHA (deploy) or
# ACTION + VERSION (manage). MIRROR=true is the mirror mode (decision 43), which needs SOURCE_SHA,
# the 40-hex primary commit of the tag; the primary refuses one. TARGET (aws when unset or empty, or
# srv) picks the prod host.
# Prints, ready for GITHUB_OUTPUT: deploy: tag=vX.Y.Z (prod deploys only a release tag; the Kamal
# Deploy guard resolves it with deploy/tag_check.sh), plus source_sha=<40 hex> in mirror mode;
# manage: version=sha-<40 hex> and sha=<40 hex>, or version=prod-previous (srv: prod-srv-previous)
# and an empty sha, or both empty for a run without a version. Both end with destination=prod or
# destination=prod-srv, the destination argument of the deploy scripts.
set -euo pipefail

fail() {
  echo "::error::$1" >&2
  exit 1
}

is_sha() {
  [[ ${1#sha-} =~ ^[0-9a-f]{40}$ ]]
}

mode=${1:-}
[ "${REF:-}" = refs/heads/main ] || fail "prod runs only from main (got ${REF:-no ref})"

case ${TARGET:-aws} in
  aws) destination=prod previous=prod-previous ;;
  srv) destination=prod-srv previous=prod-srv-previous ;;
  *) fail "target must be aws or srv (got '$TARGET')" ;;
esac

case $mode in
  deploy)
    [ "${ENVIRONMENT:-}" = prod ] || fail "environment must be 'prod'"
    [ "${CONFIRM:-}" = prod ] || fail "confirm must be exactly 'prod'"
    if is_sha "${VERSION:-}"; then
      fail 'prod deploys only a release tag vX.Y.Z (got a commit sha): tag the commit on main first'
    fi
    [[ ${VERSION:-} =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'version must be a release tag vX.Y.Z'
    if [ "${MIRROR:-}" = true ]; then
      [[ ${SOURCE_SHA:-} =~ ^[0-9a-f]{40}$ ]] ||
        fail 'mirror mode (vars.MIRROR=true) needs source_sha, the 40-hex primary commit of the release tag'
      echo 'Kamal Deploy mode: mirror' >&2
      echo "tag=$VERSION"
      echo "source_sha=$SOURCE_SHA"
      echo "destination=$destination"
    else
      [ -z "${SOURCE_SHA:-}" ] || fail 'source_sha is only for a deploy from the mirror (vars.MIRROR=true)'
      echo 'Kamal Deploy mode: primary' >&2
      echo "tag=$VERSION"
      echo "destination=$destination"
    fi
    ;;
  manage)
    case ${ACTION:-} in
      status | logs) ;;
      restart) [ "${CONFIRM:-}" = prod ] || fail 'restart needs confirm=prod' ;;
      rollback)
        [ "${CONFIRM:-}" = ROLLBACK-prod ] || fail 'rollback needs confirm=ROLLBACK-prod'
        [ -n "${VERSION:-}" ] || fail "rollback needs a version ($previous or the git sha to roll back to)"
        ;;
      remove)
        [ "${CONFIRM:-}" = remove-prod ] || fail 'remove needs confirm=remove-prod'
        [ "$destination" = prod ] || fail 'remove is refused on srv: the srv host is shared with dev and another deployment'
        ;;
      *) fail 'unknown action (supported: status, logs, restart, rollback, remove)' ;;
    esac
    version=${VERSION:-} sha=''
    if is_sha "$version"; then
      sha=${version#sha-} version=sha-${version#sha-}
    elif [ -n "$version" ] && [ "$version" != "$previous" ]; then
      fail "version must be $previous or a 40-hex git sha (optionally sha-<sha>)"
    fi
    echo "version=$version"
    echo "sha=$sha"
    echo "destination=$destination"
    ;;
  *)
    echo 'usage: deploy/prod_guard.sh deploy|manage' >&2
    exit 2
    ;;
esac
