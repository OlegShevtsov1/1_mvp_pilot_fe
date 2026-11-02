#!/usr/bin/env bash
# Switches back to the container of an earlier deploy and waits until the app serves it;
# on prod it then points prod-current at that image (the image it replaces becomes prod-previous,
# so rolling back to prod-previous twice goes forward again); prod-srv does the same with
# prod-srv-current/prod-srv-previous.
# Usage: deploy/rollback.sh dev <40-hex git sha>
#        deploy/rollback.sh prod prod-previous|<40-hex git sha>
#        deploy/rollback.sh prod-srv prod-srv-previous|<40-hex git sha>
# Prod needs the typed confirmation ROLLBACK-prod: ROLLBACK_CONFIRM, or a prompt on a terminal.
# Needs the same environment as deploy/deploy.sh.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ $# -eq 2 ] || die "usage: deploy/rollback.sh dev <git sha> | deploy/rollback.sh prod|prod-srv <prefix>-previous|<git sha>"
dest=$1 target=$2
select_destination "$dest"
previous=''
if is_prod; then
  previous=$LIVE_TAG_PREFIX-previous
fi
[[ $target =~ ^[0-9a-f]{40}$ ]] || { [ -n "$previous" ] && [ "$target" = "$previous" ]; } ||
  die "expected a full 40-hex git sha${previous:+ or $previous}"
load_project_env
require_vars "$HOST_VAR" SENTRY_DSN
ecr_env

if is_prod; then
  crane_login
  sha=$target
  [ "$target" != "$previous" ] || sha=$(resolve_prod_previous)
  release=$(kamal_version "sha-$sha")
  confirm_prod_rollback "$release"
else
  release=$(kamal_version "sha-$target")
fi
"$KAMAL" rollback -d "$dest" "$release"
wait_ready "$(destination_url "$dest")" "$release" "$APP_ENV_NAME"
if is_prod; then
  rotate_prod_tags "$release"
fi
