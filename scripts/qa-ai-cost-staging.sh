#!/usr/bin/env bash
# Staging / live API checks for AI cost safety (running API required).
# Maps to the Manual section of AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${OPENWA_API_URL:-http://127.0.0.1:2785}"
API_KEY="${OPENWA_API_KEY:-}"
if [[ -z "$API_KEY" && -f "$ROOT/data/.api-key" ]]; then
  API_KEY="$(cat "$ROOT/data/.api-key")"
fi
if [[ -z "$API_KEY" && -f "$ROOT/.env" ]]; then
  API_KEY="$(grep '^API_MASTER_KEY=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' || true)"
fi
API_KEY="${API_KEY:-dev-admin-key}"
VIEWER_KEY="${OPENWA_VIEWER_API_KEY:-}"
ALLOW_MANAGE="${QA_AI_COST_ALLOW_MANAGE:-0}"

auth_header=(-H "x-api-key: ${API_KEY}")
TMP="${TMPDIR:-/tmp}/openwa-ai-cost-qa"

mkdir -p "$TMP"
FAIL=0

pass() { echo "OK: $*"; }
warn() { echo "WARN: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }

fetch() {
  local path="$1"
  local out="$2"
  local code
  code=$(curl -s -o "$out" -w "%{http_code}" "${API_URL}/api${path}" "${auth_header[@]}")
  echo "$code"
}

fetch_post() {
  local path="$1"
  local out="$2"
  local code
  code=$(curl -s -o "$out" -w "%{http_code}" -X POST "${API_URL}/api${path}" "${auth_header[@]}")
  echo "$code"
}

scan_secrets() {
  local file="$1"
  local label="$2"
  if [[ ! -f "$file" ]]; then return; fi
  if grep -qiE '"(apiKey|keyHash|decryptedKey|encryptedKey)"' "$file"; then
    fail "$label response may contain API key fields"
  else
    pass "$label — no apiKey/keyHash fields in JSON"
  fi
  if grep -qE 'sk-[a-zA-Z0-9]{10,}|owa_k1_[a-zA-Z0-9]{10,}' "$file"; then
    fail "$label response may contain raw key material"
  else
    pass "$label — no raw key patterns"
  fi
}

echo "=== AI Cost Safety — staging QA ==="
echo "API: ${API_URL}"
echo "Key prefix: ${API_KEY:0:12}..."
echo ""

AUTH_OK=true

echo "--- API health ---"
if ! curl -sf "${API_URL}/api/health" >/dev/null; then
  fail "API not reachable at ${API_URL} (start server or set OPENWA_API_URL)"
  exit 1
fi
pass "/api/health"

echo ""
echo "--- Permissions ---"
code=$(fetch "/ai/cost/permissions" "$TMP/permissions.json")
if [[ "$code" == "200" ]]; then
  pass "GET /ai/cost/permissions ($code)"
  python3 - <<PY
import json, os
p = os.path.join("${TMP}", "permissions.json")
with open(p) as f:
    d = json.load(f)
perms = d.get("permissions") or []
print("  permissions:", perms)
if "ai.cost.view" in perms:
    print("  has ai.cost.view")
if "ai.cost.manage" in perms:
    print("  has ai.cost.manage")
PY
  scan_secrets "$TMP/permissions.json" "permissions"
else
  fail "GET /ai/cost/permissions ($code)"
  AUTH_OK=false
fi

if [[ -n "$VIEWER_KEY" ]]; then
  viewer_code=$(curl -s -o "$TMP/viewer-summary.json" -w "%{http_code}" \
    -H "x-api-key: ${VIEWER_KEY}" "${API_URL}/api/admin/ai-usage/summary")
  if [[ "$viewer_code" == "403" || "$viewer_code" == "401" ]]; then
    pass "viewer key denied usage summary ($viewer_code)"
  else
    warn "viewer key got $viewer_code for usage summary (expected 403 without ai.cost.view)"
  fi
fi

echo ""
echo "--- Usage dashboard APIs ---"
code=$(fetch "/admin/ai-usage/summary" "$TMP/summary.json")
if [[ "$code" == "200" ]]; then
  pass "GET /admin/ai-usage/summary"
  scan_secrets "$TMP/summary.json" "summary"
  python3 - <<PY
import json, os
p = os.path.join("${TMP}", "summary.json")
with open(p) as f:
    d = json.load(f)
usage = d.get("usage") or {}
budget = d.get("budget") or {}
print(f"  todayCostUsd: {usage.get('todayCostUsd')}")
print(f"  monthCostUsd: {usage.get('monthCostUsd')}")
print(f"  dailyUsagePercent: {budget.get('dailyUsagePercent')}")
print(f"  autoReplyPaused: {budget.get('autoReplyPaused')}")
PY
else
  fail "GET /admin/ai-usage/summary ($code) — need ai.cost.view on API key"
fi

for ep in \
  "/admin/ai-usage/daily?days=7" \
  "/admin/ai-usage/by-model" \
  "/admin/ai-usage/by-feature" \
  "/admin/ai-usage/recent?limit=5"; do
  code=$(fetch "$ep" "$TMP/ep.json")
  if [[ "$code" == "200" ]]; then
    pass "GET $ep"
  else
    warn "GET $ep ($code)"
  fi
done

code=$(fetch "/admin/ai-budget/status" "$TMP/budget.json")
if [[ "$code" == "200" ]]; then
  pass "GET /admin/ai-budget/status"
  scan_secrets "$TMP/budget.json" "budget status"
else
  fail "GET /admin/ai-budget/status ($code)"
fi

echo ""
echo "--- CSV export ---"
csv_code=$(curl -s -o "$TMP/export.csv" -w "%{http_code}" \
  "${API_URL}/api/admin/ai-usage/export.csv" "${auth_header[@]}")
if [[ "$csv_code" == "200" ]] && [[ -s "$TMP/export.csv" ]]; then
  head_line=$(head -1 "$TMP/export.csv")
  pass "CSV export ($csv_code, $(wc -c < "$TMP/export.csv") bytes)"
  echo "  header: $head_line"
  if echo "$head_line" | grep -qi apiKey; then
    fail "CSV header contains apiKey"
  fi
else
  warn "CSV export ($csv_code) — empty or failed (OK if no usage yet)"
fi

echo ""
echo "--- AI config cost defaults ---"
code=$(fetch "/settings/ai" "$TMP/ai-config.json")
if [[ "$code" == "200" ]]; then
  pass "GET /settings/ai"
  scan_secrets "$TMP/ai-config.json" "ai config"
  python3 - <<PY
import json, os
p = os.path.join("${TMP}", "ai-config.json")
with open(p) as f:
    c = json.load(f)
ctx = c.get("autoReplyContextMessages")
ctx_max = c.get("autoReplyContextMessagesMax")
checks = {
    "autoReplyModelTier": c.get("autoReplyModelTier") == "cheap_fast",
    "allowPremiumModelForAutoReply": c.get("allowPremiumModelForAutoReply") is False,
    "autoReplyContextMessages_le_5": (ctx or 99) <= 5,
    "autoReplyContextMessagesMax_le_5": (ctx_max or 99) <= 5,
    "maxCustomerToolIterations": c.get("maxCustomerToolIterations") == 2,
    "maxAdminToolIterations": c.get("maxAdminToolIterations") == 5,
    "maxAiCallsPerInboundMessage": c.get("maxAiCallsPerInboundMessage") == 2,
    "ignoreDuplicateMessageIds": c.get("ignoreDuplicateMessageIds") is not False,
}
for k, ok in checks.items():
    print(f"  {'OK' if ok else 'WARN'}: {k}")
print(f"  context: autoReplyContextMessages={ctx}, autoReplyContextMessagesMax={ctx_max}")
PY
else
  warn "GET /settings/ai ($code) — admin settings may require admin role"
fi

if [[ "$ALLOW_MANAGE" == "1" ]]; then
  echo ""
  echo "--- Manage actions (QA_AI_COST_ALLOW_MANAGE=1) ---"
  pause_code=$(fetch_post "/admin/ai-control/pause-auto-reply" "$TMP/pause.json")
  if [[ "$pause_code" == "201" || "$pause_code" == "200" ]]; then
    pass "POST pause-auto-reply ($pause_code)"
    resume_code=$(fetch_post "/admin/ai-control/resume-auto-reply" "$TMP/resume.json")
    if [[ "$resume_code" == "201" || "$resume_code" == "200" ]]; then
      pass "POST resume-auto-reply ($resume_code)"
    else
      fail "POST resume-auto-reply ($resume_code)"
    fi
  else
    fail "POST pause-auto-reply ($pause_code) — need ai.cost.manage"
  fi
else
  echo ""
  echo "Skip pause/resume (set QA_AI_COST_ALLOW_MANAGE=1 to test manage endpoints)"
fi

echo ""
echo "--- Database (optional) ---"
DB_CANDIDATES=()
if [[ -n "${OPENWA_DATA_DB:-}" ]]; then DB_CANDIDATES+=("$OPENWA_DATA_DB"); fi
if [[ -f "$ROOT/.env" ]]; then
  env_db=$(grep '^DATABASE_NAME=' "$ROOT/.env" | cut -d= -f2- | tr -d '"' || true)
  if [[ -n "$env_db" ]]; then
    if [[ -f "$ROOT/$env_db" ]]; then DB_CANDIDATES+=("$ROOT/$env_db")
    elif [[ -f "$env_db" ]]; then DB_CANDIDATES+=("$env_db")
  fi
  fi
fi
DB_CANDIDATES+=(
  "$ROOT/data/openwa.sqlite"
  "$ROOT/data/openwa.db"
  "$ROOT/openwa.sqlite"
  "$ROOT/openwa"
)
DB_FILE=""
for f in "$DB_CANDIDATES"; do
  if [[ -n "$f" && -f "$f" ]]; then DB_FILE="$f"; break; fi
done

if [[ -n "$DB_FILE" ]] && command -v sqlite3 >/dev/null 2>&1; then
  echo "DB: $DB_FILE"
  if sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='ai_usage_logs';" | grep -q ai_usage_logs; then
    pass "table ai_usage_logs exists"
    sqlite3 "$DB_FILE" <<'SQL'
SELECT '  rows today: ' || COUNT(*) FROM ai_usage_logs WHERE createdAt >= date('now');
SELECT '  max aiCallsCount (recent 20): ' || COALESCE(MAX(aiCallsCount), 0)
  FROM (SELECT aiCallsCount FROM ai_usage_logs ORDER BY createdAt DESC LIMIT 20);
SELECT '  duplicate messageIds (success): ' || COUNT(*) FROM (
  SELECT messageId FROM ai_usage_logs
  WHERE messageId IS NOT NULL AND status = 'success'
  GROUP BY messageId HAVING COUNT(*) > 1
);
SQL
  else
    warn "ai_usage_logs table missing — run migration"
  fi
  if sqlite3 "$DB_FILE" "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations';" | grep -q migrations; then
    if sqlite3 "$DB_FILE" "SELECT name FROM migrations WHERE name LIKE '%AddAiCostTracking%';" | grep -q AddAiCost; then
      pass "migration AddAiCostTracking recorded"
    else
      warn "AddAiCostTracking not in migrations table"
    fi
  fi
else
  echo "No local SQLite DB found (set OPENWA_DATA_DB for postgres/sqlite path checks)"
fi

echo ""
echo "--- Manual UI (not automated) ---"
echo "  • Send WhatsApp test message → confirm ai_usage_logs row, aiCallsCount <= 2"
echo "  • Greeting/presence fast path without LLM spend"
echo "  • Inbox compose suggestions + staff AI chat"
echo "  • Dashboard Settings → AI → Usage & Cost UI"
echo ""

if [[ "$AUTH_OK" != true ]]; then
  echo ""
  warn "API auth failed — set OPENWA_API_KEY to a valid admin key (see server boot log or data/.api-key for this instance)"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Staging QA finished with failures."
  exit 1
fi
echo "Staging QA finished — API checks passed."
