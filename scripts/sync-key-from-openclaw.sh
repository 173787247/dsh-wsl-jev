#!/usr/bin/env bash
set -euo pipefail
SRC=/mnt/c/Users/rchua/.openclaw/.env
DST="${HOME}/.dsh/dsh-wsl-jev.env"
mkdir -p "${HOME}/.dsh"
line=$(grep -E '^OPENROUTER_API_KEY=' "$SRC" | tr -d '\r' | head -1)
val="${line#OPENROUTER_API_KEY=}"
if [[ ${#val} -lt 20 ]]; then
  echo "REFUSE: key too short" >&2
  exit 1
fi
{
  echo "# synced from ~/.openclaw/.env ($(date -Iseconds))"
  echo "OPENROUTER_API_KEY=${val}"
  echo "DSH_JEV_MODEL=jev-latest"
  echo "DSH_JEV_PROVIDER=openrouter"
} > "$DST"
chmod 600 "$DST"
echo "OK wrote $DST"
echo "OPENROUTER_API_KEY=<set len=${#val}>"
grep -E '^(DSH_JEV_|OPENROUTER_)' "$DST" | sed -E 's/(OPENROUTER_API_KEY)=.*/\1=<set>/'
