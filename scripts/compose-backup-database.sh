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

mkdir -p backups
stamp="$(date +%Y%m%d-%H%M%S)"
out="backups/${DB_NAME}-${stamp}.sql.gz"

docker compose exec -T postgres pg_dump -U "$DB_USER" -d "$DB_NAME" \
  | gzip -9 > "$out"

chmod 600 "$out"
echo "Database backup created: $ROOT_DIR/$out"
