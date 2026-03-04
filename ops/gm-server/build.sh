#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="${ROOT_DIR}/ops/gm-server/workdir"

if [[ ! -f "$WORKDIR/package.json" ]]; then
  echo "[build] Missing workdir. Run: npm run gm:sync"
  exit 1
fi

cd "$WORKDIR"
npm ci
npm run build

echo "[build] Build completed in $WORKDIR"
