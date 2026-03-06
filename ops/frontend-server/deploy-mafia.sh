#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafia}"
FRONT_SSH_USER="${FRONT_SSH_USER:-root}"
FRONT_SSH_PORT="${FRONT_SSH_PORT:-22}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/somnia-frontend}"
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

pick_ssh_user() {
  local candidates=("$FRONT_SSH_USER" root ubuntu)
  local seen=""
  local user

  for user in "${candidates[@]}"; do
    [[ -z "$user" ]] && continue
    if [[ " $seen " == *" $user "* ]]; then
      continue
    fi
    seen+=" $user"

    if ssh "${SSH_OPTS[@]}" "${user}@${FRONT_SSH_HOST}" "echo ok" >/dev/null 2>&1; then
      echo "$user"
      return 0
    fi
  done

  return 1
}

if ! RESOLVED_SSH_USER="$(pick_ssh_user)"; then
  echo "[front:deploy] unable to authenticate with provided SSH key (tried: ${FRONT_SSH_USER}, root, ubuntu)"
  exit 1
fi

SSH_TARGET="${RESOLVED_SSH_USER}@${FRONT_SSH_HOST}"
echo "[front:deploy] using ssh user: ${RESOLVED_SSH_USER}"

echo "[front:deploy] sync repo to ${FRONT_SSH_HOST}:${FRONT_REMOTE_DIR}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '$FRONT_REMOTE_DIR'"

tar --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".next" \
    --exclude="ops/gm-server/source/node_modules" \
    --exclude="ops/gm-server/workdir/node_modules" \
    -czf - -C "$ROOT_DIR" . \
  | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "tar -xzf - -C '$FRONT_REMOTE_DIR'"

echo "[front:deploy] prepare env + compose up"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "
  set -euo pipefail
  cd '$FRONT_REMOTE_DIR/ops/frontend-server'
  if [ ! -f .env.production ]; then
    cp .env.production.example .env.production
    echo '[front:deploy] created .env.production from example (edit if needed)'
  fi

  LIVEKIT_API_KEY=\"\$(grep -E '^LIVEKIT_API_KEY=' .env.production | head -n1 | cut -d= -f2- || true)\"
  LIVEKIT_API_SECRET=\"\$(grep -E '^LIVEKIT_API_SECRET=' .env.production | head -n1 | cut -d= -f2- || true)\"
  if [ -z \"\$LIVEKIT_API_KEY\" ] || [ -z \"\$LIVEKIT_API_SECRET\" ] || [ \"\$LIVEKIT_API_SECRET\" = 'replace-with-livekit-secret' ]; then
    echo '[front:deploy] ERROR: missing LIVEKIT_API_KEY/LIVEKIT_API_SECRET in .env.production'
    echo '[front:deploy] set values matching livekit.yaml keys before deploy'
    exit 1
  fi

  docker compose -f docker-compose.yaml up -d --build
  docker compose -f docker-compose.yaml ps
"

echo "[front:deploy] done"