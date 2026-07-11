#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is not installed." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created $ROOT_DIR/.env"
  echo "Edit VIDEO_SERVER_IP and all CHANGE_ME values, then run this script again."
  exit 2
fi

if grep -q 'CHANGE_ME' .env; then
  echo "Replace every CHANGE_ME value in .env before starting production services." >&2
  exit 3
fi

mkdir -p backups logs

echo "Validating Compose configuration..."
docker compose config --quiet

echo "Pulling upstream images..."
docker compose pull postgres ovenmediaengine

echo "Building application images..."
docker compose build --pull backend frontend

echo "Starting 21miron Video Platform..."
docker compose up -d

echo
docker compose ps

echo
printf 'Web interface: http://%s:%s\n' "$(awk -F= '$1=="VIDEO_SERVER_IP"{print $2}' .env)" "$(awk -F= '$1=="WEB_PORT"{print $2}' .env)"
echo "Run ./scripts/compose-healthcheck.sh for full verification."
