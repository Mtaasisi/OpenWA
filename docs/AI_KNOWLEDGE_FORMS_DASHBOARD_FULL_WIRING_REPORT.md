# AI Knowledge Forms & Dashboard Full Wiring Report

## Dashboard merge locations

| Signal | Needs Attention | Hot Leads / Pipeline | Today's Work | Product Demand | AI Safety | System |
|--------|-----------------|----------------------|--------------|----------------|-----------|--------|
| Discount requests | Yes | Pipeline NEGOTIATING | Follow-up tasks | — | — | — |
| Installment requests | Yes | Pipeline + KPI | Follow-up tasks | — | — | — |
| Payment confirmation | Yes | PAYMENT_PENDING stage | Work queue | — | — | — |
| AI escalations | Yes | — | Work queue | — | Open count | — |
| Stocking reminders | Yes | — | Work queue | Merged rows | — | System alert |
| OOS installment | Via stocking + signals | — | Follow-up `out_of_stock_installment` | Product demand | — | — |

## Forms

- **Branch AI profile** — Settings → Integrations → Branch AI profile (`AiBranchProfilePanel`)
- **Payment accounts** — same panel (add/edit active/default)
- **Shop knowledge** — Settings → Shop knowledge (markdown editor + reindex)
- **Customer learning import** — Settings → Customer learning (CSV + promote FAQ)
- **Product installment** — Products → editor → Installment tab
- **Inbox AI learning** — Inbox CRM panel → AI learning section

## API endpoints (existing)

- `GET/POST /api/ai/profile/branches/:branchId`
- `GET/POST/PATCH/DELETE /api/ai/profile/.../payment-accounts`
- `GET /api/ai/signals/dashboard`
- `POST /api/ai/learning/import`, `POST .../promote-faq`
- `GET/PATCH /api/inbox/threads/crm`

## Remaining gaps

- Variant-level installment UI (product-level only)
- Full WhatsApp archive analyzer (CSV import only)
- Hebrew i18n for new dashboard/inbox keys
