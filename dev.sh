#!/usr/bin/env bash
# dev.sh — Levanta el stack completo de desarrollo:
#   1. MySQL (y Adminer) via Docker Compose
#   2. API (Express/Prisma) con nodemon
#   3. Web (Vite) en modo dev
#
# Uso: ./dev.sh
# Detener: Ctrl+C (mata API y web; detiene los contenedores)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
WEB_DIR="$ROOT_DIR/web"

# ── Colores ────────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

log()  { echo -e "${CYAN}[dev]${RESET} $*"; }
ok()   { echo -e "${GREEN}[dev]${RESET} $*"; }
warn() { echo -e "${YELLOW}[dev]${RESET} $*"; }
err()  { echo -e "${RED}[dev]${RESET} $*" >&2; }

# ── PIDs de procesos hijos ─────────────────────────────────────────────────────
API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  log "Deteniendo servicios..."

  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null && ok "API detenida."
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null && ok "Web detenida."

  log "Deteniendo contenedores Docker..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" stop mysql adminer 2>/dev/null || true
  ok "Contenedores detenidos. ¡Hasta luego!"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── 1. Verificar dependencias ──────────────────────────────────────────────────
for cmd in docker node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Dependencia faltante: '$cmd' no encontrado en PATH."
    exit 1
  fi
done

# ── 2. Levantar MySQL y Adminer en Docker ──────────────────────────────────────
log "Levantando MySQL y Adminer con Docker Compose..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d mysql adminer

# ── 3. Esperar a que MySQL esté saludable ──────────────────────────────────────
log "Esperando a que MySQL esté listo..."
RETRIES=30
until docker compose -f "$ROOT_DIR/docker-compose.yml" exec -T mysql \
  mysqladmin ping -h localhost -u root -psecret --silent &>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -le 0 ]]; then
    err "MySQL no respondió a tiempo. Revisa los logs: docker compose logs mysql"
    exit 1
  fi
  printf "."
  sleep 2
done
echo ""
ok "MySQL listo."

# ── 4. Levantar API ────────────────────────────────────────────────────────────
log "Iniciando API en http://localhost:4000 ..."
(cd "$API_DIR" && npm run dev 2>&1 | sed 's/^/  [api] /') &
API_PID=$!

# Esperar a que la API esté escuchando (máx 20 s)
log "Esperando a que la API levante..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null http://localhost:4000/graphql 2>/dev/null; then
    ok "API lista en http://localhost:4000/graphql"
    break
  fi
  sleep 1
done

# ── 5. Levantar Web ────────────────────────────────────────────────────────────
log "Iniciando Web en http://localhost:5173 ..."
(cd "$WEB_DIR" && npm run dev 2>&1 | sed 's/^/  [web] /') &
WEB_PID=$!

# ── 6. Resumen ─────────────────────────────────────────────────────────────────
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok " Web     → http://localhost:5173"
ok " API     → http://localhost:4000/graphql"
ok " Adminer → http://localhost:8080"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok " Ctrl+C para detener todo."
echo ""

# Esperar indefinidamente
wait
