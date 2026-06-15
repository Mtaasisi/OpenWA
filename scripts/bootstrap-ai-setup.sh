#!/usr/bin/env bash
# One-shot AI bootstrap: smoke tests, branch profile seed (API), knowledge reindex.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

API_URL="${OPENWA_API_URL:-http://127.0.0.1:2785}"
API_KEY="${OPENWA_API_KEY:-dev-admin-key}"

echo "=== 1/4 Automated behavior tests ==="
npm run smoke:ai

echo ""
echo "=== 2/4 Branch profiles (offline DB seed if empty) ==="
npm run seed:ai-profiles

echo ""
echo "=== 3/4 API bootstrap (skip if server down) ==="
if curl -sf "${API_URL}/api/health" >/dev/null 2>&1; then
  echo "API up — seed-defaults + reindex knowledge"
  curl -sf -X POST -H "x-api-key: ${API_KEY}" "${API_URL}/api/ai/profile/seed-defaults" | head -c 500
  echo ""
  if [ -n "${OPENWA_MPESA_LIPA_NUMBER:-}" ]; then
    curl -sf -X POST -H "x-api-key: ${API_KEY}" \
      "${API_URL}/api/ai/profile/branches/dar/seed-payment-from-env" | head -c 200
    echo ""
  fi
  curl -sf -X POST -H "x-api-key: ${API_KEY}" \
    "${API_URL}/api/ai/signals/backfill-assignees" | head -c 120
  echo ""
  curl -sf -X POST -H "x-api-key: ${API_KEY}" "${API_URL}/api/ai/knowledge/reindex" | head -c 200
  echo ""
  CHUNKS=$(curl -sf -H "x-api-key: ${API_KEY}" "${API_URL}/api/ai/knowledge/index-status" | grep -o '"chunks":[0-9]*' || true)
  echo "Knowledge index: ${CHUNKS:-unknown}"
else
  echo "API not running at ${API_URL} — start with: npm run dev"
  echo "Then run: curl -X POST -H \"x-api-key: ${API_KEY}\" ${API_URL}/api/ai/profile/seed-defaults"
  echo "      curl -X POST -H \"x-api-key: ${API_KEY}\" ${API_URL}/api/ai/knowledge/reindex"
fi

echo ""
echo "=== 4/4 Setup status + live WhatsApp checklist ==="
if curl -sf "${API_URL}/api/health" >/dev/null 2>&1; then
  SETUP=$(curl -sf -H "x-api-key: ${API_KEY}" "${API_URL}/api/settings/ai/status" || true)
  if [ -n "$SETUP" ]; then
    echo "$SETUP" | grep -o '"ready":[^,]*' || true
    echo "$SETUP" | grep -o '"completed":[0-9]*' || true
    echo "$SETUP" | grep -o '"total":[0-9]*' || true
    echo "$SETUP" | grep -o '"id":"paymentAccount"[^}]*' || true
  fi
  SIGNALS=$(curl -sf -H "x-api-key: ${API_KEY}" "${API_URL}/api/ai/signals/dashboard" || true)
  if [ -n "$SIGNALS" ]; then
    echo "$SIGNALS" | grep -o '"openEscalations":[0-9]*' || true
    echo "$SIGNALS" | grep -o '"stockingReminders":[0-9]*' || true
  fi
fi
echo ""
echo "Dashboard (Settings → Integrations):"
echo "  [ ] AI setup checklist — all 7 green (payment account is usually last)"
echo "  [ ] Shop knowledge — 6 files indexed (SHOP.md, FAQ.md, 4 rules)"
echo "  [ ] Branch AI profile — Dar location + active M-Pesa/lipa namba (or OPENWA_MPESA_LIPA_NUMBER in .env)"
echo "  [ ] AI integration — API key set, engine ON, auto-reply ON"
echo "  [ ] Products — installment + stocking reminder on OOS variants"
echo ""
echo "Live WhatsApp (private chat, connected session):"
echo "  [ ] Mambo          → greeting only, no product push"
echo "  [ ] iPhone ipo?    → price/variant, NO stock count shown"
echo "  [ ] Punguzo bei    → ack; send again → AI pauses + follow-up task"
echo "  [ ] Nitumie lipa namba → payment from branch settings"
echo "  [ ] Mko wapi?      → location from branch profile (not hardcoded)"
echo "  [ ] OOS installment → deposit policy + internal stocking reminder"
echo "  [ ] Group message  → lead detection only, NO auto-reply"
echo ""
echo "Done."
