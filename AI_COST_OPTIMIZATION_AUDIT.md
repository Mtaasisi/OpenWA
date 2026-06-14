# AI Cost Optimization Audit

## Summary

Centralized AI cost tracking, model routing, token/tool limits, budget guards, intent-gated auto-reply context, persistent message deduplication, and an admin Usage & Cost dashboard were added without removing existing AI features.

## AI call sites (before / after)

| File | Feature | Model routing | Tracking |
|------|---------|---------------|----------|
| `src/modules/ai/ai-chat.service.ts` | Gateway (staff chat, tools, structured) | Tier-based via `resolveModelRoute` | Usage parsed + `AiCostTrackerService` |
| `src/modules/ai/ai-inbox-agent.service.ts` | `whatsapp_auto_reply` | `cheap_fast` default, premium blocked | Via gateway `callContext` |
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Orchestration | Dedupe + cooldown + budget gates | No direct LLM |
| `src/modules/message/inbox-compose-suggestions.service.ts` | `inbox_assistant` | cheap_fast | Wired |
| `src/modules/ai-training/ai-training-suggestion.service.ts` | `training_center` | balanced | Wired |
| `src/modules/followup/followup-ai.service.ts` | `followup` | balanced | Wired |
| `src/modules/agent-actions/agent-action-llm-matcher.service.ts` | `background_job` | cheap_fast | Wired |
| `src/modules/ai/ai-staff-wa-bridge.service.ts` | staff WA | admin tier | Via `chat()` |
| `src/modules/ai/ai-embedding.service.ts` | embeddings | primary provider | Existing (embed cost separate) |

## Auto-reply triggers (unchanged flow)

1. Inbound customer message → debounce/burst (`ai-inbox-auto-reply.service.ts`)
2. Fast paths first: profile, signal, presence, greeting, product-not-found, learning knowledge
3. LLM only after gates: master switch, session, CRM gate, circuit breaker, business hours, cooldown, dedupe, budget
4. Agent: `ai-inbox-agent.service.ts` → `runAssistantWithTools` max 2 iterations

## What was fixed

- **Model**: Auto-reply uses `cheap_fast` tier; Opus/premium downgraded unless `allowPremiumModelForAutoReply`
- **Tokens**: Per-feature caps in `aiFeatureLimits` / `DEFAULT_FEATURE_LIMITS`; auto-reply ~220 max
- **Context**: Default 8 messages, max 12; CRM/catalog/RAG/memory gated by intent
- **Tools**: Customer max 2 iterations; staff max 5; duplicate tool+args guard; timeouts
- **Dedupe**: `ai_processed_inbound_messages` unique on session+message+feature
- **Cooldown**: `autoReplyCooldownSeconds` default 60
- **Budget**: Daily/monthly/auto-reply USD limits with pause + admin API
- **Logging**: `ai_usage_logs` + `ai_model_pricing` tables
- **No API keys** in usage API responses or cost logs

## New files

- `src/database/migrations/1781150000000-AddAiCostTracking.ts`
- `src/modules/ai/cost/*` (tracker, budget guard, router, context optimizer, query service)
- `src/modules/ai/entities/ai-usage-log.entity.ts`
- `src/modules/ai/entities/ai-model-pricing.entity.ts`
- `src/modules/ai/entities/ai-processed-inbound-message.entity.ts`
- `src/modules/ai/ai-usage-admin.controller.ts`
- `src/modules/ai/ai-budget-admin.controller.ts`
- `dashboard/src/components/settings/AiUsageCostPanel.tsx`

## Remaining risks

- Embedding calls are not fully cost-logged per chunk (lower volume than chat)
- Unknown models show `pricing missing` with zero cost until pricing row added
- Budget estimates use configured pricing; actual provider usage preferred when returned
