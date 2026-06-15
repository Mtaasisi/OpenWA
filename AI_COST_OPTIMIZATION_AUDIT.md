# AI Cost Optimization Audit

**Date:** 2026-06-15  
**Scope:** Phase 1 (cost tracking, budgets, model routing) + Phase 2 (learned cache, message buffer, prompt architecture, extended metrics)

## Executive summary

OpenWA now has layered AI cost controls: centralized usage logging, budget guards, tier-based model routing, intent-gated context, persistent deduplication, a learned-reply cache that skips LLM calls, a DB-backed message buffer for burst coalescing, and a modular prompt assembler with token budgets. Phase 2 migration `1781160000000` adds four new tables, extends `ai_usage_logs` and `ai_config`, and wires the learned cache into auto-reply before the agent runs.

---

## Migrations

| Migration | Name | Purpose |
|-----------|------|---------|
| `1781150000000-AddAiCostTracking.ts` | Phase 1 | `ai_usage_logs`, `ai_model_pricing`, `ai_processed_inbound_messages`, budget/model-tier columns on `ai_config` |
| `1781160000000-AddAiCostOptimizationPhase2.ts` | Phase 2 | `ai_learned_intents`, `ai_unknown_messages`, `ai_message_buffers`, `ai_conversation_facts`; usage log columns `modelTier`, `contactId`, `batchId`; 18 new `ai_config` cost/learning/buffer/prompt fields; clamps existing configs with `autoReplyContextMessages > 5` down to 3 (max 5) |

Verify:

```bash
npm run migration:show
# expect [X] AddAiCostTracking1781150000000
# expect [X] AddAiCostOptimizationPhase21811160000000
```

---

## AI call sites (files, features, models, tracking)

| File | Feature (`AiUsageFeature`) | Model tier (default) | Tracking |
|------|---------------------------|----------------------|----------|
| `src/modules/ai/ai-chat.service.ts` | Gateway for all LLM calls | Per `resolveModelRoute` | Parses provider usage → `AiCostTrackerService.recordUsage` |
| `src/modules/ai/ai-inbox-agent.service.ts` | `whatsapp_auto_reply` | `cheap_fast` (balanced only when context optimizer suggests) | Via gateway `callContext`; prompt breakdown in metadata |
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Orchestration (no direct LLM) | N/A | Records `cache_hit` for learned intents; budget/dedupe gates |
| `src/modules/message/inbox-compose-suggestions.service.ts` | `inbox_assistant` | `cheap_fast` | Wired |
| `src/modules/ai-training/ai-training-suggestion.service.ts` | `training_center` | `balanced` | Wired |
| `src/modules/followup/followup-ai.service.ts` | `followup` | `balanced` | Wired |
| `src/modules/agent-actions/agent-action-llm-matcher.service.ts` | `background_job` | `cheap_fast` | Wired |
| `src/modules/ai/ai-staff-wa-bridge.service.ts` | Staff WA (via `chat()`) | `balanced` / admin tier | Via gateway |
| `src/modules/ai/ai-embedding.service.ts` | Embeddings | Primary provider model | Existing (embed cost separate) |
| `src/modules/ai/ai-learning-inbox.service.ts` | Learning decisions | Mixed | Partial (approved-knowledge fast path) |

---

## Auto-reply trigger flow (after Phase 2)

1. **Inbound hook** — `message:received` in `ai-inbox-auto-reply.service.ts`
2. **Gates** — master switch, session, CRM gate, circuit breaker, business hours, cooldown, dedupe (`ai_processed_inbound_messages`), budget (`AiBudgetGuardService`), promotional/group/self filters
4. **Message buffer (DB)** — when `messageBufferEnabled` (default), `scheduleAutoReply` enqueues to `ai_message_buffers`; `registerProcessor()` applies human-timing wait then `processAutoReply` with `batchId`
5. **Fast paths (zero LLM)** — profile enrichment, signal service, presence, greeting, product-not-found fallback, approved learning knowledge
6. **Learned intent cache** — `AiLearnedIntentService.tryReply()` → send + log `status=cache_hit`
7. **Conversation facts** — deterministic extraction on long messages; facts summary injected by prompt assembler
8. **LLM agent** — `AiPromptAssemblerService.assemble()` → `runCustomerAgent` (max 2 tool iterations)
9. **Unknown classifier** — cheap structured call queues unknown short phrases after agent reply
10. **Outbound** — human timing, typing, send pipeline, dedupe `markBurstProcessed` on all fast paths

> **Note:** In-memory `PendingAutoReply` remains as fallback when `messageBufferEnabled=false`. DB buffer is the default path for restart-safe burst coalescing.

---

## Token waste fixes applied

### Phase 1

| Fix | Mechanism | Default |
|-----|-----------|---------|
| Cheap model for auto-reply | `resolveModelRoute` + `allowPremiumModelForAutoReply=false` | Haiku / gpt-4o-mini / flash-lite |
| Max output tokens | `DEFAULT_FEATURE_LIMITS.whatsapp_auto_reply` | 220 |
| Context window | `autoReplyContextMessages` / `Max` | Phase 1: 8 / 12 |
| Intent-gated context | `resolveContextNeeds()` in `ai-context-optimizer.util.ts` | CRM/catalog/knowledge/memory only when needed |
| Tool loop cap | `maxCustomerToolIterations` | 2 |
| AI call cap | `maxAiCallsPerInboundMessage` | 2 |
| Dedupe | `ai_processed_inbound_messages` unique constraint | Per session+message+feature |
| Cooldown | `autoReplyCooldownSeconds` | 60 |
| Budget pause | Daily/monthly/auto-reply USD limits | $1 / $20 / $0.50 |

### Phase 2

| Fix | Mechanism | Default |
|-----|-----------|---------|
| Learned reply cache | `ai_learned_intents` exact + similar (≥0.72) match | `learnedReplyCacheEnabled=true` |
| Tighter history | `resolveHistoryLimit()` — 3 simple / 5 complex intents | Migration clamps config to 3 / 5 |
| Prompt assembler | Modular blocks + rule packs; no monolithic inline prompt | — |
| Knowledge RAG cap | `buildAutoReplyKnowledgeExcerpt()` with chunk/char limits | 2 chunks, 600/chunk, 1200 total |
| Prompt token budgets | `estimateTokensFromBlocks` + `resolvePromptBudgetWarning` | 1500 auto-reply / 500 simple |
| Conversation facts | `ai_conversation_facts` summary block (replaces long history when populated) | Up to 12 facts in prompt |
| Usage attribution | `modelTier`, `contactId`, `batchId` on `ai_usage_logs` | For buffer batch correlation |
| Cache hit logging | `AiUsageStatus.CACHE_HIT`, provider `cache`, model `learned_intent` | Enables savings metrics |

---

## New / changed files (Phase 2)

### Database & entities

- `src/database/migrations/1781160000000-AddAiCostOptimizationPhase2.ts`
- `src/modules/ai/entities/ai-learned-intent.entity.ts`
- `src/modules/ai/entities/ai-unknown-message.entity.ts`
- `src/modules/ai/entities/ai-message-buffer.entity.ts`
- `src/modules/ai/entities/ai-conversation-fact.entity.ts`
- `src/modules/ai/entities/ai-usage-log.entity.ts` (extended)
- `src/modules/ai/entities/ai-config.entity.ts` (extended)

### Services

- `src/modules/ai/learning/ai-learned-intent.service.ts`
- `src/modules/ai/learning/ai-unknown-message.service.ts`
- `src/modules/ai/learning/ai-conversation-facts.service.ts`
- `src/modules/ai/cost/ai-message-buffer.service.ts`
- `src/modules/ai/prompt/ai-prompt-assembler.service.ts`
- `src/modules/ai/prompt/ai-prompt-token-estimator.util.ts`
- `src/modules/ai/prompt/ai-reply-rule-packs.ts`
- `src/modules/ai/learning/ai-text-normalizer.util.ts`
- `src/modules/ai/cost/ai-usage-query.service.ts` (extended metrics)
- `src/modules/ai/cost/ai-cost-tracker.service.ts` (modelTier/batchId/contactId)
- `src/modules/ai/cost/ai-context-optimizer.util.ts` (history limit 3/5)
- `src/modules/ai/ai-knowledge.service.ts` (`buildAutoReplyKnowledgeExcerpt`)

### Integration

- `src/modules/ai/ai-inbox-auto-reply.service.ts` — learned cache fast path + cache_hit logging
- `src/modules/ai/ai-inbox-agent.service.ts` — uses prompt assembler; logs prompt breakdown metadata
- `src/modules/ai/learning/ai-learning-cache-admin.controller.ts` — admin APIs
- `src/modules/ai/ai.module.ts` — registers all new providers/entities

### Admin API

- `GET/POST /api/admin/ai-learning/*` — cache stats, learned intents CRUD, unknown message review
- `GET /api/admin/ai-usage/summary` — extended usage metrics (cache hits, savings, prompt warnings)

---

## Settings (`ai_config` Phase 2 columns)

| Setting | Default | Purpose |
|---------|---------|---------|
| `messageBufferEnabled` | `true` | DB message buffer (wired; marks message IDs at enqueue) |
| `messageBufferDebounceSeconds` | `10` | Debounce before processing batch |
| `messageBufferMaxWaitSeconds` | `30` | Max wait from first message in batch |
| `messageBufferMaxMessages` | `10` | Force flush at message count |
| `messageBufferMaxCharacters` | `4000` | Force flush at combined length |
| `oneReplyPerMessageBurst` | `true` | Single reply per burst |
| `learnedReplyCacheEnabled` | `true` | Skip LLM when learned intent matches |
| `autoLearnSafeIntents` | `true` | Auto-promote safe intents (future hook) |
| `autoApproveConfidenceThreshold` | `90` | Auto-approve threshold |
| `pendingReviewThreshold` | `60` | Queue for human review below this |
| `disableLearningForSensitive` | `true` | Block learning on sensitive topics |
| `replyVariationRotation` | `true` | Rotate reply variations per contact |
| `ignoreGroupMessages` | `true` | Skip group chats |
| `ignoreSelfMessages` | `true` | Skip self messages |
| `autoReplyPromptBudgetTokens` | `1500` | Warn when estimated prompt exceeds |
| `autoReplySimplePromptBudgetTokens` | `500` | Stricter budget for greeting/presence |
| `knowledgeMaxChunks` | `2` | RAG chunk limit |
| `knowledgeMaxCharsPerChunk` | `600` | Per-chunk char cap |
| `knowledgeMaxTotalChars` | `1200` | Total knowledge block cap |

---

## How to test

```bash
# Automated regression (Phase 1 + core safety)
npm run qa:ai-cost-safety

# Staging API smoke (usage endpoints, budgets)
npm run qa:ai-cost-staging

# Migration check
npm run migration:show
```

**Manual — learned cache**

1. Insert an active row in `ai_learned_intents` with `normalizedPhrase` matching a test message.
2. Send that message via WhatsApp → expect instant reply, no LLM cost.
3. Check `ai_usage_logs`: `status=cache_hit`, `provider=cache`, `model=learned_intent`.
4. `GET /api/admin/ai-learning/cache-stats` — `activeCount` and `totalUsage` increment.

**Manual — prompt assembler**

1. Send a product question → check recent usage log metadata for `promptBreakdown` and `budgetWarning`.
2. Send a greeting → verify catalog/knowledge blocks absent (intent-gated).

**Manual — usage metrics**

1. `GET /api/admin/ai-usage/summary` → confirm `cacheHitCount`, `cacheHitRate`, `moneySavedByCacheUsd`, `promptBudgetWarningCount`, `averagePromptTokens`.

---

## Full AI file inventory (backend)

| Group | Key files |
|-------|-----------|
| Gateway | `ai-chat.service.ts`, `ai-chat.controller.ts`, `cost/ai-cost-tracker.service.ts`, `cost/ai-model-router.util.ts` |
| Auto-reply orchestration | `ai-inbox-auto-reply.service.ts`, `services/ai-human-timing.service.ts`, `ai-inbox-agent.service.ts` |
| Cost optimization | `cost/ai-budget-guard.service.ts`, `cost/ai-processed-message.service.ts`, `cost/ai-message-buffer.service.ts`, `cost/ai-config-cache.service.ts`, `cost/ai-usage-query.service.ts` |
| Learned cache | `learning/ai-learned-intent.service.ts`, `learning/ai-unknown-message.service.ts`, `learning/ai-intent-learning.service.ts`, `learning/ai-learned-intent-seed.service.ts`, `learning/ai-learning-cache-admin.controller.ts` |
| Prompt architecture | `prompt/ai-prompt-assembler.service.ts`, `prompt/ai-reply-rule-packs.ts`, `prompt/ai-prompt-token-estimator.util.ts`, `ai-knowledge.service.ts` |
| Conversation memory | `learning/ai-conversation-facts.service.ts`, `learning/ai-message-extraction.util.ts`, `ai-inbox-context.service.ts`, `cost/ai-context-optimizer.util.ts` |
| Training / learning (separate) | `ai-learning.service.ts`, `ai-learning-inbox.service.ts`, `ai-learning-knowledge.service.ts`, `ai-training/*` |
| RAG / embeddings | `ai-knowledge-index.service.ts`, `ai-memory-index.service.ts`, `ai-embedding.service.ts` |
| Background jobs | `followup/followup-ai.service.ts`, `agent-actions/agent-action-llm-matcher.service.ts` |
| Admin APIs | `ai-usage-admin.controller.ts`, `ai-budget-admin.controller.ts`, `cost/ai-message-buffer-admin.controller.ts` |

## Dashboard surfaces

| Panel / section | Files |
|-----------------|-------|
| Usage & cost | `dashboard/src/components/settings/AiUsageCostPanel.tsx` |
| Cost settings (A–E) | `dashboard/src/components/settings/AiCostSettingsSection.tsx` |
| Learning cache center | `dashboard/src/components/settings/AiLearningCenterPanel.tsx` |
| Nav / routing | `settings-nav-registry.ts`, `SettingsPanelsRouter.tsx` |
| API clients | `dashboard/src/services/api.ts` (`aiUsageApi`, `aiLearningCacheApi`) |

## Repeat-cost hotspots (addressed)

| Hotspot | Fix |
|---------|-----|
| Multiple `getActiveConfig()` per burst | `AiConfigCacheService` (5s TTL) in auto-reply |
| Full `AI_REPLY_RULES.md` on every call | Intent-gated rule packs + capped RAG |
| Dedupe only after agent | `markBurstProcessed` on all fast paths; enqueue marks `buffered` |
| Buffer + timing gap | Human-timing wait in buffer processor before `processAutoReply` |
| Embeddings without budget awareness | Optional skip when `aiBudgetPaused` (see `ai-embedding.service.ts`) |

---

## Remaining risks

| Risk | Severity | Notes |
|------|----------|-------|
| Similar intent false positives | Medium | 0.72 similarity threshold; admin review workflow mitigates |
| Multi-instance buffer races | Low | DB row claim + unique `batch_id`; no Redis |
| Classifier only after agent for unknown | Low | By design to avoid extra LLM on every cache miss |
| Embedding cost tracking | Low | Lower volume than chat; budget gate is soft skip |
| Unknown models show zero cost | Low | Until pricing row added in `ai_model_pricing` |

---

## Related reports

- `AI_LEARNING_CACHE_IMPLEMENTATION_REPORT.md`
- `AI_MESSAGE_BUFFER_IMPLEMENTATION_REPORT.md`
- `AI_PROMPT_ARCHITECTURE_REFACTOR_REPORT.md`
- `AI_USAGE_DASHBOARD_IMPLEMENTATION_REPORT.md`
- `AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md`
