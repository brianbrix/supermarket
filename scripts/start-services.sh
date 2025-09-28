#!/usr/bin/env bash
set -euo pipefail

# Starts the supermarket stack behind Traefik.
#
# Usage:
#   ./scripts/start-services.sh            # build + start all services
#   ./scripts/start-services.sh --no-build # reuse existing images
#   ./scripts/start-services.sh -- logs    # pass extra args to `docker compose up`
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
    --help|-h)
      cat <<'EOF'
Usage: ./scripts/start-services.sh [options] [-- docker compose args]

Options:
  --no-build   Skip image build and reuse existing images.
  -h, --help   Show this help text.

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
  info "Created network '${TRAEFIK_NETWORK}'. Ensure your Traefik container joins this network."
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

info "Stack is up. Access the shop via the Traefik route (e.g. http://<IP>/shop)."
