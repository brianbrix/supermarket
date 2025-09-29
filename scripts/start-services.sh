#!/usr/bin/env bash
set -euo pipefail

# Starts the supermarket stack behind Traefik.
#
# Usage:
#   ./scripts/start-services.sh                 # build + start all services (Traefik + stack)
#   ./scripts/start-services.sh --no-build      # reuse existing images
#   ./scripts/start-services.sh --no-traefik    # skip launching the Traefik companion stack
#   ./scripts/start-services.sh -- logs         # pass extra args to `docker compose up`
#
# Environment variables:
#   TRAEFIK_NETWORK  Name of the external Traefik network (default: traefik_proxy)
#   COMPOSE_CMD      Override docker compose binary (default: "docker compose")
#
# The script ensures the Traefik network exists, builds images (unless --no-build is
# set) and applies migrations if the backend container exposes artisan.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "${PROJECT_ROOT}"

COMPOSE_CMD=${COMPOSE_CMD:-"docker compose"}
TRAEFIK_NETWORK=${TRAEFIK_NETWORK:-traefik_proxy}
BUILD_IMAGES=1
START_TRAEFIK=1
BACKUP_DIR=${BACKUP_DIR:-/opt/db_backups/shop}

info() { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[error]\033[0m %s\n' "$*"; }

# --- argument parsing -------------------------------------------------------
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build)
      BUILD_IMAGES=0
      shift
      ;;
    --no-traefik)
      START_TRAEFIK=0
      shift
      ;;
    --help|-h)
      cat <<'EOF'
Usage: ./scripts/start-services.sh [options] [-- docker compose args]

Options:
  --no-build     Skip image build and reuse existing images.
  --no-traefik   Do not launch the Traefik companion stack.
  -h, --help     Show this help text.

Any arguments after "--" are passed directly to "docker compose up".
EOF
      exit 0
      ;;
    --)
      shift
      ARGS+=("$@")
      break
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

# --- sanity checks ----------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  error "docker is not installed or not on PATH."
  exit 1
fi

if ! ${COMPOSE_CMD} version >/dev/null 2>&1; then
  error "${COMPOSE_CMD} is not available. Set COMPOSE_CMD to an alternative binary (e.g. docker-compose)."
  exit 1
fi

if ! docker network inspect "${TRAEFIK_NETWORK}" >/dev/null 2>&1; then
  warn "Traefik network '${TRAEFIK_NETWORK}' not found. Creating it now."
  docker network create "${TRAEFIK_NETWORK}" >/dev/null
  info "Created network '${TRAEFIK_NETWORK}'."
fi

if [[ ! -d "${BACKUP_DIR}" ]]; then
  warn "Database backup directory '${BACKUP_DIR}' is missing. Attempting to create it."
  if mkdir -p "${BACKUP_DIR}" 2>/dev/null; then
    chmod 700 "${BACKUP_DIR}" 2>/dev/null || true
    info "Created '${BACKUP_DIR}'. Adjust permissions if other services need access."
  else
    warn "Could not create '${BACKUP_DIR}'. Create it manually so Postgres can restore backups."
  fi
fi

if [[ ${START_TRAEFIK} -eq 1 ]]; then
  info "Launching Traefik companion stack..."
  (cd docker/traefik && ${COMPOSE_CMD} up -d)
else
  warn "Skipping Traefik startup (--no-traefik). Ensure a reverse proxy is already running if required."
fi

# --- build & start ----------------------------------------------------------
if [[ ${BUILD_IMAGES} -eq 1 ]]; then
  info "Building images..."
  ${COMPOSE_CMD} -f docker-compose.yml build
else
  info "Skipping image build (--no-build)."
fi

info "Starting services..."
if [[ ${#ARGS[@]} -gt 0 ]]; then
  ${COMPOSE_CMD} -f docker-compose.yml up -d "${ARGS[@]}"
else
  ${COMPOSE_CMD} -f docker-compose.yml up -d
fi

# --- post-start tasks -------------------------------------------------------
info "Waiting for containers to become healthy..."
${COMPOSE_CMD} -f docker-compose.yml ps

info "Stack is up. Frontend: http://localhost:8080  |  API: http://localhost:8081/api"
