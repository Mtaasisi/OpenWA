# AI Message Buffer Implementation Report

**Date:** 2026-06-15  
**Migration:** `1781160000000-AddAiCostOptimizationPhase2.ts`

## What changed

A **persistent message buffer** coalesces rapid inbound messages from the same conversation into a single batch before AI processing. This reduces duplicate LLM calls when customers send multiple short messages in succession (e.g. "Hello" → "Niko online?" → "Bei ya iPhone?").

The service (`AiMessageBufferService`) is implemented with DB persistence, configurable debounce/wait limits, and a 2-second poll loop. Configuration columns and the `ai_message_buffers` table are live after migration.

> **Integration status:** The buffer service is registered in `ai.module.ts` but **not yet wired** into `ai-inbox-auto-reply.service.ts`. Auto-reply still uses the in-memory `PendingAutoReply` burst path from `AiHumanTimingService`. Wiring `registerProcessor()` to the existing `processAutoReply` flow is the next step.

---

## Architecture (designed)

```
Inbound message
  → AiMessageBufferService.enqueue()
       ├─ find/create PENDING buffer for conversationId (sessionId:chatId)
       ├─ append messageId + text; extend scheduledProcessAt (debounce)
       └─ force flush if max messages/chars reached
  → poll every 2s: processDueBuffers()
       ├─ claim buffer (PENDING → PROCESSING)
       ├─ call registered processor(combinedText, batchId, messageIds)
       └─ mark PROCESSED or FAILED
  → single LLM call with combinedText; batchId on usage log
```

---

## Database

### `ai_message_buffers`

| Column | Purpose |
|--------|---------|
| `conversationId` | `{sessionId}:{chatId}` |
| `batchId` | UUID correlating usage logs |
| `messageIds` | JSON array of WA message IDs |
| `rawMessages` | JSON array of `{ messageId, text, receivedAt }` |
| `combinedText` | Joined customer text |
| `normalizedCombinedText` | Normalized for matching |
| `firstMessageAt` / `lastMessageAt` | Burst window |
| `scheduledProcessAt` | When poll should process |
| `status` | `pending`, `processing`, `processed`, `failed` |
| `aiUsageLogId` | Link to LLM call (when wired) |

Indexes: `conversationId`, `batchId`, `status`, `scheduledProcessAt`.

### `ai_usage_logs` extensions

- `batchId` — ties multiple inbound messages to one AI call
- `contactId` — customer attribution

---

## Files

| File | Role |
|------|------|
| `src/modules/ai/entities/ai-message-buffer.entity.ts` | Entity + status enum |
| `src/modules/ai/cost/ai-message-buffer.service.ts` | Enqueue, poll, process, claim |
| `src/modules/ai/learning/ai-text-normalizer.util.ts` | `normalizeCombinedCustomerText()` |
| `src/modules/ai/cost/ai-cost-tracker.service.ts` | Persists `batchId` on usage rows |
| `src/modules/ai/ai-inbox-agent.service.ts` | Accepts `batchId` in `CustomerAgentRunInput` |
| `src/database/migrations/1781160000000-AddAiCostOptimizationPhase2.ts` | Table + config columns |

---

## Settings (`ai_config`)

| Setting | Default | Effect |
|---------|---------|--------|
| `messageBufferEnabled` | `true` | When false, `enqueue()` throws (for callers that check) |
| `messageBufferDebounceSeconds` | `10` | Delay after last message before processing |
| `messageBufferMaxWaitSeconds` | `30` | Max time from first message in batch |
| `messageBufferMaxMessages` | `10` | Immediate flush at count |
| `messageBufferMaxCharacters` | `4000` | Immediate flush at length |
| `oneReplyPerMessageBurst` | `true` | Intended to pair with buffer for single reply |

---

## Service behavior

### Enqueue

- Creates new buffer with fresh `batchId` if no `PENDING` buffer for conversation.
- Appends to existing buffer: merges texts with `\n`, trims to `maxMessages` / `maxCharacters`.
- Reschedules `scheduledProcessAt` = min(debounce deadline, max-wait deadline).
- Immediate schedule if limits hit.

### Process

- Poll interval: **2000 ms**, batch size: **5** due buffers per tick.
- Optimistic claim via `UPDATE ... WHERE status=pending`.
- Invokes registered `BufferedMessageProcessor` with combined text.
- On success: `PROCESSED` + `processedAt`; on error: `FAILED` + error in metadata.

### Public helpers

- `findByBatchId(batchId)` — lookup for debugging
- `listRecent(limit)` — recent buffers for admin (future UI)

---

## How to test

### Unit / integration (service only)

```typescript
// After wiring in a test module:
const buffer = await messageBuffer.enqueue({
  sessionId: 'sess1',
  chatId: '2557...@c.us',
  messageId: 'msg1',
  text: 'Hello',
});
await messageBuffer.enqueue({ ... messageId: 'msg2', text: 'Bei ya iPhone?' });
// Fast-forward scheduledProcessAt or wait debounce
await messageBuffer.processDueBuffers();
// Expect processor called once with combinedText "Hello\nBei ya iPhone?"
```

### Manual (once wired to auto-reply)

1. Set `messageBufferDebounceSeconds=5` for faster testing.
2. Send 3 rapid WhatsApp messages within 5 seconds.
3. Expect **one** auto-reply after debounce, referencing combined context.
4. Check `ai_message_buffers`: one row `status=processed`, `messageIds` length 3.
5. Check `ai_usage_logs`: single LLM row with matching `batchId`.

### Manual (current state — service isolated)

1. Apply migration.
2. Use Nest REPL or temporary test endpoint to call `enqueue()` twice.
3. Manually call `registerProcessor()` with a logger callback.
4. Wait for poll or call `processDueBuffers()`.
5. Confirm buffer transitions and combined text.

---

## Wiring checklist (pending)

- [ ] Inject `AiMessageBufferService` into `AiInboxAutoReplyService`
- [ ] On `onModuleInit`, `registerProcessor()` → delegate to existing burst/process path with `batchId`
- [ ] Replace or reconcile in-memory `PendingAutoReply` to avoid double debounce
- [ ] Pass `batchId` through to `runCustomerAgent()` and `recordUsage()`
- [ ] Mark all `messageIds` in burst as processed after reply
- [ ] Admin API or dashboard panel for recent buffers (optional)

---

## Risks

| Risk | Notes |
|------|-------|
| **Not wired to auto-reply** | Primary risk — feature inactive in production flow until integrated |
| Double debounce | In-memory burst + DB buffer could stack delays if both active |
| Failed buffer stuck | Failed status retained; no automatic retry loop yet |
| Multi-instance races | Claim query mitigates; multiple API replicas should be safe |
| Long combined text | Capped at 4000 chars; may truncate mid-sentence |
| Group chats | `ignoreGroupMessages=true` should skip before enqueue when wired |

---

## Related

- `AI_COST_OPTIMIZATION_AUDIT.md`
- `AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md` — buffer QA section
