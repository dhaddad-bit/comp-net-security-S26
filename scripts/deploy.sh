#!/usr/bin/env bash
set -euo pipefail

echo "Starting deployment..."

REPO_DIR="/var/www/social-scheduler"

if [[ ! -d "$REPO_DIR" ]]; then
  echo "Repository directory not found: $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

echo "Pulling latest changes..."
git pull --ff-only

echo "Installing frontend dependencies..."
npm --prefix frontend ci

echo "Building frontend..."
npm --prefix frontend run build

echo "Installing backend dependencies..."
npm --prefix backend ci

echo "Restarting PM2 ecosystem..."
pm2 startOrRestart backend/ecosystem.config.cjs --env production
pm2 save

echo "Deployment complete."
