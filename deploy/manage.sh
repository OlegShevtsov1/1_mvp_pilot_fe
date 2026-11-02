#!/usr/bin/env bash
# Operates a prod deployment: deploy/manage.sh status|logs|restart|remove [prod|prod-srv]
# prod (the default) is the AWS host, prod-srv the on-prem srv host. Needs the same environment as
# deploy/deploy.sh. Rollback is deploy/rollback.sh.
# kamal-proxy on the prod host also routes the backend, so nothing here touches the proxy:
# remove deletes only this app's containers, images and route. remove is refused on prod-srv.
# dev is never managed with this script: its host and kamal-proxy are shared with other projects.
# shellcheck source=deploy/lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

action=${1:-} dest=${2:-prod}
case $action in
  status | logs | restart | remove) ;;
  *)
    echo "ERROR: unknown action '$action' (supported: status, logs, restart, remove)" >&2
    exit 2
    ;;
esac
case $dest in
  prod) ;;
  prod-srv)
    [ "$action" != remove ] ||
      die "remove is refused on prod-srv: the srv host is shared with dev and another deployment; nothing was removed"
    ;;
  *)
    echo "ERROR: unknown destination '$dest' (supported: prod, prod-srv)" >&2
    exit 2
    ;;
esac

select_destination "$dest"
load_project_env
require_vars "$HOST_VAR" SENTRY_DSN
ecr_env

case $action in
  status)
    "$KAMAL" details -d "$dest"
    "$KAMAL" app version -d "$dest"
    ;;
  logs) "$KAMAL" app logs -d "$dest" --lines 200 ;;
  restart)
    # Without --version Kamal boots the newest image on the host, which after a rollback is not the live one.
    running=$("$KAMAL" app version -d "$dest" -q | tr -d '[:space:]')
    [[ $running =~ ^prod-sha-[0-9a-f]{40}$ ]] || die "could not read the running prod version"
    "$KAMAL" app boot -d "$dest" --version "$running"
    wait_ready "$(destination_url "$dest")" "$running" "$APP_ENV_NAME"
    ;;
  remove) "$KAMAL" app remove -d "$dest" ;;
esac
