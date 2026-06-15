#!/usr/bin/env bash
# Start the packaged desktop backend using real app-data paths (sqlite test DB).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app"
RES="$APP/Contents/Resources"
NODE="$RES/runtimes/node/node-v22.14.0-darwin-arm64/bin/node"
MAIN="$RES/backend/dist/main.js"
DATA="$HOME/Library/Application Support/Inauzwa CRM"
PORT="${LIVE_TEST_PORT:-2886}"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "macOS only"
  exit 1
fi

if lsof -iTCP:"$PORT" -sTCP:LISTEN -P >/dev/null 2>&1; then
  echo "Port $PORT is in use (stop dashboard dev server: npm run dashboard:dev uses 2886)"
  lsof -iTCP:"$PORT" -sTCP:LISTEN -P
  exit 1
fi

if [[ ! -f "$MAIN" ]]; then
  echo "Build missing. Run: npm run dist:mac"
  exit 1
fi

read_env() {
  grep -E "^${1}=" "$DATA/config/app.env" | cut -d= -f2- | tr -d '\r'
}
export JWT_SECRET="$(read_env JWT_SECRET)"
export API_MASTER_KEY="$(read_env API_MASTER_KEY)"
export DESKTOP_SETUP_TOKEN="$(read_env DESKTOP_SETUP_TOKEN)"
export DESKTOP_DEVICE_ID="$(read_env DESKTOP_DEVICE_ID)"

export APP_DESKTOP_MODE=true
export OPENWA_DATA_ROOT="$DATA"
export PORT="$PORT"
export APP_HOST=127.0.0.1
export NODE_ENV=production
export DATABASE_TYPE=sqlite
export DATABASE_NAME="$DATA/config/live-test.sqlite"
export DATABASE_SYNCHRONIZE=true
export DESKTOP_STATIC_PATH="$RES/dashboard/dist"
export SESSION_DATA_PATH="$DATA/sessions"
export STORAGE_LOCAL_PATH="$DATA/media"
export AI_KNOWLEDGE_PATH="$DATA/ai-knowledge"
export CORS_ORIGINS="http://127.0.0.1:$PORT"

CHROME="$(find "$RES/runtimes/chromium" -name 'Google Chrome for Testing' 2>/dev/null | head -1)"
[[ -n "$CHROME" ]] && export PUPPETEER_EXECUTABLE_PATH="$CHROME"

echo "Starting live packaged backend on :$PORT (sqlite test db)…"
cd "$RES/backend"
"$NODE" "$MAIN" &
PID=$!
trap 'kill $PID 2>/dev/null' EXIT

for i in $(seq 1 45); do
  curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null && break
  sleep 1
  [[ $i -eq 45 ]] && { echo "Timeout"; exit 1; }
done

echo "OK /api/health"
curl -sf "http://127.0.0.1:$PORT/api/health/desktop" -H "X-Desktop-Setup-Token: $DESKTOP_SETUP_TOKEN" | head -c 200
echo ""
curl -sf -o /dev/null -w "OK dashboard HTTP %{http_code}\n" "http://127.0.0.1:$PORT/"
curl -sf -o /dev/null -w "OK sessions HTTP %{http_code}\n" "http://127.0.0.1:$PORT/sessions"
echo "Live desktop backend test passed"
