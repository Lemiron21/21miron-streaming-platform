#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/video_platform_backup.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"
ENV_FILE="${ENV_FILE:-/etc/21miron/video-platform.env}"

if [[ ! -r "$BACKUP_FILE" ]]; then
  echo "Cannot read backup: $BACKUP_FILE" >&2
  exit 1
fi

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

read -r -p "Restore $BACKUP_FILE into database $DB_NAME? Type RESTORE: " confirmation
if [[ "$confirmation" != "RESTORE" ]]; then
  echo "Cancelled."
  exit 1
fi

export PGPASSWORD="$DB_PASSWORD"
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  "$BACKUP_FILE"
unset PGPASSWORD

echo "Restore completed."
