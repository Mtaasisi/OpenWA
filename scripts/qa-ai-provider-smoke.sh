#!/usr/bin/env bash
# Smoke test: AI provider connection + optional auto-reply preview + usage log row.
# Requires a running API and a valid provider API key in Settings → AI.
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

RUN_PREVIEW="${QA_AI_SMOKE_PREVIEW:-1}"
SAMPLE_MSG="${QA_AI_SMOKE_SAMPLE:-Mambo Boss}"

auth=(-H "x-api-key: ${API_KEY}" -H "Content-Type: application/json")
TMP="${TMPDIR:-/tmp}/openwa-ai-provider-smoke"
mkdir -p "$TMP"
FAIL=0

pass() { echo "OK: $*"; }
fail() { echo "FAIL: $*"; FAIL=1; }
warn() { echo "WARN: $*"; }

echo "=== AI provider smoke (${API_URL}) ==="

code=$(curl -s -o "$TMP/test.json" -w "%{http_code}" -X POST \
  "${API_URL}/api/settings/ai/test" "${auth[@]}")
if [[ "$code" != "201" && "$code" != "200" ]]; then
  fail "POST /settings/ai/test ($code)"
  if [[ -f "$TMP/test.json" ]]; then cat "$TMP/test.json"; echo; fi
else
  ok=$(python3 -c "import json; d=json.load(open('$TMP/test.json')); print(d.get('ok', False))" 2>/dev/null || echo false)
  latency=$(python3 -c "import json; d=json.load(open('$TMP/test.json')); print(d.get('latencyMs', ''))" 2>/dev/null || echo "")
  err=$(python3 -c "import json; d=json.load(open('$TMP/test.json')); print(d.get('error',''))" 2>/dev/null || echo "")
  if [[ "$ok" == "True" ]]; then
    pass "provider test (latency ${latency}ms)"
  else
    fail "provider test returned ok=false — ${err}"
  fi
fi

if [[ "$RUN_PREVIEW" == "1" ]]; then
  preview_body=$(python3 -c "import json; print(json.dumps({'sampleMessage': '''$SAMPLE_MSG'''}))")
  code=$(curl -s -o "$TMP/preview.json" -w "%{http_code}" -X POST \
    "${API_URL}/api/settings/ai/auto-reply/preview" "${auth[@]}" -d "$preview_body")
  if [[ "$code" != "201" && "$code" != "200" ]]; then
    warn "POST auto-reply/preview ($code) — legacy preview path may differ from inbox agent"
  else
    ok=$(python3 -c "import json; d=json.load(open('$TMP/preview.json')); print(d.get('ok', False))" 2>/dev/null || echo false)
    if [[ "$ok" == "True" ]]; then
      pass "auto-reply preview"
    else
      err=$(python3 -c "import json; d=json.load(open('$TMP/preview.json')); print(d.get('error',''))" 2>/dev/null || echo "")
      warn "auto-reply preview failed — ${err}"
    fi
  fi
fi

code=$(curl -s -o "$TMP/recent.json" -w "%{http_code}" \
  "${API_URL}/api/admin/ai-usage/recent?limit=5" "${auth[@]}")
if [[ "$code" == "200" ]]; then
  python3 - <<PY
import json
with open("$TMP/recent.json") as f:
    data = json.load(f)
rows = data.get("items") if isinstance(data, dict) else data
if not rows:
    print("WARN: no ai_usage_logs rows yet")
else:
    r = rows[0]
    print(
        f"OK: latest usage — feature={r.get('feature')} model={r.get('model')} "
        f"status={r.get('status')} in={r.get('inputTokens')} out={r.get('outputTokens')}"
    )
    if r.get("status") != "success":
        err = r.get("errorMessage") or r.get("metadata")
        print(f"WARN: latest row not success — error={err}")
PY
else
  warn "GET /admin/ai-usage/recent ($code) — need ai.cost.view permission"
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "Smoke finished — provider reachable."
  exit 0
else
  echo "Smoke finished with failures. If Anthropic quota is exhausted, switch provider or wait for limit reset."
  exit 1
fi
