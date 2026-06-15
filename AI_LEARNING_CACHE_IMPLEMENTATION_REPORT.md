# AI Learning Cache Implementation Report

**Date:** 2026-06-15  
**Migration:** `1781160000000-AddAiCostOptimizationPhase2.ts`

## What changed

A persistent **learned intent reply cache** lets auto-reply answer repeated customer phrases without calling the LLM. Matching phrases are stored in `ai_learned_intents`; unknown phrases queue in `ai_unknown_messages` for operator review. The cache is checked in `ai-inbox-auto-reply.service.ts` after fast paths (greeting, presence, product-not-found) and before the LLM agent.

Successful cache hits log `ai_usage_logs` rows with `status=cache_hit`, enabling cost-savings metrics on the usage dashboard API.

---

## Architecture

```
Inbound message
  → fast paths (greeting, signal, etc.)
  → AiLearnedIntentService.tryReply()
       ├─ exact match on normalizedPhrase
       └─ similar match (questionSimilarity ≥ 0.72)
  → on hit: send reply + recordUsage(CACHE_HIT)
  → on miss: continue to learning inbox / LLM agent
```

---

## Database

### `ai_learned_intents`

Stores approved phrase → intent → reply mappings.

Key columns: `phrase`, `normalizedPhrase`, `intent`, `suggestedReply`, `replyVariations`, `matchType`, `status`, `usageCount`, `lastUsedAt`, `branchId`, provenance (`createdFromMessageId`, `approvedBy`).

Indexes: `normalizedPhrase`, `intent`, `status`, `branchId`, `usageCount`, `lastUsedAt`.

Statuses: `active`, `pending_review`, `disabled`, `rejected`.

### `ai_unknown_messages`

Queues phrases the system could not confidently cache.

Key columns: `rawText`, `normalizedText`, `detectedIntent`, `aiSuggestedMeaning`, `aiSuggestedReply`, `confidence`, `frequencyCount`, `status`.

Statuses: `pending_review`, `approved`, `rejected`, `ignored`.

---

## Files

| File | Role |
|------|------|
| `src/modules/ai/entities/ai-learned-intent.entity.ts` | Entity |
| `src/modules/ai/entities/ai-unknown-message.entity.ts` | Entity |
| `src/modules/ai/learning/ai-learned-intent.service.ts` | Match, variation pick, usage stats |
| `src/modules/ai/learning/ai-unknown-message.service.ts` | Upsert pending unknowns, list/review |
| `src/modules/ai/learning/ai-text-normalizer.util.ts` | Text normalization for matching |
| `src/modules/ai/learning/ai-learning-cache-admin.controller.ts` | Admin REST API |
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Wired cache check + CACHE_HIT logging |
| `src/modules/ai/cost/ai-cost.types.ts` | `AiUsageStatus.CACHE_HIT` |
| `src/modules/ai/cost/ai-usage-query.service.ts` | Cache hit metrics in summary |

---

## Settings (`ai_config`)

| Setting | Default | Effect |
|---------|---------|--------|
| `learnedReplyCacheEnabled` | `true` | Master switch for `tryReply()` |
| `replyVariationRotation` | `true` | Rotate among `suggestedReply` + `replyVariations` |
| `autoLearnSafeIntents` | `true` | Reserved for auto-promotion of safe intents |
| `autoApproveConfidenceThreshold` | `90` | Auto-approve threshold (future) |
| `pendingReviewThreshold` | `60` | Below this → `ai_unknown_messages` |
| `disableLearningForSensitive` | `true` | Block learning on sensitive topics |

---

## Admin API

Base: `/api/admin/ai-learning`  
Permissions: `ai.learning.view` (read), `ai.learning.manage` (approve/reject/disable)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cache-stats` | Active count, total usage, top intents |
| GET | `/learned-intents` | List active intents |
| GET | `/learned-intents/:id` | Single intent |
| POST | `/learned-intents/:id/approve` | Activate intent |
| POST | `/learned-intents/:id/disable` | Disable intent |
| POST | `/learned-intents/:id/reject` | Reject intent |
| GET | `/unknown-messages` | Pending review queue |
| GET | `/unknown-messages/:id` | Single unknown |
| POST | `/unknown-messages/:id/approve` | Approve + optionally create learned intent |
| POST | `/unknown-messages/:id/reject` | Reject |
| POST | `/unknown-messages/:id/ignore` | Ignore |

---

## Matching logic

1. Normalize inbound text via `normalizeCustomerText()`.
2. Query `active` intents where `normalizedPhrase` equals (branch-scoped if `branchId` set).
3. If no exact match, scan top 120 active intents with `questionSimilarity()` ≥ **0.72**.
4. Pick reply from `suggestedReply` + `replyVariations`; rotate by contact hash when enabled.
5. Increment `usageCount` and set `lastUsedAt` asynchronously.

---

## How to test

### Automated

```bash
npm run qa:ai-cost-safety
```

### Manual — cache hit

1. Apply migration `1781160000000`.
2. Insert test intent:

```sql
INSERT INTO ai_learned_intents (id, phrase, "normalizedPhrase", intent, "suggestedReply", status)
VALUES (gen_random_uuid(), 'Bei ya iPhone 15', 'bei ya iphone 15', 'price_request', 'Boss iPhone 15 inaanza Tsh ...', 'active');
```

3. Send "Bei ya iPhone 15" from WhatsApp test contact.
4. Verify: instant reply, no LLM row with tokens > 0; one row with `status=cache_hit`.
5. `GET /api/admin/ai-learning/cache-stats` — usage count increases.

### Manual — admin approve flow

1. Insert pending unknown (or use API once auto-capture is wired).
2. `POST /api/admin/ai-learning/unknown-messages/:id/approve` with `{ "reply": "...", "intent": "greeting" }`.
3. Confirm new row in `ai_learned_intents` with `status=active`.
4. Resend phrase → cache hit.

### Manual — disable cache

1. Set `learnedReplyCacheEnabled=false` in `ai_config`.
2. Same phrase should now route to LLM agent.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Stale/wrong cached reply | Admin disable/reject; branch scoping; review queue |
| Similar-match false positive | Tune `SIMILAR_MATCH_MIN` (0.72); prefer exact matches |
| Cache bypasses signal/escalation logic | Cache runs after signal fast path; escalations still handled upstream |
| No UI panel yet | Use admin API or direct DB for now |
| Auto-capture from agent not wired | `upsert()` on unknown messages pending; manual seed + approve works |
| Variation rotation predictability | Hash uses contactId + usageCount — acceptable for non-security use |

---

## Related

- `AI_COST_OPTIMIZATION_AUDIT.md` — full cost audit
- `AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md` — QA steps for cache section
