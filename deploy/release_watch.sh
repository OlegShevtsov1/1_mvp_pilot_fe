#!/usr/bin/env bash
# release-watch: after a prod deploy, checks that the app's /health answers and that no
# GlitchTip issue of <PROJECT_NAME>-fe-prod appeared that was not there at the start: once, then again
# after each of ceil(RELEASE_WATCH_SECONDS / RELEASE_WATCH_POLL_SECONDS) sleeps of
# RELEASE_WATCH_POLL_SECONDS (defaults 600 and 30: 21 checks; on prod-srv 180 and 30: 7 checks,
# because the shared VPN lock is held for the whole watch). The count, not the clock, sets the
# length of the watch, so it does not shorten when a check is slow. Stops at the first
# problem: Kamal Manage waits for this job (one prod concurrency group), so an operator's rollback
# is not held up. It never rolls back by itself.
# Usage: deploy/release_watch.sh vX.Y.Z
# Env: as deploy/glitchtip_issues.sh; DESTINATION (prod when unset or empty, or prod-srv, which is
# checked over the VPN and needs PROD_SRV_VPN_IP); GITHUB_OUTPUT (optional) receives text=<result line>.
# Exit 0: ✅ clean. Exit 1: ❌, with the reason in the result line.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ $# -eq 1 ] || die "usage: deploy/release_watch.sh vX.Y.Z"
tag=$1 DESTINATION=${DESTINATION:-prod}
case $DESTINATION in
  prod) default_wait=600 where='' ;;
  prod-srv)
    default_wait=180 where=' on srv'
    require_vars PROD_SRV_VPN_IP
    ;;
  *) die "release-watch watches prod or prod-srv (got '$DESTINATION')" ;;
esac
select_destination "$DESTINATION"
wait=${RELEASE_WATCH_SECONDS:-$default_wait} poll=${RELEASE_WATCH_POLL_SECONDS:-30}
load_project_env
health_url="$(destination_url "$DESTINATION")/health"
project="$PROJECT_NAME-fe-prod"
issues_script="$(dirname "${BASH_SOURCE[0]}")/glitchtip_issues.sh"

finish() {
  echo "$1"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "text=$1" >>"$GITHUB_OUTPUT"
  fi
  case $1 in ✅*) exit 0 ;; *) exit 1 ;; esac
}

baseline=$("$issues_script") || finish "❌ release-watch $tag$where: could not read GlitchTip issues of $project"
checks=0 polls=$(( (wait + poll - 1) / poll ))
while :; do
  app_curl -fsS --max-time 10 -o /dev/null "$health_url" 2>/dev/null || finish "❌ release-watch $tag$where: $health_url failed"
  checks=$((checks + 1))
  issues=$("$issues_script") || finish "❌ release-watch $tag$where: could not read GlitchTip issues of $project"
  new=$(jq -c --argjson baseline "$baseline" \
    '($baseline | map(.id)) as $known | map(select(.id as $id | $known | index($id) | not))' <<<"$issues")
  if [ "$new" != '[]' ]; then
    titles=$(jq -r '.[:3] | map(.title // "untitled" | gsub("[\r\n]+"; " ") | .[:80]) | join("; ")' <<<"$new")
    finish "❌ release-watch $tag$where: new GlitchTip issue(s) in $project: $titles"
  fi
  [ "$checks" -le "$polls" ] || break
  sleep "$poll"
done
finish "✅ release-watch $tag$where: $checks health checks OK, no new GlitchTip issues in $project ($((wait / 60)) min)"
