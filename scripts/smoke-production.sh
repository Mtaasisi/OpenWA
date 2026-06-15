#!/usr/bin/env bash
# Production smoke tests (run on VPS after deploy).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

API_PORT="${API_PORT:-2785}"
API_KEY="${API_MASTER_KEY:-}"
BASE="http://127.0.0.1:${API_PORT}"

check_optional() {
  local label="$1"
  local path="$2"
  echo "==> ${label}"
  local response
  response=$(curl -s -w "\n__HTTP__:%{http_code}" -H "X-API-Key: $API_KEY" "${BASE}${path}")
  local code="${response##*__HTTP__:}"
  local body="${response%__HTTP__:*}"
  if [[ "$code" == "200" ]]; then
    echo "$body" | head -c 400
    echo ""
  else
    echo "(HTTP ${code} — skipped; rebuild API if this endpoint should exist)"
    echo ""
  fi
}

if [[ -z "$API_KEY" ]]; then
  echo "API_MASTER_KEY not set in .env" >&2
  exit 1
fi

echo "==> Health"
curl -sf "$BASE/api/health" | head -c 200
echo ""

echo "==> Auth validate"
curl -sf -X POST -H "X-API-Key: $API_KEY" "$BASE/api/auth/validate" | head -c 200
echo ""

echo "==> Sessions"
curl -sf -H "X-API-Key: $API_KEY" "$BASE/api/sessions" | head -c 400
echo ""

check_optional "WhatsApp safety overview" "/api/whatsapp-safety/overview"
check_optional "WhatsApp safety settings" "/api/whatsapp-safety/settings"
check_optional "WhatsApp safety audit (recent)" "/api/whatsapp-safety/audit-logs?limit=5"

echo "==> Volume sessions dir"
docker exec openwa-api ls -la /app/data/sessions/ 2>/dev/null || echo "(container not running)"

echo "Smoke checks passed."
