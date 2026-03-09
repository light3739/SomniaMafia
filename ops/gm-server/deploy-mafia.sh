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

echo "[deploy] Validating remote env"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  if [ ! -f .env ]; then
    echo '[deploy] ERROR: missing .env on remote gm-server'
    echo '[deploy] Copy .env.example to .env and set GM_PRIVATE_KEY'
    exit 1
  fi

  GM_PRIVATE_KEY=\"\$(grep -E '^GM_PRIVATE_KEY=' .env | head -n1 | cut -d= -f2- || true)\"
  if [ -z \"\$GM_PRIVATE_KEY\" ] || [ \"\$GM_PRIVATE_KEY\" = '0x0000000000000000000000000000000000000000000000000000000000000001' ]; then
    echo '[deploy] ERROR: GM_PRIVATE_KEY is missing or insecure default in remote .env'
    exit 1
  fi

  for key in AVAX_RPC_URL SOMNIA_RPC_URL AVAX_DIAMOND SOMNIA_DIAMOND; do
    if ! grep -q \"^\${key}=\" .env; then
      echo \"[deploy] WARNING: \${key} not set, built-in default will be used\"
    fi
  done
"

echo "[deploy] Installing and restarting pm2"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
  cd '$REMOTE_DIR'
  npm ci
  npm run build
  pm2 restart '$PM2_NAME' || pm2 start dist/index.js --name '$PM2_NAME'
"

echo "[deploy] Done"
