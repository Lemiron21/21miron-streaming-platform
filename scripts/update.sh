#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/video-platform"
APP_USER="video-platform"

log() { printf '\n[21miron] %s\n' "$*"; }
fail() { printf '\n[21miron] ERROR: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Run as root: sudo bash scripts/update.sh"
[[ -d "$APP_DIR/.git" ]] || fail "Repository not found in $APP_DIR"

log "Checking repository state"
cd "$APP_DIR"
if [[ -n "$(git status --porcelain)" ]]; then
  fail "Local changes detected. Review git status and commit or stash them before updating."
fi

git pull --ff-only
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

log "Updating Python dependencies"
sudo -u "$APP_USER" "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

log "Updating frontend dependencies and build"
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm install
sudo -u "$APP_USER" npm run build

log "Validating Nginx and restarting services"
nginx -t
systemctl restart video-platform.service
systemctl reload nginx.service

log "Running health check"
bash "$APP_DIR/scripts/healthcheck.sh"
