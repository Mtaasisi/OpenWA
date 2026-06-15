#!/usr/bin/env bash
# Live QA for Smart Progressive Customer Profiling (running API required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${OPENWA_API_URL:-http://127.0.0.1:2785}"
API_KEY="${OPENWA_API_KEY:-$(cat data/.api-key 2>/dev/null || echo dev-admin-key)}"

auth_header=(-H "x-api-key: ${API_KEY}")

echo "=== Smart Progressive Customer Profiling — live QA ==="
echo "API: ${API_URL}"
echo ""

fetch_json() {
  local path="$1"
  curl -sf "${API_URL}/api${path}" "${auth_header[@]}"
}

echo "--- API health ---"
if ! curl -sf "${API_URL}/api/health" >/dev/null; then
  echo "FAIL: API not reachable at ${API_URL}"
  exit 1
fi
echo "OK: /api/health"

API_OK=true
if ! fetch_json "/dashboard/ai-learning-demand-alerts" >/tmp/openwa-profiling-alerts.json 2>/dev/null; then
  echo "WARN: Auth failed — set OPENWA_API_KEY (local: data/.api-key; Docker: instance key)"
  API_OK=false
else
  echo "OK: ai-learning-demand-alerts"
  python3 - <<'PY'
import json
with open("/tmp/openwa-profiling-alerts.json") as f:
    d = json.load(f)
print("  profile counts:", json.dumps(d.get("profile"), indent=2))
PY
fi

if [[ "$API_OK" == true ]]; then
for path in \
  "/settings/ai" \
  "/lost-demand-followups?status=open" \
  "/customers/profile-enrichment?sessionId=demo&chatId=demo@c.us"; do
  if fetch_json "$path" >/tmp/openwa-profiling-check.json 2>&1; then
    echo "OK: ${path}"
    if [[ "$path" == *settings/ai* ]]; then
      python3 -c "import json; d=json.load(open('/tmp/openwa-profiling-check.json')); print('  progressiveProfilingEnabled:', d.get('progressiveProfilingEnabled'))"
    fi
  else
    echo "WARN: ${path} — $(head -c 120 /tmp/openwa-profiling-check.json 2>/dev/null || echo unavailable)"
  fi
done
fi

DB_FILE="${OPENWA_DATA_DB:-$ROOT/openwa}"
if [[ -f "$DB_FILE" ]]; then
  echo ""
  echo "--- SQLite schema (${DB_FILE}) ---"
  sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('customer_profile_enrichment','customer_profile_learning_events','lost_demand_followups');" \
    | while read -r t; do echo "OK: table $t"; done
  sqlite3 "$DB_FILE" "PRAGMA table_info(ai_config);" | grep -q progressiveProfilingEnabled && echo "OK: ai_config.progressiveProfilingEnabled column"
fi

echo ""
echo "Manual UI checks (dashboard):"
echo "  1. Settings → AI → Smart Progressive Profiling toggle saves"
echo "  2. Inbox CRM → AI Profile Learning panel on a chat"
echo "  3. Follow-ups → Waiting stock / lost demand section"
echo "  4. Dashboard → Needs Attention when profile counts > 0"
echo "Done."
