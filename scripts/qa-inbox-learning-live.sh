#!/usr/bin/env bash
# Live QA helper for AI Learning + Product Demand (requires running API + optional WhatsApp session).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${OPENWA_API_URL:-http://127.0.0.1:2785}"
API_KEY="${OPENWA_API_KEY:-dev-admin-key}"

auth_header=(-H "x-api-key: ${API_KEY}")

echo "=== OpenWA AI Learning & Product Demand — live QA ==="
echo "API: ${API_URL}"
echo ""

fetch_json() {
  local path="$1"
  curl -sf "${API_URL}/api${path}" "${auth_header[@]}"
}

echo "--- API health ---"
if ! fetch_json "/dashboard/ai-learning-demand-alerts" >/tmp/openwa-qa-alerts.json 2>/dev/null; then
  echo "FAIL: Could not reach ${API_URL}/api/dashboard/ai-learning-demand-alerts"
  echo "Start the server (npm run start:dev) and set OPENWA_API_URL / OPENWA_API_KEY if needed."
  exit 1
fi
echo "OK: ai-learning-demand-alerts"

for path in \
  "/ai-learning/overview" \
  "/product-demand/overview" \
  "/product-demand/campaigns/metrics" \
  "/sessions"; do
  if fetch_json "$path" >/dev/null 2>&1; then
    echo "OK: ${path}"
  else
    echo "WARN: ${path} unavailable (check auth or migrations)"
  fi
done

echo ""
echo "--- Snapshot ---"
node -e "
const fs = require('fs');
const alerts = JSON.parse(fs.readFileSync('/tmp/openwa-qa-alerts.json', 'utf8'));
const l = alerts.learning ?? {};
const d = alerts.demand ?? {};
console.log('Pending learning items:', l.pendingCount ?? 0);
console.log('Urgent waiting customers:', l.urgentWaitingCustomers ?? 0);
console.log('Missing products:', d.missingProducts ?? 0);
console.log('Draft demand campaigns:', d.draftCampaignsCount ?? 0);
"

echo ""
echo "--- Manual inbox checklist (WhatsApp connected) ---"
echo "  1. Unknown product question → waiting reply + pending item in AI Learning"
echo "  2. Approve answer → similar message reuses approved knowledge"
echo "  3. Staff edit of AI reply → suggested learning item appears"
echo "  4. Product demand message → event in Product Demand tab"
echo "  5. Map missing product → alias + optional inbox send to customer"
echo "  6. Start SMS campaign from recommendation → draft on /campaigns → send"
echo ""
echo "Full checklist: AI_LEARNING_PRODUCT_DEMAND_FULL_AUDIT_REPORT.md"
echo "Automated QA:   npm run qa:ai-learning"
