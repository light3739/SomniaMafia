#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_SSH_HOST="${FRONT_SSH_HOST:-mafia}"
FRONT_SSH_USER="${FRONT_SSH_USER:-root}"
FRONT_SSH_PORT="${FRONT_SSH_PORT:-22}"
FRONT_REMOTE_DIR="${FRONT_REMOTE_DIR:-/root/somnia-frontend}"
FRONT_PREFLIGHT_URL="${FRONT_PREFLIGHT_URL:-https://mafiaonchain.live/api/health/system}"
FRONT_ALLOW_UNHEALTHY_DEPLOY="${FRONT_ALLOW_UNHEALTHY_DEPLOY:-false}"
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

preflight_or_fail() {
  echo "[front:deploy] preflight check: $FRONT_PREFLIGHT_URL"
  local json
  json="$(curl -fsS --max-time 8 "$FRONT_PREFLIGHT_URL" || true)"

  if [[ -z "$json" ]]; then
    echo "[front:deploy] ERROR: preflight health endpoint is unreachable"
    if [[ "$FRONT_ALLOW_UNHEALTHY_DEPLOY" != "true" ]]; then
      echo "[front:deploy] set FRONT_ALLOW_UNHEALTHY_DEPLOY=true for emergency override"
      exit 1
    fi
    echo "[front:deploy] WARNING: continuing due to FRONT_ALLOW_UNHEALTHY_DEPLOY=true"
    return
  fi

  local ok
  if command -v jq >/dev/null 2>&1; then
    ok="$(printf '%s' "$json" | jq -r '.ok // false' 2>/dev/null || echo false)"
  else
    ok="$(printf '%s' "$json" | python3 -c 'import json,sys
try:
 d=json.load(sys.stdin)
 print("true" if d.get("ok") is True else "false")
except Exception:
 print("false")' 2>/dev/null || echo false)"
  fi

  if [[ "$ok" != "true" ]]; then
    echo "[front:deploy] ERROR: preflight health check returned ok=false"
    echo "$json"
    if [[ "$FRONT_ALLOW_UNHEALTHY_DEPLOY" != "true" ]]; then
      echo "[front:deploy] set FRONT_ALLOW_UNHEALTHY_DEPLOY=true for emergency override"
      exit 1
    fi
    echo "[front:deploy] WARNING: continuing due to FRONT_ALLOW_UNHEALTHY_DEPLOY=true"
  fi
}

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

preflight_or_fail

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
  NEXT_PUBLIC_LIVEKIT_URL=\"\$(grep -E '^NEXT_PUBLIC_LIVEKIT_URL=' .env.production | head -n1 | cut -d= -f2- || true)\"
  NEXT_PUBLIC_GM_SERVER_URL=\"\$(grep -E '^NEXT_PUBLIC_GM_SERVER_URL=' .env.production | head -n1 | cut -d= -f2- || true)\"
  NEXT_PUBLIC_ACTIVE_NETWORK=\"\$(grep -E '^NEXT_PUBLIC_ACTIVE_NETWORK=' .env.production | head -n1 | cut -d= -f2- || true)\"

  if [ -z \"\$LIVEKIT_API_KEY\" ] || [ -z \"\$LIVEKIT_API_SECRET\" ] || [ \"\$LIVEKIT_API_SECRET\" = 'replace-with-livekit-secret' ]; then
    echo '[front:deploy] ERROR: missing LIVEKIT_API_KEY/LIVEKIT_API_SECRET in .env.production'
    echo '[front:deploy] set values matching livekit.yaml keys before deploy'
    exit 1
  fi

  if [ -z \"\$NEXT_PUBLIC_LIVEKIT_URL\" ] || [ -z \"\$NEXT_PUBLIC_GM_SERVER_URL\" ] || [ -z \"\$NEXT_PUBLIC_ACTIVE_NETWORK\" ]; then
    echo '[front:deploy] ERROR: missing required NEXT_PUBLIC_* vars in .env.production'
    echo '[front:deploy] required: NEXT_PUBLIC_LIVEKIT_URL, NEXT_PUBLIC_GM_SERVER_URL, NEXT_PUBLIC_ACTIVE_NETWORK'
    exit 1
  fi

  COMPOSE_CMD='docker compose --env-file .env.production -f docker-compose.yaml up -d --build'
  if command -v ionice >/dev/null 2>&1; then
    COMPOSE_CMD=\"ionice -c ${FRONT_DEPLOY_IONICE_CLASS} -n ${FRONT_DEPLOY_IONICE_LEVEL} nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  else
    COMPOSE_CMD=\"nice -n ${FRONT_DEPLOY_NICE} \$COMPOSE_CMD\"
  fi

  echo '[front:deploy] running compose in low-priority mode to reduce server pressure'
  sh -lc \"\$COMPOSE_CMD\"
  docker compose --env-file .env.production -f docker-compose.yaml ps
"

echo "[front:deploy] done"
