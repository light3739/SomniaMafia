#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root"
  exit 1
fi

install -m 755 ./mafia-monitor.sh /usr/local/bin/mafia-monitor.sh

if [[ ! -f /etc/mafia-monitor.env ]]; then
  cat > /etc/mafia-monitor.env <<'EOF'
# Telegram bot credentials for alerts
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Thresholds
ALERT_COOLDOWN_SECONDS=900
MAX_DISK_PCT=90
MAX_MEM_PCT=92
MAX_LOAD_PER_CPU=2.0
EOF
  chmod 600 /etc/mafia-monitor.env
fi

cat > /etc/systemd/system/mafia-monitor.service <<'EOF'
[Unit]
Description=Mafia critical services monitor
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/mafia-monitor.sh
User=root
Group=root
EOF

cat > /etc/systemd/system/mafia-monitor.timer <<'EOF'
[Unit]
Description=Run Mafia monitor every 2 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now mafia-monitor.timer
systemctl restart mafia-monitor.timer

echo "[mafia-monitor] installed"
systemctl status mafia-monitor.timer --no-pager -n 20 || true