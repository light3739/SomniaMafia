#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FRONT_MSG="${1:-chore(frontend): update}"

npm run -s push:front -- "$FRONT_MSG"
npm run -s gm:release

echo "[push-all] frontend pushed, gm published and deployed"
