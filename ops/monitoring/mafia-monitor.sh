#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/mafia-monitor.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

STATE_DIR="/var/lib/mafia-monitor"
mkdir -p "$STATE_DIR"

COOLDOWN_SECONDS="${ALERT_COOLDOWN_SECONDS:-900}"
MAX_DISK_PCT="${MAX_DISK_PCT:-90}"
MAX_MEM_PCT="${MAX_MEM_PCT:-92}"
MAX_LOAD_PER_CPU="${MAX_LOAD_PER_CPU:-2.0}"

send_telegram() {
  local text="$1"
  if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
    echo "[mafia-monitor] TELEGRAM not configured: $text"
    return 0
  fi
  curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    --data-urlencode "text=${text}" >/dev/null || true
}

# notify_down: send alert with cooldown; track DOWN state for recovery detection
notify_down() {
  local key="$1"
  local text="$2"
  local now ts_file last=0
  now="$(date +%s)"
  ts_file="$STATE_DIR/${key}.last"

  if [[ -f "$ts_file" ]]; then
    last="$(cat "$ts_file" 2>/dev/null || echo 0)"
  fi

  # Mark state as down
  echo "down" > "$STATE_DIR/${key}.state"

  if (( now - last < COOLDOWN_SECONDS )); then
    return 0
  fi

  send_telegram "$text"
  echo "$now" > "$ts_file"
}

# notify_up: send recovery notification once when state recovers from down
notify_up() {
  local key="$1"
  local text="$2"
  local state_file="$STATE_DIR/${key}.state"

  if [[ -f "$state_file" ]] && [[ "$(cat "$state_file" 2>/dev/null)" == "down" ]]; then
    echo "up" > "$state_file"
    # Reset cooldown so next incident fires immediately
    rm -f "$STATE_DIR/${key}.last"
    send_telegram "$text"
  fi
}

check_http() {
  local key="$1"
  local url="$2"
  local name="$3"

  if curl -fsS --max-time 12 "$url" >/dev/null 2>&1; then
    notify_up "$key" "🟢 ${name} RECOVERED: ${url}"
  else
    notify_down "$key" "🚨 ${name} DOWN: ${url}"
  fi
}

check_container() {
  local key="$1"
  local name="$2"
  local running

  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)"
  if [[ "$running" == "true" ]]; then
    notify_up "$key" "🟢 Container RECOVERED: ${name}"
  else
    notify_down "$key" "🚨 Container DOWN: ${name}"
  fi
}

check_pm2() {
  local key="$1"
  local pm2_name="$2"
  local export_nvm="export NVM_DIR=\"\$HOME/.nvm\" && [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\""
  local status
  status="$(bash -c "${export_nvm} && pm2 jlist 2>/dev/null | python3 -c \"
import json,sys
try:
  procs=[p for p in json.load(sys.stdin) if p.get('name')=='${pm2_name}']
  print('online' if procs and procs[0].get('pm2_env',{}).get('status')=='online' else 'down')
except Exception:
  print('down')
\"" 2>/dev/null || echo down)"

  if [[ "$status" == "online" ]]; then
    notify_up "$key" "🟢 PM2 RECOVERED: ${pm2_name}"
  else
    notify_down "$key" "🚨 PM2 process DOWN: ${pm2_name}"
  fi
}

check_disk() {
  local used
  used="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if (( used >= MAX_DISK_PCT )); then
    notify_down "disk" "🚨 Disk usage критично: ${used}% on /"
  fi
}

check_mem() {
  local mem_pct
  mem_pct="$(free | awk '/Mem:/ {printf "%d", ($3/$2)*100}')"
  if (( mem_pct >= MAX_MEM_PCT )); then
    notify_down "memory" "🚨 Memory usage критично: ${mem_pct}%"
  fi
}

check_load() {
  local load1 cpus max_load
  load1="$(awk '{print $1}' /proc/loadavg)"
  cpus="$(nproc)"
  max_load="$(awk -v c="$cpus" -v m="$MAX_LOAD_PER_CPU" 'BEGIN {printf "%.2f", c*m}')"

  if awk -v l="$load1" -v m="$max_load" 'BEGIN {exit !(l > m)}'; then
    notify_down "load" "🚨 High load: load1=${load1}, cpu=${cpus}, threshold=${max_load}"
  fi
}

# ── TEST (primary environment on mafiatest) ──────────────────────────────────
check_http      "site_test"            "https://test.mafiaonchain.live/"          "Frontend TEST"
check_http      "gm_test_health"       "https://gm-test.mafiaonchain.live/health" "GM TEST API"
check_http      "livekit"              "https://livekit.mafiaonchain.live/"        "LiveKit"

check_container "front_dev_container"       "mafia-frontend-dev"
check_container "gm_dev_container"          "mafia-gm-dev"
check_container "redis_dev_container"       "mafia-redis-dev"
check_container "livekit_container"         "livekit-server"

# ── PROD (uncomment when prod is deployed on a separate server) ──────────────
# check_http      "site_apex"            "https://mafiaonchain.live/"          "Frontend apex"
# check_http      "gm_health"            "https://gm.mafiaonchain.live/health" "GM API"
# check_container "front_container"      "somnia-frontend"
# check_container "front_redis_container" "somnia-redis"

# ── SYSTEM ────────────────────────────────────────────────────────────────────
check_disk
check_mem
check_load

exit 0