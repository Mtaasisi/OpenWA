#!/usr/bin/env bash
# Smoke-test the backend bundled inside a built .app (no Electron UI).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_PATH="${1:-$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app}"

if [[ ! -d "$APP_PATH" ]]; then
  echo "App not found: $APP_PATH"
  echo "Build first: npm run dist:mac"
  exit 1
fi

RESOURCES="$APP_PATH/Contents/Resources"
NODE_BIN="$RESOURCES/runtimes/node/node-v22.14.0-darwin-arm64/bin/node"
MAIN_JS="$RESOURCES/backend/dist/main.js"
BACKEND_CWD="$RESOURCES/backend"
STATIC_PATH="$RESOURCES/dashboard/dist"
SMOKE_ROOT="${TMPDIR:-/tmp}/inauzwa-smoke-$$"
PORT="${SMOKE_PORT:-2898}"
LOG_FILE="$SMOKE_ROOT/smoke-backend.log"

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="$RESOURCES/runtimes/node/node-v22.14.0-darwin-x64/bin/node"
fi

# Optional: test repo backend against bundled node (dev only — may fail on native modules).
if [[ "${SMOKE_USE_REPO:-}" == "1" && -f "$ROOT/dist/main.js" ]]; then
  MAIN_JS="$ROOT/dist/main.js"
  BACKEND_CWD="$ROOT"
  STATIC_PATH="${ROOT}/dashboard/dist"
fi

if [[ ! -f "$MAIN_JS" ]]; then
  echo "Missing backend: $MAIN_JS"
  exit 1
fi

mkdir -p "$SMOKE_ROOT"/{config,sessions,media,logs,ai-knowledge,ai-memory}

export APP_DESKTOP_MODE=true
export OPENWA_DATA_ROOT="$SMOKE_ROOT"
export PORT="$PORT"
export APP_HOST=127.0.0.1
export NODE_ENV=production
unset DATABASE_URL
export DATABASE_TYPE=sqlite
export DATABASE_NAME="$SMOKE_ROOT/config/openwa.sqlite"
export DATABASE_SYNCHRONIZE=true
export DESKTOP_STATIC_PATH="$STATIC_PATH"
export DESKTOP_SETUP_TOKEN=smoke-test-token
export SESSION_DATA_PATH="$SMOKE_ROOT/sessions"
export STORAGE_LOCAL_PATH="$SMOKE_ROOT/media"
export AI_KNOWLEDGE_PATH="$SMOKE_ROOT/ai-knowledge"
export CORS_ORIGINS="http://127.0.0.1:$PORT"
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 48)}"
export API_MASTER_KEY="${API_MASTER_KEY:-$(openssl rand -hex 32)}"

cat > "$SMOKE_ROOT/config/app.env" <<EOF
APP_DESKTOP_MODE=true
OPENWA_DATA_ROOT=$SMOKE_ROOT
JWT_SECRET=$JWT_SECRET
API_MASTER_KEY=$API_MASTER_KEY
DESKTOP_SETUP_TOKEN=$DESKTOP_SETUP_TOKEN
DATABASE_TYPE=sqlite
DATABASE_NAME=$SMOKE_ROOT/config/openwa.sqlite
DATABASE_SYNCHRONIZE=true
DESKTOP_STATIC_PATH=$STATIC_PATH
PORT=$PORT
APP_HOST=127.0.0.1
EOF

CHROME="$(find "$RESOURCES/runtimes/chromium" -name 'Google Chrome for Testing' -o -name 'chrome' 2>/dev/null | head -1 || true)"
if [[ -n "$CHROME" ]]; then
  export PUPPETEER_EXECUTABLE_PATH="$CHROME"
fi

echo "Smoke test: $NODE_BIN $MAIN_JS"
echo "Backend cwd: $BACKEND_CWD"
echo "Data root: $SMOKE_ROOT"
echo "Port: $PORT"

cd "$BACKEND_CWD"
"$NODE_BIN" "$MAIN_JS" >"$LOG_FILE" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null; rm -rf "$SMOKE_ROOT"' EXIT

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null; then
    echo "OK /api/health"
    break
  fi
  sleep 1
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Backend exited early. Log:"
    tail -30 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi
  if [[ $i -eq 60 ]]; then
    echo "Timeout waiting for health. Log:"
    tail -30 "$LOG_FILE" 2>/dev/null || true
    exit 1
  fi
done

DESKTOP_HEALTH=$(curl -sf -H "X-Desktop-Setup-Token: smoke-test-token" "http://127.0.0.1:$PORT/api/health/desktop")
echo "OK /api/health/desktop: $(echo "$DESKTOP_HEALTH" | head -c 120)..."

STATIC=$(curl -sf -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/")
if [[ "$STATIC" != "200" ]]; then
  echo "Dashboard static failed: HTTP $STATIC"
  exit 1
fi
echo "OK dashboard index HTTP 200"
echo "Smoke test passed"

export SMOKE_PORT="$PORT"
export DESKTOP_SETUP_TOKEN=smoke-test-token
bash "$ROOT/desktop/scripts/smoke-desktop-api.sh"
bash "$ROOT/desktop/scripts/smoke-desktop-setup.sh"
