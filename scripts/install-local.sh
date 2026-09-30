#!/usr/bin/env bash
set -euo pipefail
export PATH="${HOME}/.local/bin:/usr/local/bin:${PATH}"
PLUGIN="${DSH_DEV_PLUGIN:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$PLUGIN"
# ensure LF deps path works under WSL
if [[ ! -d node_modules/https-proxy-agent ]]; then
  npm install
fi
dsh plugin --profile web add "$PLUGIN" || true
dsh plugin --profile web list 2>/dev/null | grep -i jev || echo "WARN: jev not in list yet"
