#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

if [[ -z "${APP_KEY:-}" || "${APP_KEY}" == "base64:placeholder" ]]; then
  echo "[backend-entrypoint] Generating APP_KEY..."
  export APP_KEY="$(php artisan key:generate --show | tr -d '\r')"
fi

MIGRATION_ATTEMPTS=${MIGRATION_ATTEMPTS:-10}
MIGRATION_RETRY_DELAY=${MIGRATION_RETRY_DELAY:-5}

for attempt in $(seq 1 "${MIGRATION_ATTEMPTS}"); do
  if php artisan migrate --force; then
    break
  fi

  if [[ "${attempt}" -eq "${MIGRATION_ATTEMPTS}" ]]; then
    echo "[backend-entrypoint] Migration failed after ${MIGRATION_ATTEMPTS} attempts. Aborting." >&2
    exit 1
  fi

  echo "[backend-entrypoint] Migration attempt ${attempt} failed. Retrying in ${MIGRATION_RETRY_DELAY}s..." >&2
  sleep "${MIGRATION_RETRY_DELAY}"
done

exec "$@"
