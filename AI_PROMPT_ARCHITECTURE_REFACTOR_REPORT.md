# AI Prompt Architecture Refactor Report

**Date:** 2026-06-15  
**Migration:** `1781160000000-AddAiCostOptimizationPhase2.ts` (prompt budget + knowledge cap settings)

## What changed

Auto-reply prompt construction was extracted from inline logic in `ai-inbox-agent.service.ts` into a dedicated **`AiPromptAssemblerService`**. Prompts are now assembled from modular, intent-aware blocks with explicit token estimation and budget warnings. Rule packs replace ad-hoc inline instructions, and knowledge RAG is capped for auto-reply.

The agent service now calls `promptAssembler.assemble()` and passes `promptBreakdown` / `budgetWarning` metadata into usage logs for observability.

---

## Before / after

| Aspect | Before | After |
|--------|--------|-------|
| Prompt building | Inline in agent service | `AiPromptAssemblerService.assemble()` |
| Rules | Mixed inline strings | `buildRulesBlock()` from `ai-reply-rule-packs.ts` |
| Context gating | Partial | `resolveContextNeeds()` + assembler respects flags |
| History depth | Fixed config values | `resolveHistoryLimit()` — 3 (simple) / 5 (complex) |
| Knowledge RAG | Full excerpt possible | `buildAutoReplyKnowledgeExcerpt()` with chunk/char caps |
| Token visibility | None | `estimateTokensFromBlocks()` per section |
| Budget warnings | None | `resolvePromptBudgetWarning()` logged in metadata |
| Conversation memory | History only | + `AiConversationFactsService.buildFactsSummaryBlock()` |

---

## Prompt block order

Assembled `systemContent` joins (in order):

1. Base assistant identity + tone
2. **Rule pack** — core rules + intent-specific pack (greeting, product, price, location, etc.)
3. Tool rules (search_products, escalate_to_human, etc.)
4. Unrestricted mode prompt (when enabled)
5. CRM block (intent-gated)
6. Context summary
7. **Conversation facts** (compact older context)
8. Catalog block (intent-gated)
9. Injected prompt block / profile question hint
10. Knowledge excerpt (capped RAG)
11. Memory excerpt (intent-gated)
12. Custom auto-reply prompt / preset

Thread messages built separately via `AiInboxContextService.buildThread()` with intent-based history limit.

---

## Files

| File | Role |
|------|------|
| `src/modules/ai/prompt/ai-prompt-assembler.service.ts` | Main assembler |
| `src/modules/ai/prompt/ai-prompt-token-estimator.util.ts` | Token estimates + budget warnings |
| `src/modules/ai/prompt/ai-reply-rule-packs.ts` | Core + intent rule packs |
| `src/modules/ai/cost/ai-context-optimizer.util.ts` | `resolveContextNeeds`, `resolveHistoryLimit` |
| `src/modules/ai/learning/ai-conversation-facts.service.ts` | Facts summary block |
| `src/modules/ai/ai-knowledge.service.ts` | `buildAutoReplyKnowledgeExcerpt()` |
| `src/modules/ai/ai-inbox-agent.service.ts` | Consumer; logs metadata |
| `src/modules/ai/ai-inbox-agent.service.spec.ts` | Mocks prompt assembler |
| `src/modules/ai/cost/ai-usage-query.service.ts` | `promptBudgetWarningCount`, token averages |

---

## Rule packs (`ai-reply-rule-packs.ts`)

| Pack ID | Trigger intents / conditions |
|---------|------------------------------|
| `CORE_AI_REPLY_RULES` | Always (~300 token budget target) |
| `GREETING` | Greeting, presence |
| `NAME_CORRECTION` | Name correction patterns |
| `PRODUCT_QUESTION` | Product search, stock, variant |
| `PRICE_AVAILABILITY` | Price, discount, quote |
| `LOCATION` | Location requests |
| `DELIVERY` | Delivery requests |
| `INSTALLMENT` | Installment requests |
| `REPAIR` | Repair requests |
| `COMPLAINT_ESCALATION` | Complaints |
| `HUMAN_HANDOVER` | Escalation / unknown |

`buildRulesBlock(intent, incomingText)` selects packs based on detected intent.

---

## Token estimation

`estimateTokensFromBlocks()` uses **chars ÷ 4** heuristic per section:

- `rules_tokens`, `knowledge_tokens`, `history_tokens`, `crm_tokens`, `catalog_tokens`, `memory_tokens`, `customer_message_tokens`
- `total_estimated_input_tokens` — sum

`resolvePromptBudgetWarning()` returns:

- `simple_exceeded` — greeting/presence intent over `autoReplySimplePromptBudgetTokens` (default **500**)
- `auto_reply_exceeded` — any intent over `autoReplyPromptBudgetTokens` (default **1500**)
- `null` — within budget

Warnings are stored in usage log metadata (`budgetWarning`) for dashboard aggregation.

---

## Settings (`ai_config`)

| Setting | Default | Effect |
|---------|---------|--------|
| `autoReplyPromptBudgetTokens` | `1500` | Full auto-reply prompt budget |
| `autoReplySimplePromptBudgetTokens` | `500` | Greeting/presence budget |
| `knowledgeMaxChunks` | `2` | Max RAG chunks in prompt |
| `knowledgeMaxCharsPerChunk` | `600` | Per-chunk truncation |
| `knowledgeMaxTotalChars` | `1200` | Total knowledge block size |
| `autoReplyContextMessages` | clamped to **3** by migration if was >5 | Recent thread depth |
| `autoReplyContextMessagesMax` | clamped to **5** | Hard cap |
| `includeCrmWhenNeeded` | `true` | CRM block gating |
| `includeKnowledgeWhenNeeded` | `true` | Knowledge block gating |
| `includeCatalogWhenNeeded` | `true` | Catalog block gating |
| `includeMemoryWhenNeeded` | `true` | Memory block gating |

---

## Agent integration

```typescript
// ai-inbox-agent.service.ts (simplified)
const assembled = await this.promptAssembler.assemble({ sessionId, chatId, incomingText, branchId, intent, ... });

const result = await this.aiChat.runAssistantWithTools({
  systemContent: assembled.systemContent,
  thread: assembled.thread,
  callContext: {
    metadata: {
      promptBreakdown: assembled.breakdown,
      budgetWarning: assembled.budgetWarning,
      historyLimit: assembled.historyLimit,
      intent: assembled.intent,
    },
  },
});
```

Model tier still chosen by `resolveContextNeeds().suggestedTier` (cheap_fast default; balanced for complex intents).

---

## How to test

### Automated

```bash
npm run test -- --testPathPatterns=ai-inbox-agent
npm run qa:ai-cost-safety
```

### Manual — intent gating

1. Send pure greeting ("Mambo") → inspect usage log metadata: low `catalog_tokens`, `knowledge_tokens` near 0.
2. Send product question ("Bei ya MacBook") → metadata shows catalog/knowledge tokens > 0.

### Manual — budget warning

1. Temporarily lower `autoReplyPromptBudgetTokens` to `200` in `ai_config`.
2. Send complex product thread → check recent usage: metadata `budgetWarning=auto_reply_exceeded`.
3. `GET /api/admin/ai-usage/summary` → `promptBudgetWarningCount` > 0.

### Manual — history limit

1. Long thread with 10+ messages.
2. Simple greeting should include ~3 history messages in breakdown.
3. Product question should include up to ~5.

### Manual — knowledge cap

1. Enable knowledge RAG with large FAQ index.
2. Send policy question → knowledge block in logs should not exceed ~1200 chars / 2 chunks.

---

## Risks

| Risk | Notes |
|------|-------|
| Char÷4 token estimate imprecise | Useful for trends, not billing; provider tokens authoritative |
| History clamp (3/5) may lose context | Conversation facts block mitigates when populated |
| Rule pack overlap | Multiple packs can stack on complex intents — monitor token breakdown |
| Facts block empty initially | No automatic fact extraction wired yet |
| Budget warning only logged | Does not block LLM call — observability only |
| Migration reduces context for existing installs | Configs with context >5 clamped to 3/5 |

---

## Related

- `AI_COST_OPTIMIZATION_AUDIT.md`
- `AI_USAGE_DASHBOARD_IMPLEMENTATION_REPORT.md` — prompt metrics in summary API
- `AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md` — prompt QA section
