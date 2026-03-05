#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

MONITOR_SSH_HOST="${MONITOR_SSH_HOST:-mafia}"
REMOTE_DIR="${MONITOR_REMOTE_DIR:-/root/mafia-monitoring}"

echo "[monitor:deploy] sync to ${MONITOR_SSH_HOST}:${REMOTE_DIR}"
ssh "$MONITOR_SSH_HOST" "mkdir -p '$REMOTE_DIR'"
scp ops/monitoring/mafia-monitor.sh ops/monitoring/install-mafia-monitor.sh "$MONITOR_SSH_HOST:$REMOTE_DIR/"

echo "[monitor:deploy] install service + timer"
ssh "$MONITOR_SSH_HOST" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  chmod +x mafia-monitor.sh install-mafia-monitor.sh
  ./install-mafia-monitor.sh
"

echo "[monitor:deploy] done"