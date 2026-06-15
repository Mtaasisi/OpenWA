#!/usr/bin/env bash
# Poll until a WhatsApp session is connected, then run profiling API checks.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${OPENWA_API_URL:-http://127.0.0.1:2785}"
API_KEY="${OPENWA_API_KEY:-$(cat "$ROOT/data/.api-key" 2>/dev/null || echo dev-admin-key)}"
SESSION_NAME="${OPENWA_SESSION_NAME:-voda}"
MAX_WAIT_SEC="${OPENWA_CONNECT_WAIT_SEC:-300}"
POLL_SEC="${OPENWA_CONNECT_POLL_SEC:-5}"

auth=(-H "x-api-key: ${API_KEY}")

echo "=== Wait for WhatsApp connect (${SESSION_NAME}) ==="
echo "API: ${API_URL}  (max ${MAX_WAIT_SEC}s)"
echo ""

deadline=$(( $(date +%s) + MAX_WAIT_SEC ))
connected=false

while [[ $(date +%s) -lt $deadline ]]; do
  if ! curl -sf "${API_URL}/api/health" >/dev/null; then
    echo "WARN: API not reachable"
    sleep "$POLL_SEC"
    continue
  fi

  status=$(curl -sf "${API_URL}/api/sessions" "${auth[@]}" | python3 -c "
import sys, json
name = '${SESSION_NAME}'
for s in json.load(sys.stdin):
    if s.get('name') == name:
        print(s.get('status',''))
        break
" 2>/dev/null || true)

  phone=$(curl -sf "${API_URL}/api/sessions" "${auth[@]}" | python3 -c "
import sys, json
name = '${SESSION_NAME}'
for s in json.load(sys.stdin):
    if s.get('name') == name:
        print(s.get('phone') or '')
        break
" 2>/dev/null || true)

  echo "$(date -u +%H:%M:%S) status=${status:-unknown} phone=${phone:-—}"

  if [[ "$status" == "connected" ]]; then
    connected=true
    break
  fi
  sleep "$POLL_SEC"
done

if [[ "$connected" != true ]]; then
  echo ""
  echo "TIMEOUT: session '${SESSION_NAME}' not connected. Scan QR at Channels, then re-run."
  exit 1
fi

echo ""
echo "CONNECTED — running profiling QA..."
OPENWA_API_URL="$API_URL" OPENWA_API_KEY="$API_KEY" "$ROOT/scripts/qa-profiling-live.sh"
