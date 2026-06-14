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

Migration `AddAiCostTracking1781150000000` must be applied (`npm run migration:show` — look for `[X] AddAiCostTracking`).

---

## Automated (covered by `ai-cost-safety` Jest suite)

- [x] Auto-reply uses cheap model tier by default (mini / Haiku / flash-lite)
- [x] Claude Opus blocked for auto-reply unless `allowPremiumModelForAutoReply` enabled
- [x] Auto-reply max tokens clamped to 220 (not 4096)
- [x] Config defaults: max 2 customer tool loops, 5 admin tool loops, 2 AI calls per inbound message
- [x] Context default 8 messages (cap 12)
- [x] Budget exceeded blocks auto-reply and sets `autoReplyPaused`
- [x] Usage log schema has no raw API key fields

## Manual (staging / production)

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

## Permission smoke test

| Role / permission | View dashboard | Pause / budgets |
|-------------------|----------------|-----------------|
| Admin | Yes | Yes |
| Operator (default) | Yes | No |
| Viewer | No | No |
| Custom `ai.cost.view` | Yes | No |
| Custom `ai.cost.manage` | Yes* | Yes |

\*Manage alone does not grant view in custom permission lists — include both if needed.
