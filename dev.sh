#!/usr/bin/env bash
# dev.sh — Construye y levanta el stack completo en Docker, luego termina.
# Los logs de cada servicio se ven en la interfaz de Docker Desktop.
#
# Uso:    ./dev.sh
# Parar:  ./stop.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

GREEN="\033[0;32m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

log() { echo -e "${CYAN}[dev]${RESET} $*"; }
ok()  { echo -e "${GREEN}[dev]${RESET} $*"; }
err() { echo -e "${RED}[dev]${RESET} $*" >&2; }

# ── Verificar dependencias ─────────────────────────────────────────────────────
for cmd in docker; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Dependencia faltante: '$cmd' no encontrado en PATH."
    exit 1
  fi
done

# ── Variables de entorno ───────────────────────────────────────────────────────
# .env no se versiona (contiene secretos). En un clon nuevo se crea a partir de
# .env.example, que trae valores funcionales para desarrollo salvo la key de Groq.
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  log "Se creó .env desde .env.example. Pon tu GROQ_API_KEY en .env para activar DulceBot."
fi

# ── Construir y levantar todo en Docker ────────────────────────────────────────
# --build  → reconstruye la imagen si el Dockerfile o package.json cambiaron
# -d       → modo detached: el script termina, los contenedores siguen corriendo
log "Construyendo y levantando el stack..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d --build

# ── Listo ──────────────────────────────────────────────────────────────────────
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok " Web     → http://localhost:5173"
ok " API     → http://localhost:4000/graphql"
ok " Adminer → http://localhost:8080"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok " Logs: Docker Desktop › Containers › antojo-yanet"
ok " Para detener: ./stop.sh"
echo ""
