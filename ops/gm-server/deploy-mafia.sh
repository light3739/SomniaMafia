#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="${ROOT_DIR}/ops/gm-server/workdir"

SSH_HOST="${GM_SSH_HOST:-mafia}"
SSH_PORT="${GM_SSH_PORT:-22}"
SSH_USER="${GM_SSH_USER:-root}"
REMOTE_DIR="${GM_REMOTE_DIR:-/root/gm-server}"
PM2_NAME="${GM_PM2_NAME:-gm-server}"

if [[ ! -f "$WORKDIR/package.json" ]]; then
  echo "[deploy] Missing workdir. Run: npm run gm:sync && npm run gm:build"
  exit 1
fi

if [[ ! -f "$WORKDIR/.env" ]]; then
  echo "[deploy] Warning: $WORKDIR/.env not found. Remote .env will be kept as-is."
fi

echo "[deploy] Uploading to ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete -e "ssh -p $SSH_PORT" \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$WORKDIR/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "[deploy] Installing and restarting pm2"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "cd '$REMOTE_DIR' && npm ci && npm run build && pm2 restart '$PM2_NAME' || pm2 start dist/index.js --name '$PM2_NAME'"

echo "[deploy] Done"
