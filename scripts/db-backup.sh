#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "${ROOT_DIR}/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "${ROOT_DIR}/.env"
  set +a
fi

BACKUP_DIR=${BACKUP_DIR:-/opt/db_backups/shop}
SITENAME=${SITENAME:-${APP_SITENAME:-shop}}
if [ -z "${APP_VERSION:-}" ]; then
  echo "[db-backup] APP_VERSION is not set. Please export APP_VERSION before running this script." >&2
  exit 1
fi
APP_VERSION=${APP_VERSION}
DB_USER=${DB_USERNAME:-supermarket}
DB_NAME=${DB_DATABASE:-supermarket}
COMPOSE_CMD=${COMPOSE_CMD:-docker compose}
SERVICE_NAME=${DB_SERVICE_NAME:-db}

mkdir -p "${BACKUP_DIR}"

BACKUP_FILE="${BACKUP_DIR}/${SITENAME}-${APP_VERSION}.pgsql"

echo "[db-backup] Writing backup to ${BACKUP_FILE}"
${COMPOSE_CMD} exec -T "${SERVICE_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"

if command -v chmod >/dev/null 2>&1; then
  chmod 600 "${BACKUP_FILE}"
fi

echo "[db-backup] Backup completed."
