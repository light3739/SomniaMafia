#!/usr/bin/env bash
# Deploy GM server to TEST environment (gm-test.mafiaonchain.live → port 3003)
# Safe: completely isolated from prod (different remote dir, different pm2 process)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="${ROOT_DIR}/ops/gm-server/workdir"

SSH_HOST="${GM_SSH_HOST:-mafia}"
SSH_PORT="${GM_SSH_PORT:-22}"
SSH_USER="${GM_SSH_USER:-root}"
REMOTE_DIR="${GM_REMOTE_DIR:-/root/gm-server-test}"
PM2_NAME="${GM_PM2_NAME:-gm-server-test}"

if [[ ! -f "$WORKDIR/package.json" ]]; then
  echo "[gm-test:deploy] Missing workdir. Run: npm run gm:sync && npm run gm:build"
  exit 1
fi

echo "[gm-test:deploy] Uploading to ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "mkdir -p '$REMOTE_DIR'"
rsync -az --delete -e "ssh -p $SSH_PORT" \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  "$WORKDIR/" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo "[gm-test:deploy] Ensuring .env exists on remote"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "
  set -euo pipefail
  cd '$REMOTE_DIR'
  if [ ! -f .env ]; then
    if [ -f /root/gm-server/.env ]; then
      cp /root/gm-server/.env .env
      echo '[gm-test:deploy] Copied prod .env to test dir — review if needed'
    else
      echo '[gm-test:deploy] ERROR: missing .env on remote — copy from prod or create manually'
      exit 1
    fi
  fi

  GM_PRIVATE_KEY=\"\$(grep -E '^GM_PRIVATE_KEY=' .env | head -n1 | cut -d= -f2- || true)\"
  if [ -z \"\$GM_PRIVATE_KEY\" ] || [ \"\$GM_PRIVATE_KEY\" = '0x0000000000000000000000000000000000000000000000000000000000000001' ]; then
    echo '[gm-test:deploy] ERROR: GM_PRIVATE_KEY is missing or insecure default in .env'
    exit 1
  fi
"

echo "[gm-test:deploy] Installing and restarting pm2 process: $PM2_NAME (port 3003)"
# Collect local git info before SSH
DEPLOY_BRANCH="$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
DEPLOY_SHA="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" "
  export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"
  cd '$REMOTE_DIR'
  # Override port for test instance
  export PORT=3003
  npm ci && npm run build
  pm2 restart '$PM2_NAME' || PORT=3003 pm2 start dist/index.js --name '$PM2_NAME'

  # Telegram deploy notification
  ENV_FILE=/etc/mafia-monitor.env
  if [[ -f \"\$ENV_FILE\" ]]; then . \"\$ENV_FILE\"; fi
  BOT_TOKEN=\"\${TELEGRAM_BOT_TOKEN:-}\"
  CHAT_ID=\"\${TELEGRAM_CHAT_ID:-}\"
  if [[ -n \"\$BOT_TOKEN\" && -n \"\$CHAT_ID\" ]]; then
    curl -sS -X POST \"https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\" \\
      -d \"chat_id=\${CHAT_ID}\" \\
      --data-urlencode \"text=🧪 GM-server TEST deployed%0ABranch: $DEPLOY_BRANCH%0ACommit: $DEPLOY_SHA%0AURL: https://gm-test.mafiaonchain.live/health\" >/dev/null || true
  fi
"

echo "[gm-test:deploy] Done — https://gm-test.mafiaonchain.live"
