#!/bin/sh
# Runs from the nginx image entrypoint (/docker-entrypoint.d) before nginx starts:
# writes the runtime config the app reads from /config.js, so one image serves every
# environment. Values are restricted to URL-safe characters because they are placed
# inside JS string literals; a bad value stops the container instead of serving it.
# Browsers get the server's SENTRY_DSN moved onto the API_URL origin, since the SDK
# sends through the backend tunnel; a private address is never served.
set -eu

out=${CONFIG_JS_PATH:-/usr/share/nginx/html/config.js}

fail() {
  echo "config.js: $1" >&2
  exit 1
}

for name in API_URL ENV_NAME; do
  eval "value=\${$name:-}"
  [ -n "$value" ] || fail "$name is required"
done

SENTRY_DSN=${SENTRY_DSN:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
OAUTH_CLIENT_ID=${OAUTH_CLIENT_ID:-}
SUPPORT_EMAIL=${SUPPORT_EMAIL:-}
APP_VERSION=${KAMAL_VERSION:-local}

for name in API_URL SENTRY_DSN GOOGLE_CLIENT_ID OAUTH_CLIENT_ID SUPPORT_EMAIL ENV_NAME APP_VERSION; do
  eval "value=\$$name"
  case $value in
    *[!A-Za-z0-9._~:/?#@\&=%+-]*) fail "$name has invalid characters" ;;
  esac
done

browser_dsn=
if [ -n "$SENTRY_DSN" ]; then
  case $SENTRY_DSN in
    *://*@*/?*) ;;
    *) fail "SENTRY_DSN is not a DSN" ;;
  esac
  rest=${SENTRY_DSN#*://}
  key=${rest%%@*}
  key=${key%%:*}
  path=/${rest#*@*/}
  scheme=${API_URL%%://*}
  authority=${API_URL#*://}
  authority=${authority%%/*}
  authority=${authority##*@}
  browser_dsn="$scheme://$key@$authority$path"

  host=${authority%:*}
  host=$(printf '%s' "${host%.}" | tr 'A-Z' 'a-z')
  private=
  case $host in
    localhost|'') private=yes ;;
    *[!0-9.]*) ;;
    10.*|127.*|169.254.*|192.16[8].*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|0.*) private=yes ;;
    100.6[4-9].*|100.[7-9][0-9].*|100.1[01][0-9].*|100.12[0-7].*) private=yes ;;
  esac
  [ -z "$private" ] || fail "SENTRY_DSN would point browsers to a private address"
fi

tmp="$out.tmp"
cat > "$tmp" <<JS
window.APP_CONFIG = {
  API_URL: "$API_URL",
  SENTRY_DSN: "$browser_dsn",
  GOOGLE_CLIENT_ID: "$GOOGLE_CLIENT_ID",
  OAUTH_CLIENT_ID: "$OAUTH_CLIENT_ID",
  SUPPORT_EMAIL: "$SUPPORT_EMAIL",
  ENV_NAME: "$ENV_NAME",
  APP_VERSION: "$APP_VERSION",
};
JS
mv "$tmp" "$out"
