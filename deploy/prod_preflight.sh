#!/usr/bin/env bash
# First step with the "prod" environment's secrets in Kamal Deploy and Kamal Manage: fails fast,
# naming (never printing) whatever is missing.
# Usage: deploy/prod_preflight.sh [EXTRA_REQUIRED_VAR...]
# DESTINATION (prod when unset or empty, or prod-srv) picks the host pair that is required.
set -euo pipefail

case ${DESTINATION:-prod} in
  prod) host=(PROD_SSH_KEY PROD_VPN_IP) ;;
  prod-srv) host=(PROD_SRV_SSH_KEY PROD_SRV_VPN_IP) ;;
  *)
    echo "::error::Kamal prod guard: unknown destination '$DESTINATION' (expected: prod or prod-srv)"
    exit 1
    ;;
esac
required=(AWS_ROLE_ARN VPN_CI_OVPN "${host[@]}" SENTRY_DSN "$@")
missing=()
for name in "${required[@]}"; do
  [ -n "${!name:-}" ] || missing+=("$name")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "::error::Kamal prod guard: missing ${missing[*]}. Repo secrets: AWS_ROLE_ARN, VPN_CI_OVPN, INFRA_READ_TOKEN. Environment \"prod\" secrets: PROD_SSH_KEY, PROD_VPN_IP (target=aws), PROD_SRV_SSH_KEY, PROD_SRV_VPN_IP (target=srv), SENTRY_DSN, TELEGRAM_*_PROD_ALERTS_*; Kamal Deploy also GLITCHTIP_API_URL, GLITCHTIP_API_TOKEN (BE_REPO_READ_TOKEN is optional, primary only)."
  exit 1
fi
echo "all required secrets are set: ${required[*]}"
