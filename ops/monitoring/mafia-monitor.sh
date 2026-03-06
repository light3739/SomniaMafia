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

notify() {
  local key="$1"
  local text="$2"

  if [[ -z "$BOT_TOKEN" || -z "$CHAT_ID" ]]; then
    echo "[mafia-monitor] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not configured"
    return 0
  fi

  local now ts_file last=0
  now="$(date +%s)"
  ts_file="$STATE_DIR/${key}.last"
  if [[ -f "$ts_file" ]]; then
    last="$(cat "$ts_file" 2>/dev/null || echo 0)"
  fi

  if (( now - last < COOLDOWN_SECONDS )); then
    return 0
  fi

  curl -sS -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${CHAT_ID}" \
    -d "text=${text}" >/dev/null || true

  echo "$now" > "$ts_file"
}

check_http() {
  local key="$1"
  local url="$2"
  local name="$3"

  if ! curl -fsS --max-time 12 "$url" >/dev/null; then
    notify "$key" "🚨 ${name} DOWN: ${url}"
  fi
}

check_container() {
  local key="$1"
  local name="$2"
  local running

  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)"
  if [[ "$running" != "true" ]]; then
    notify "$key" "🚨 Container DOWN: ${name}"
  fi
}

check_disk() {
  local used
  used="$(df -P / | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if (( used >= MAX_DISK_PCT )); then
    notify "disk" "🚨 Disk usage критично: ${used}% on /"
  fi
}

check_mem() {
  local mem_pct
  mem_pct="$(free | awk '/Mem:/ {printf "%d", ($3/$2)*100}')"
  if (( mem_pct >= MAX_MEM_PCT )); then
    notify "memory" "🚨 Memory usage критично: ${mem_pct}%"
  fi
}

check_load() {
  local load1 cpus max_load
  load1="$(awk '{print $1}' /proc/loadavg)"
  cpus="$(nproc)"
  max_load="$(awk -v c="$cpus" -v m="$MAX_LOAD_PER_CPU" 'BEGIN {printf "%.2f", c*m}')"

  if awk -v l="$load1" -v m="$max_load" 'BEGIN {exit !(l > m)}'; then
    notify "load" "🚨 High load: load1=${load1}, cpu=${cpus}, threshold=${max_load}"
  fi
}

check_http "site_apex" "https://mafiaonchain.live/" "Frontend apex"
check_http "site_www" "https://www.mafiaonchain.live/" "Frontend www"
check_http "gm_health" "https://gm.mafiaonchain.live/health" "GM API"
check_http "livekit" "https://livekit.mafiaonchain.live/" "LiveKit"

check_container "caddy_container" "livekit-prod-caddy-1"
check_container "livekit_container" "livekit-prod-livekit-1"
check_container "front_container" "somnia-frontend"
check_container "front_redis_container" "somnia-redis"

check_disk
check_mem
check_load

exit 0