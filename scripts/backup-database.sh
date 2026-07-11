#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/21miron/video-platform.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/21miron}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ ! -r "$ENV_FILE" ]]; then
  echo "Cannot read environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"

install -d -m 0750 "$BACKUP_DIR"
TIMESTAMP="$(date +%F_%H-%M-%S)"
TARGET="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  --format=custom \
  --no-owner \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --file="$TARGET" \
  "$DB_NAME"
unset PGPASSWORD

find "$BACKUP_DIR" -type f -name "${DB_NAME}_*.dump" -mtime "+$RETENTION_DAYS" -delete
chmod 0640 "$TARGET"
echo "Backup created: $TARGET"
