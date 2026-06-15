#!/usr/bin/env bash
# Exercise desktop-only API routes against a running smoke backend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${SMOKE_PORT:-2898}"
BASE="http://127.0.0.1:${PORT}"
TOKEN="${DESKTOP_SETUP_TOKEN:-smoke-test-token}"

if ! curl -sf "${BASE}/api/health" >/dev/null; then
  echo "Backend not running on ${BASE}. Start smoke:desktop-packaged first or set SMOKE_PORT."
  exit 1
fi

echo "Testing GET /api/health/desktop"
DESKTOP_HEALTH=$(curl -sf -H "X-Desktop-Setup-Token: ${TOKEN}" "${BASE}/api/health/desktop")
echo "$DESKTOP_HEALTH" | grep -q '"mode":"desktop"' || {
  echo "Expected desktop mode in health response"
  exit 1
}

echo "Testing POST /api/desktop/db/test (invalid URL)"
DB_FAIL=$(curl -sf -X POST -H "Content-Type: application/json" \
  -H "X-Desktop-Setup-Token: ${TOKEN}" \
  -d '{"databaseUrl":"not-a-url"}' \
  "${BASE}/api/desktop/db/test")
echo "$DB_FAIL" | grep -q '"ok":false' || {
  echo "Expected ok:false for invalid database URL"
  exit 1
}

echo "Testing POST /api/desktop/setup/seed"
curl -sf -X POST -H "Content-Type: application/json" \
  -H "X-Desktop-Setup-Token: ${TOKEN}" \
  -d '{}' \
  "${BASE}/api/desktop/setup/seed" >/dev/null

echo "Desktop API smoke test passed"
