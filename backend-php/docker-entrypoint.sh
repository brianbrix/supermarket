#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

if [[ ! -f .env ]]; then
  if [[ ! -w . ]]; then
    echo "[backend-entrypoint] Warning: application directory not writable; unable to seed .env automatically." >&2
  elif [[ -f .env.docker ]]; then
    echo "[backend-entrypoint] Initialising .env from .env.docker..."
    cp .env.docker .env
  elif [[ -f .env.example ]]; then
    echo "[backend-entrypoint] Initialising .env from .env.example..."
    cp .env.example .env
  else
    echo "[backend-entrypoint] Warning: no .env template found; proceeding without copy." >&2
  fi
fi

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

# Run database seeding
echo "[backend-entrypoint] Running database seeders..."
php artisan db:seed --force

if [[ "${ENABLE_SCHEDULER:-1}" != "0" ]]; then
  echo "[backend-entrypoint] Starting scheduler worker..."
  php artisan schedule:work --no-interaction --verbose &
fi

exec "$@"