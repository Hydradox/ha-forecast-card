#!/usr/bin/env bash
# Throwaway Home Assistant in Podman to test the card.   Usage: dev/ha.sh [up|setup|down|logs|reset]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$HERE")"
NAME=hfc-dev-ha
IMAGE="${HA_IMAGE:-ghcr.io/home-assistant/home-assistant:stable}"
PORT="${HA_PORT:-8123}"

up() {
  [ -f "$ROOT/dist/ha-forecast-card.js" ] || (cd "$ROOT" && npm run build)
  if podman container exists "$NAME"; then
    podman start "$NAME" >/dev/null
  else
    mkdir -p "$HERE/config/www"
    # dist/ is mounted read-only as /config/www: the card is served at /local/ha-forecast-card.js
    podman run -d --name "$NAME" \
      -e TZ=Europe/Madrid \
      -p "$PORT:8123" \
      -v "$HERE/config:/config:z" \
      -v "$ROOT/dist:/config/www:ro,z" \
      "$IMAGE" >/dev/null
  fi
  echo "Home Assistant starting on http://localhost:$PORT (first boot takes a minute)…"
  node "$HERE/setup.mjs" "http://localhost:$PORT"
}

case "${1:-up}" in
  up)    up ;;
  setup) node "$HERE/setup.mjs" "http://localhost:$PORT" ;;
  down)  podman rm -f "$NAME" >/dev/null && echo "Stopped (state kept in dev/config)." ;;
  logs)  podman logs -f "$NAME" ;;
  reset) podman rm -f "$NAME" >/dev/null 2>&1 || true
         find "$HERE/config" -mindepth 1 -maxdepth 1 ! -name configuration.yaml ! -name themes -exec rm -rf {} +
         echo "Dev Home Assistant state wiped." ;;
  *)     echo "usage: $0 [up|setup|down|logs|reset]" >&2; exit 1 ;;
esac
