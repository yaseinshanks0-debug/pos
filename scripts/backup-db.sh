#!/bin/bash
set -eo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-enterprise_erp}"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting automated backup of ${DB_NAME} from ${DB_HOST}:${DB_PORT}..."

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres_password}"

pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F p --clean --if-exists | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
echo "[$(date)] Size: $(du -sh "$BACKUP_FILE" | cut -f1)"

# Rotate backups older than retention window
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "${DB_NAME}_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} \;

echo "[$(date)] Backup routine finished cleanly."
