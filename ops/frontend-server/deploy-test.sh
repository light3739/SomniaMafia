#!/usr/bin/env bash
# Deploy frontend to TEST environment (test.mafiaonchain.live → port 3002)
# Safe: completely isolated from prod (different container, port, volume, remote dir)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafia}"
FRONT_SSH_USER="${FRONT_SSH_USER:-root}"
FRONT_SSH_PORT="${FRONT_SSH_PORT:-22}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/somnia-frontend-test}"
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

SSH_USER="$FRONT_SSH_USER"

echo "[test:deploy] Syncing source to ${SSH_USER}@${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${FRONT_SSH_HOST}" "mkdir -p '$FRONT_REMOTE_DIR'"

rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'ops/gm-server/workdir' \
  --exclude 'ops/frontend-server/.env.test' \
  --exclude 'ops/frontend-server/.env.production' \
  "$ROOT_DIR/" "${SSH_USER}@${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}/"

echo "[test:deploy] Ensuring .env.test exists on remote"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${FRONT_SSH_HOST}" "
  cd '$FRONT_REMOTE_DIR/ops/frontend-server'
  if [ ! -f .env.test ]; then
    if [ -f .env.production ]; then
      cp .env.production .env.test
      echo '[test:deploy] Copied .env.production to .env.test — review if needed'
    else
      echo '[test:deploy] WARNING: .env.test missing, create it from .env.production.example'
    fi
  fi
"

echo "[test:deploy] Building and starting somnia-frontend-test (port 3002)"
ssh "${SSH_OPTS[@]}" "${SSH_USER}@${FRONT_SSH_HOST}" "
  cd '$FRONT_REMOTE_DIR/ops/frontend-server'
  nice -n ${FRONT_DEPLOY_NICE} ionice -c ${FRONT_DEPLOY_IONICE_CLASS} -n ${FRONT_DEPLOY_IONICE_LEVEL} \
    docker compose --project-name somnia-test -f docker-compose.test.yaml up -d --build 2>&1
"

echo "[test:deploy] Done — https://test.mafiaonchain.live"
