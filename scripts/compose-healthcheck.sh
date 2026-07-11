#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "Missing .env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

failed=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf '[OK]   %s\n' "$label"
  else
    printf '[FAIL] %s\n' "$label"
    failed=1
  fi
}

check "Docker daemon" docker info
check "Compose configuration" docker compose config --quiet
check "PostgreSQL container" docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME"
check "Backend API" curl -fsS "http://127.0.0.1:${WEB_PORT}/api/system/metrics"
check "Frontend" curl -fsS "http://127.0.0.1:${WEB_PORT}/healthz"
check "OME signaling TCP/3333" bash -c '</dev/tcp/127.0.0.1/3333'
check "OME RTMP TCP/1935" bash -c '</dev/tcp/127.0.0.1/1935'

printf '\nContainers:\n'
docker compose ps

printf '\nDisk:\n'
df -h /

printf '\nMemory:\n'
free -h

exit "$failed"
