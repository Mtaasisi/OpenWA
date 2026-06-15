#!/usr/bin/env bash
# Stop processes that block the desktop CRM port (2886) or the API dev port (2785) when requested.
set -euo pipefail

DESKTOP_PORT="${DESKTOP_PORT:-2886}"
API_PORT="${API_PORT:-2785}"
MODE="${1:-desktop}"

free_port() {
  local port="$1"
  local label="$2"
  if lsof -iTCP:"$port" -sTCP:LISTEN -P >/dev/null 2>&1; then
    local cmd
    cmd="$(lsof -iTCP:"$port" -sTCP:LISTEN -P 2>/dev/null | awk 'NR==2 {print $1}')"
    echo "Freeing port $port ($label, was: ${cmd:-unknown})…"
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs kill -TERM 2>/dev/null || true
    sleep 1
    if lsof -iTCP:"$port" -sTCP:LISTEN -P >/dev/null 2>&1; then
      lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
}

case "$MODE" in
  desktop)
    free_port "$DESKTOP_PORT" "desktop CRM"
    ;;
  web)
    free_port "$DESKTOP_PORT" "vite dashboard"
    free_port "$API_PORT" "API dev"
    ;;
  all)
    free_port "$DESKTOP_PORT" "desktop/vite"
    free_port "$API_PORT" "API"
    ;;
  *)
    echo "Usage: $0 [desktop|web|all]"
    exit 1
    ;;
esac

echo "Ports ready for $MODE mode."
