#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${GM_SOURCE_DIR:-/home/light/projects/SomniaSol/gm-server}"
TARGET_DIR="${ROOT_DIR}/ops/gm-server/workdir"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[sync] Source not found: $SOURCE_DIR"
  echo "Set GM_SOURCE_DIR to your gm-server path."
  exit 1
fi

mkdir -p "$TARGET_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .env \
  --exclude .env.local \
  --exclude .env.production \
  --exclude .env.development \
  --exclude .git \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "[sync] Synced gm-server to $TARGET_DIR"
