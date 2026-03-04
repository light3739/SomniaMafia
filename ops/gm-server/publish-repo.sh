#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKDIR="${ROOT_DIR}/ops/gm-server/workdir"
OWNER="${GH_OWNER:-light3739}"
REPO_NAME="${GM_REPO_NAME:-somnia-mafia-gm-server}"
VISIBILITY="${GM_REPO_VISIBILITY:-private}" # private|public
DEFAULT_BRANCH="main"

if ! command -v gh >/dev/null 2>&1; then
  echo "[publish] GitHub CLI (gh) is required."
  exit 1
fi

if [[ ! -f "$WORKDIR/package.json" ]]; then
  echo "[publish] Missing workdir. Run: npm run gm:sync"
  exit 1
fi

cd "$WORKDIR"

rm -rf node_modules dist
rm -f .env .env.local .env.production .env.development

if [[ ! -d .git ]]; then
  git init
  git checkout -b "$DEFAULT_BRANCH"
fi

git add .
git commit -m "chore: initial gm-server sync" || true

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO_NAME" --"$VISIBILITY" --source . --remote origin --push
else
  git add .
  git commit -m "chore: sync gm-server" || true
  git push -u origin "$DEFAULT_BRANCH"
fi

echo "[publish] Repository ready: https://github.com/$OWNER/$REPO_NAME"
