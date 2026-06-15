# AI Knowledge Integration — Implementation Report

## Summary

Completed the agreed AI Knowledge, Customer Learning, Branch Profile, Payment Settings, Product Installment, Discount Escalation, and Dashboard Alert wiring on top of existing OpenWA infrastructure.

## Database

- Existing migration: `1780830000000-AddAiPhase2Infrastructure.ts` (branch profiles, payment accounts, CRM AI fields, product installment, escalations, stocking reminders, reply events).
- New migration: `1780840000000-AddStockingReminderReason.ts` (`stocking_reminders.reason`).

## Backend

| Area | Files |
|------|-------|
| Behavior engine | `src/modules/ai/utils/ai-behavior.util.ts`, `ai-intent-detector.util.ts` |
| Signals + follow-up tasks | `src/modules/ai/ai-signal.service.ts` |
| Auto-reply orchestration | `src/modules/ai/ai-inbox-auto-reply.service.ts` |
| Agent context | `src/modules/ai/ai-inbox-context.service.ts`, `ai-inbox-agent.service.ts` |
| Stock redaction | `src/modules/products/products.service.ts`, `ai-customer-tools.service.ts` |
| CRM AI fields API | `src/modules/message/dto/inbox-thread-crm.dto.ts`, `inbox-crm.service.ts` |

## Dashboard

- Alert/KPI wiring: `dashboard/src/lib/dashboard-metrics.ts`, `dashboard/src/hooks/useDashboardData.ts`
- Branch profile UI: `dashboard/src/components/settings/AiBranchProfilePanel.tsx`
- Product installment UI: `dashboard/src/components/ProductEditorModal.tsx`
- Inbox AI learning: `dashboard/src/components/InboxCrmAiLearningPanel.tsx`

## Knowledge files

- Customer-facing: `seed/ai-knowledge/*.md` (synced on boot)
- Blueprints: `docs/ai-knowledge-blueprints/*.md`

## Tests

- `src/modules/ai/utils/ai-behavior.util.spec.ts`

## Manual review

1. Configure branch profiles + payment accounts per branch (Settings → Branch AI profile).
2. Restart API and reindex shop knowledge.
3. Smoke-test: greeting-only, discount x2, group lead, installment OOS product.
