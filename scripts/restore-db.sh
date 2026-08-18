#!/bin/bash
set -eo pipefail

if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file $BACKUP_FILE does not exist."
  exit 1
fi

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-enterprise_erp}"

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres_password}"

echo "[WARNING] You are about to restore database ${DB_NAME} on ${DB_HOST} from ${BACKUP_FILE}."
echo "This will overwrite existing data."

if [ -z "$FORCE_RESTORE" ]; then
  read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Restore aborted by user."
    exit 0
  fi
fi

echo "[$(date)] Restoring database ${DB_NAME}..."
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"

echo "[$(date)] Database restoration completed successfully."
