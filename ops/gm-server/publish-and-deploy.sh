#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

npm run -s gm:sync
npm run -s gm:publish
npm run -s gm:deploy

echo "[release] gm-server publish+deploy completed"
