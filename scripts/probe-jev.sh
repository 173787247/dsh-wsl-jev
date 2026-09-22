#!/usr/bin/env bash
# Probe System One with one noul question. Needs OPENROUTER_API_KEY or TYPESAFE_API_KEY.
set -euo pipefail

if [[ -f "${HOME}/.dsh/dsh-wsl-jev.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source <(tr -d '\r' < "${HOME}/.dsh/dsh-wsl-jev.env")
  set +a
fi

MODEL="${DSH_JEV_MODEL:-jev-latest}"
BODY='{"model":"'"${MODEL}"'","state":"I was charged twice for my subscription.","questions":{"refund":{"type":"noul","instructions":"Is the customer asking for money back?","criteria":{"true":"Yes","false":"No"}}}}'

proxy_args=()
if [[ -n "${HTTPS_PROXY:-${https_proxy:-}}" ]]; then
  proxy_args=(-x "${HTTPS_PROXY:-$https_proxy}")
fi

if [[ -n "${OPENROUTER_API_KEY:-}" ]]; then
  URL="https://openrouter.ai/api/v1/systemone"
  KEY="${OPENROUTER_API_KEY}"
  echo "provider=openrouter"
elif [[ -n "${TYPESAFE_API_KEY:-${TYPESAFE_KEY:-}}" ]]; then
  URL="https://api.typesafe.ai/v1/systemone"
  KEY="${TYPESAFE_API_KEY:-$TYPESAFE_KEY}"
  echo "provider=typesafe"
else
  echo "No OPENROUTER_API_KEY or TYPESAFE_API_KEY" >&2
  exit 1
fi

curl -sS "${proxy_args[@]}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -H "HTTP-Referer: https://github.com/173787247/dsh-wsl-jev" \
  -H "X-OpenRouter-Title: dsh-wsl-jev" \
  -d "${BODY}" \
  "${URL}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("model=",d.get("model")); print("answers=",d.get("answers")); print("usage=",d.get("usage")); print("error=",d.get("error"))'
