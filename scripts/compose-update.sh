#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env. Run scripts/compose-install.sh first." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree contains local changes. Commit or stash them before updating." >&2
  git status --short
  exit 2
fi

git pull --ff-only

docker compose config --quiet
docker compose pull postgres ovenmediaengine
docker compose build --pull backend frontend
docker compose up -d --remove-orphans

docker image prune -f >/dev/null

docker compose ps
