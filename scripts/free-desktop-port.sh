#!/usr/bin/env bash
# Free port 2886 (or DESKTOP_PORT) for the Inauzwa CRM desktop backend.
PORT="${DESKTOP_PORT:-2886}"
if lsof -iTCP:"$PORT" -sTCP:LISTEN -P >/dev/null 2>&1; then
  echo "Stopping process on port $PORT…"
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null || true
  sleep 1
fi
if lsof -iTCP:"$PORT" -sTCP:LISTEN -P >/dev/null 2>&1; then
  echo "Port $PORT still in use"
  lsof -iTCP:"$PORT" -sTCP:LISTEN -P
  exit 1
fi
echo "Port $PORT is free"
