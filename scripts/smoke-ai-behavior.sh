#!/usr/bin/env bash
# Runnable smoke checks for deterministic AI behavior (no live WhatsApp required).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== OpenWA AI behavior smoke tests ==="
npm run smoke:ai

echo ""
echo "=== Automated checks passed ==="
echo ""
echo "Manual live checklist (WhatsApp connected, AI enabled):"
echo "  1. Presence          → send 'Upo online now' → 'Ndiyo Boss niko online 😊' (not welcome greeting)"
echo "  2. Greeting only     → send 'Mambo' → short karibu reply, no product pitch"
echo "  3. Repeat greeting   → after welcome, send 'Hello?' → 'Nipo Boss 😊' (no full welcome again)"
echo "  4. Burst messages    → send 3 quick msgs → one combined reply after brief pause"
echo "  5. Typing realism    → typing appears before send, not during wait; longer msg = longer typing"
echo "  6. Suspicious name   → 'Jina langu ni mchele' → confirmation question before save"
echo "  7. Short context     → send 'ipo?' with no prior product → asks what you need"
echo "  8. Discount x2       → ask discount twice → AI pauses + agreed ack + inbox escalation"
echo "  9. Group message     → buying intent in group → lead/escalation only, no auto-reply"
echo " 10. OOS installment   → product with installment+OOS flag → no stock count to customer"
echo " 11. Branch location   → ask location with branch profile set → uses settings, not hardcoded"
echo " 12. Payment details   → ask payment number → uses branch payment account from settings"
echo ""
echo "Settings prep: branch AI profile, payment account, product installment tab, reindex knowledge."
echo "API default: http://127.0.0.1:2785  |  Key: dev-admin-key (see .env.example)"
