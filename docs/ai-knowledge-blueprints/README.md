# AI knowledge blueprints (from zip bundle)

These files came from `ai_knowledge_md_files.zip`. They are **developer reference** docs — not injected into customer AI replies.

| File | Purpose |
|------|---------|
| `DASHBOARD_ALERT_MAPPING.md` | Maps AI signals to Control Room dashboard sections |
| `AI_CUSTOMER_LEARNING_PIPELINE.md` | WhatsApp archive → FAQ learning pipeline spec |
| `IMPLEMENTATION_REPORT_TEMPLATE.md` | Report template for rollout notes |
| `AI_KNOWLEDGE_FORMS_DASHBOARD_FULL_WIRING_REPORT_TEMPLATE.md` | Full wiring checklist template |

**Customer-facing knowledge** (seeded into `data/ai-knowledge/` on API boot) lives in `seed/ai-knowledge/`:

- `AI_REPLY_RULES.md`
- `BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md`
- `DISCOUNT_ESCALATION_RULES.md`
- `INSTALLMENT_PRODUCT_RULES.md`
- `SHOP.md` (editable shop FAQ — copied only when missing)

Bundled rule files are re-synced from seed when the repo copy changes. `SHOP.md` and `FAQ.md` are never overwritten automatically.
