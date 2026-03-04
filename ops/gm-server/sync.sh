#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="${GM_SOURCE_DIR:-${ROOT_DIR}/ops/gm-server/source}"
TARGET_DIR="${ROOT_DIR}/ops/gm-server/workdir"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "[sync] Source not found: $SOURCE_DIR"
  echo "Set GM_SOURCE_DIR to your gm-server path."
  exit 1
fi

mkdir -p "$TARGET_DIR"
# Portable sync using cp
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
cp -rf "$SOURCE_DIR/." "$TARGET_DIR/"
# Manual clean up of excluded items
find "$TARGET_DIR" -type d -name "node_modules" -exec rm -rf {} +
find "$TARGET_DIR" -type d -name "dist" -exec rm -rf {} +
find "$TARGET_DIR" -type d -name ".git" -exec rm -rf {} +
rm -f "$TARGET_DIR/.env"*

echo "[sync] Synced gm-server to $TARGET_DIR"
