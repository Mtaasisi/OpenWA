#!/bin/bash
# Prevent macOS sleep while OpenWA production containers are running.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_DIR/.openwa-caffeinate.pid"

stop_existing() {
  if [ -f "$PID_FILE" ]; then
    local old_pid
    old_pid="$(cat "$PID_FILE")"
    if kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}

case "${1:-start}" in
  start)
    stop_existing
    # -d display, -i idle, -m disk, -s system sleep while plugged in
    caffeinate -dimsu &
    echo $! > "$PID_FILE"
    echo "Keep-awake started (PID $(cat "$PID_FILE"))."
    echo "Stop with: $0 stop"
    ;;
  stop)
    stop_existing
    echo "Keep-awake stopped."
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      echo "Keep-awake running (PID $(cat "$PID_FILE"))."
    else
      echo "Keep-awake not running."
    fi
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
