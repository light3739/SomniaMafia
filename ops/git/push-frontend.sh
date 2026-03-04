#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BRANCH="${FRONT_BRANCH:-main}"
MSG="${1:-chore(frontend): update}"

# Frontend-focused paths
TARGETS=(
  app
  components
  contexts
  hooks
  services
  contracts
  public
  types
  next.config.ts
  package.json
  package-lock.json
  tsconfig.json
  README.md
)

for path in "${TARGETS[@]}"; do
  if [[ -e "$path" ]]; then
    git add "$path"
  fi
done

git commit -m "$MSG" || true
git push origin "$BRANCH"

echo "[push-frontend] pushed to $BRANCH"
