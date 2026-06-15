# AI Cost Safety QA Checklist

Run automated regression checks first:

```bash
npm run qa:ai-cost-safety
```

Staging / live API checks (server must be running):

```bash
# default: http://127.0.0.1:2785, key from data/.api-key or dev-admin-key
npm run qa:ai-cost-staging

# optional: test pause/resume (will briefly pause auto-reply)
QA_AI_COST_ALLOW_MANAGE=1 npm run qa:ai-cost-staging

# optional: verify viewer key is denied
OPENWA_VIEWER_API_KEY=owa_k1_... npm run qa:ai-cost-staging
```

Migrations must be applied (`npm run migration:show`):

- `[X] AddAiCostTracking1781150000000` (Phase 1)
- `[X] AddAiCostOptimizationPhase21811160000000` (Phase 2 — cache, buffer, prompt)

---

## Automated (covered by `ai-cost-safety` Jest suite)

- [x] Auto-reply uses cheap model tier by default (mini / Haiku / flash-lite)
- [x] Claude Opus blocked for auto-reply unless `allowPremiumModelForAutoReply` enabled
- [x] Auto-reply max tokens clamped to 220 (not 4096)
- [x] Config defaults: max 2 customer tool loops, 5 admin tool loops, 2 AI calls per inbound message
- [x] Context default 8 messages (cap 12) — Phase 1 baseline in tests; Phase 2 migration may clamp DB to 3/5
- [x] Budget exceeded blocks auto-reply and sets `autoReplyPaused`
- [x] Usage log schema has no raw API key fields

---

## Manual (staging / production) — core cost safety

- [ ] One inbound message does not exceed 2 AI round-trips (check `aiCallsCount` in `ai_usage_logs`)
- [ ] Duplicate inbound message ID does not create duplicate successful usage log
- [ ] Dashboard today/month totals match DB (`ai_usage_logs` sums)
- [ ] CSV export downloads and opens correctly
- [ ] Budget settings save via dashboard (requires `ai.cost.manage`)
- [ ] No API key in frontend network responses for usage endpoints
- [ ] No full prompts or API keys in server logs (only feature, model, tokens, cost)
- [ ] Greeting/presence fast paths still work without LLM spend
- [ ] Inbox compose suggestions still work (inbox assistant tier)
- [ ] Staff AI chat still works (admin tier, 5 tool iterations max)
- [ ] Promotional/spam inbound skipped when `ignorePromotionalMessages` is on
- [ ] Operator with `ai.cost.view` sees dashboard; without manage cannot pause or edit budgets

---

## Manual — learned reply cache

- [ ] Migration Phase 2 applied; `ai_learned_intents` table exists
- [ ] Seed one `active` learned intent matching a test phrase (normalized)
- [ ] Send matching WhatsApp message → reply sent without LLM tokens
- [ ] `ai_usage_logs` row: `status=cache_hit`, `provider=cache`, `model=learned_intent`
- [ ] `GET /api/admin/ai-learning/cache-stats` returns incremented `totalUsage`
- [ ] Set `learnedReplyCacheEnabled=false` → same phrase routes to LLM
- [ ] Similar phrase (not exact) hits cache when similarity ≥ 0.72
- [ ] `replyVariationRotation=true` rotates replies for same contact over time
- [ ] Admin approve unknown message creates active learned intent (`POST .../unknown-messages/:id/approve`)
- [ ] Disable intent via `POST .../learned-intents/:id/disable` stops cache hits
- [ ] Short unknown message (<120 chars) runs cheap classifier before full agent (`model=learned_intent_classifier` on hit)
- [ ] Manual create intent via Learning Cache panel or `POST .../learned-intents`
- [ ] CSV export/import learned intents (`GET .../learned-intents-export.csv`, `POST .../import-csv`)
- [ ] Merge duplicates via `POST .../learned-intents/merge` — duplicates disabled, usage summed into primary

---

## Manual — message buffer

> Buffer is wired into auto-reply by default (`messageBufferEnabled=true`).

- [ ] Migration Phase 2 applied; `ai_message_buffers` table exists
- [ ] Config defaults: debounce 10s, max wait 30s, max 10 messages, max 4000 chars
- [ ] Send 3 rapid messages within debounce window → one AI call
- [ ] `ai_usage_logs.batchId` matches `ai_message_buffers.batchId`
- [ ] Buffer row ends `status=processed` with all `messageIds`
- [ ] Usage dashboard → Message buffer activity shows processed/pending counts (conversation IDs masked)
- [ ] Set `messageBufferEnabled=false` → falls back to in-memory burst buffer
- [ ] Failed buffer sets `status=failed` with error in metadata (no infinite retry loop)

---

## Manual — prompt architecture

- [ ] LLM auto-reply usage log metadata includes `promptBreakdown` (rules, history, catalog, knowledge token estimates)
- [ ] Greeting message: low catalog/knowledge tokens in breakdown; history limit ≈ 3
- [ ] Product question: catalog and/or knowledge tokens present; history limit ≈ 5
- [ ] Knowledge block respects caps (`knowledgeMaxChunks=2`, `knowledgeMaxTotalChars=1200`)
- [ ] Oversized prompt logs `budgetWarning` in metadata (`simple_exceeded` or `auto_reply_exceeded`)
- [ ] `GET /api/admin/ai-usage/summary` → `promptBudgetWarningCount`, `averagePromptTokens` populated
- [ ] Conversation facts block appears when rows exist in `ai_conversation_facts` for chat
- [ ] Rule packs apply: presence message does not trigger full product catalog block

---

## Permission smoke test

| Role / permission | View dashboard | Pause / budgets | Learning cache admin |
|-------------------|----------------|-----------------|----------------------|
| Admin | Yes | Yes | Yes |
| Operator (default) | Yes | No | No |
| Viewer | No | No | No |
| Custom `ai.cost.view` | Yes | No | No |
| Custom `ai.cost.manage` | Yes* | Yes | No |
| Custom `ai.learning.view` | No** | No | Read cache/unknowns |
| Custom `ai.learning.manage` | No** | No | Approve/reject intents |

\*Manage alone does not grant view in custom permission lists — include both if needed.  
\*\*Learning permissions are separate from cost permissions.

---

## Related reports

- `AI_COST_OPTIMIZATION_AUDIT.md`
- `AI_LEARNING_CACHE_IMPLEMENTATION_REPORT.md`
- `AI_MESSAGE_BUFFER_IMPLEMENTATION_REPORT.md`
- `AI_PROMPT_ARCHITECTURE_REFACTOR_REPORT.md`
- `AI_USAGE_DASHBOARD_IMPLEMENTATION_REPORT.md`
