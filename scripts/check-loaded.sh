#!/usr/bin/env bash
set -euo pipefail
sleep 3
echo "=== dsh-wsl-jev log ==="
grep -E 'dsh-wsl-jev' /tmp/dsh-web.log | tail -20 || echo "(no lines)"
echo "=== plugin list ==="
export PATH="${HOME}/.local/bin:$PATH"
dsh plugin --profile web list 2>/dev/null | grep -i jev || true
