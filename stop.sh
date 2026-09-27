#!/usr/bin/env bash
# stop.sh — Detiene y elimina los contenedores del stack.
# Los volúmenes de datos (MySQL) se conservan para no perder la BD.
#
# Uso: ./stop.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN="\033[0;36m"
GREEN="\033[0;32m"
RESET="\033[0m"

log() { echo -e "${CYAN}[stop]${RESET} $*"; }
ok()  { echo -e "${GREEN}[stop]${RESET} $*"; }

log "Deteniendo contenedores..."
docker compose -f "$ROOT_DIR/docker-compose.yml" down

ok "Stack detenido. Los datos de MySQL se conservaron."
ok "Para volver a levantar: ./dev.sh"
