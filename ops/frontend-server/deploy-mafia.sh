#!/usr/bin/env bash
# Deploy frontend to PROD server (mafiaonchain.live)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafia}"
FRONT_SSH_USER="${FRONT_SSH_USER:-root}"
FRONT_SSH_PORT="${FRONT_SSH_PORT:-22}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/somnia-frontend}"
FRONT_DEPLOY_NICE="${FRONT_DEPLOY_NICE:-10}"
FRONT_DEPLOY_IONICE_CLASS="${FRONT_DEPLOY_IONICE_CLASS:-2}"
FRONT_DEPLOY_IONICE_LEVEL="${FRONT_DEPLOY_IONICE_LEVEL:-7}"

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

echo "[front:deploy] Syncing repo to ${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '$FRONT_REMOTE_DIR'"

tar --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".next" \
    -czf - -C "$ROOT_DIR" . \
  | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "tar -xzf - -C '$FRONT_REMOTE_DIR'"

echo "[front:deploy] Validating env and running compose"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "
  set -euo pipefail
  COMPOSE_DIR='$FRONT_REMOTE_DIR/ops/frontend-server'
  cd \"\$COMPOSE_DIR\"

  if [ ! -f .env.production ]; then
    if [ -f .env.production.example ]; then
      cp .env.production.example .env.production
      echo '[front:deploy] Created .env.production from example — fill in real values before next deploy'
    else
      echo '[front:deploy] ERROR: .env.production not found and no example to copy from'
      exit 1
    fi
  fi

  for key in LIVEKIT_API_KEY LIVEKIT_API_SECRET NEXT_PUBLIC_LIVEKIT_URL NEXT_PUBLIC_GM_SERVER_URL NEXT_PUBLIC_ACTIVE_NETWORK; do
    if ! grep -q \"^\${key}=\" .env.production; then
      echo \"[front:deploy] WARNING: \${key} not set in .env.production\"
    fi
  done

  COMPOSE_CMD='docker compose --project-name somnia-prod --env-file .env.production -f docker-compose.yaml up -d --build frontend'
  if command -v ionice >/dev/null 2>&1; then
    COMPOSE_CMD=\"ionice -c ${FRONT_DEPLOY_IONICE_CLASS} -n ${FRONT_DEPLOY_IONICE_LEVEL} nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  else
    COMPOSE_CMD=\"nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  fi

  echo '[front:deploy] Running compose (low-priority to reduce server pressure)'
  sh -lc \"\$COMPOSE_CMD\"

  echo '[front:deploy] Current containers:'
  docker compose --project-name somnia-prod --env-file .env.production -f docker-compose.yaml ps
"

echo "[front:deploy] Done — https://mafiaonchain.live"
