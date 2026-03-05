#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafia}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/somnia-frontend}"

echo "[front:deploy] sync repo to ${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}"
ssh "$FRONT_SSH_HOST" "mkdir -p '$FRONT_REMOTE_DIR'"

tar --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".next" \
    --exclude="ops/gm-server/source/node_modules" \
    --exclude="ops/gm-server/workdir/node_modules" \
    -czf - -C "$ROOT_DIR" . \
  | ssh "$FRONT_SSH_HOST" "tar -xzf - -C '$FRONT_REMOTE_DIR'"

echo "[front:deploy] prepare env + compose up"
ssh "$FRONT_SSH_HOST" "
  set -euo pipefail
  cd '$FRONT_REMOTE_DIR/ops/frontend-server'
  if [ ! -f .env.production ]; then
    cp .env.production.example .env.production
    echo '[front:deploy] created .env.production from example (edit if needed)'
  fi

  docker compose -f docker-compose.yaml up -d --build
  docker compose -f docker-compose.yaml ps
"

echo "[front:deploy] done"