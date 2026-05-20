#!/usr/bin/env bash
set -euo pipefail

echo "Starting deployment..."

REPO_DIR="${REPO_DIR:-/var/www/comp-net-security-S26}"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Repository directory not found: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

# Note: `git pull` happens in the calling workflow (.github/workflows/deploy.yml),
# not here. If we pulled from inside this script, the file would be atomically
# replaced mid-execution and bash would keep reading the old inode — meaning any
# edits to lines below the pull (like `npm ci` → `npm install`) wouldn't take
# effect until the *next* run. Keep the pull external.

echo "Installing frontend dependencies..."
npm --prefix frontend install

echo "Building frontend..."
npm --prefix frontend run build

echo "Installing backend dependencies..."
npm --prefix backend install

ENV_FILE="backend/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing required env file: $ENV_FILE"
  exit 1
fi

echo "Loading production environment variables..."
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

echo "Restarting PM2 ecosystem..."
pm2 startOrRestart backend/ecosystem.config.cjs --env production --update-env
pm2 save

echo "Deployment complete."
