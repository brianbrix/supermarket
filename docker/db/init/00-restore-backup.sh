#!/bin/sh
set -eu

BACKUP_DIR=${BACKUP_DIR:-/opt/db_backups/shop}
SITENAME=${SITENAME:-${APP_SITENAME:-shop}}
APP_VERSION=${APP_VERSION:-latest}
DB_NAME=${POSTGRES_DB:-${DB_DATABASE:-supermarket}}
DB_USER=${POSTGRES_USER:-${DB_USERNAME:-supermarket}}

if [ ! -d "$BACKUP_DIR" ]; then
  echo "[restore-backup] Backup directory $BACKUP_DIR not found. Skipping restore." >&2
  exit 0
fi

TARGET_FILE="$BACKUP_DIR/${SITENAME}-${APP_VERSION}.pgsql"
RESTORE_FILE=""

if [ -f "$TARGET_FILE" ]; then
  RESTORE_FILE="$TARGET_FILE"
else
  set +e
  RESTORE_FILE=$(ls -1t "$BACKUP_DIR/${SITENAME}-"*.pgsql 2>/dev/null | head -n 1)
  LS_EXIT=$?
  set -e
  if [ $LS_EXIT -ne 0 ]; then
    RESTORE_FILE=""
  fi
fi

if [ -z "$RESTORE_FILE" ]; then
  echo "[restore-backup] No matching backups found for sitename $SITENAME. Leaving database empty." >&2
  exit 0
fi

if [ ! -r "$RESTORE_FILE" ]; then
  echo "[restore-backup] Backup file $RESTORE_FILE is not readable." >&2
  exit 1
fi

echo "[restore-backup] Restoring $RESTORE_FILE into database $DB_NAME (user $DB_USER)."
export PGPASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-supermarket}}"
psql --set ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" < "$RESTORE_FILE"
unset PGPASSWORD

echo "[restore-backup] Restore complete."
