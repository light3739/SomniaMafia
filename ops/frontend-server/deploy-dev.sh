#!/usr/bin/env bash
# Deploy frontend to TEST server (test.mafiaonchain.live)
# Only rebuilds the frontend service — gm-server is deployed by its own repo CI
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafiatest}"
FRONT_SSH_USER="${FRONT_SSH_USER:-root}"
FRONT_SSH_PORT="${FRONT_SSH_PORT:-22}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/mafia-dev/frontend}"
FRONT_DEPLOY_NICE="${FRONT_DEPLOY_NICE:-10}"

SSH_OPTS=(
  -p "$FRONT_SSH_PORT"
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o PreferredAuthentications=publickey
  -o PasswordAuthentication=no
  -o KbdInteractiveAuthentication=no
  -o NumberOfPasswordPrompts=0
)

SSH_TARGET="${FRONT_SSH_USER}@${FRONT_SSH_HOST}"

echo "[dev:deploy] Syncing frontend to ${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '$FRONT_REMOTE_DIR'"

tar --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".next" \
    -czf - -C "$ROOT_DIR" . \
  | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "tar -xzf - -C '$FRONT_REMOTE_DIR'"

echo "[dev:deploy] Checking env and rebuilding frontend container"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "
  set -euo pipefail
  COMPOSE_DIR='$FRONT_REMOTE_DIR/ops/frontend-server'
  cd \"\$COMPOSE_DIR\"

  if [ ! -f .env.dev ]; then
    echo '[dev:deploy] ERROR: .env.dev not found at \$COMPOSE_DIR/.env.dev'
    echo '[dev:deploy] Create it on the server manually (see .env.production.example as reference)'
    exit 1
  fi

  for key in NEXT_PUBLIC_LIVEKIT_URL NEXT_PUBLIC_GM_SERVER_URL NEXT_PUBLIC_ACTIVE_NETWORK; do
    if ! grep -q \"^\${key}=\" .env.dev; then
      echo \"[dev:deploy] WARNING: \${key} not set in .env.dev\"
    fi
  done

  # Only rebuild frontend; gm-server is managed by its own CI
  COMPOSE_CMD='docker compose --project-name mafia-dev -f docker-compose.dev.yaml up -d --build frontend'
  if command -v ionice >/dev/null 2>&1; then
    COMPOSE_CMD=\"ionice -c 2 -n 7 nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  else
    COMPOSE_CMD=\"nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  fi

  echo '[dev:deploy] Running compose (low-priority)'
  sh -lc \"\$COMPOSE_CMD\"

  echo '[dev:deploy] Current containers:'
  docker compose --project-name mafia-dev -f docker-compose.dev.yaml ps
"

echo "[dev:deploy] Done — https://test.mafiaonchain.live"
