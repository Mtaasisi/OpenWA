# AI Usage Dashboard Implementation Report

**Date:** 2026-06-15 (updated for Phase 2 metrics)

## What changed

Production-ready AI cost controls: database logging, budget guards, model tiers, token/tool limits, intent-gated context, deduplication, admin APIs, and Settings → AI → **AI Usage & Cost** dashboard.

**Phase 2 additions:** Extended `AiUsageQueryService.getSummary()` with cache savings, guard counters, and prompt token analytics. Usage logs now store `modelTier`, `contactId`, and `batchId` for buffer/correlation. Learned cache hits appear as `status=cache_hit` rows (provider `cache`, model `learned_intent`).

---

## Files changed (high level)

### Phase 1

- Backend: `1781150000000-AddAiCostTracking.ts`, `ai_config` extensions, `src/modules/ai/cost/*`, `ai-chat.service` hardening, inbox agent/auto-reply, admin controllers
- Dashboard: `AiUsageCostPanel`, `aiUsageApi`, settings nav, `AiIntegrationPanel` link

### Phase 2

- Backend: `1781160000000-AddAiCostOptimizationPhase2.ts`, extended `ai-usage-log.entity.ts`, `ai-usage-query.service.ts`, `ai-cost-tracker.service.ts`
- Admin: `ai-learning-cache-admin.controller.ts`, `ai-message-buffer-admin.controller.ts`
- Dashboard: `AiUsageCostPanel` (optimization cards, buffer activity, filters), `AiLearningCenterPanel`, `AiCostSettingsSection` sections D/E, extended `aiUsageApi` / `aiLearningCacheApi` / `aiMessageBufferApi`

---

## Usage summary API (`GET /api/admin/ai-usage/summary`)

Returns `{ usage, budget }`.

### Existing metrics (`usage`)

| Field | Description |
|-------|-------------|
| `todayCostUsd` | Sum of `actualCostUsd` today |
| `monthCostUsd` | Month-to-date total |
| `last7DaysCostUsd` | Rolling 7-day total |
| `autoReplyTodayCostUsd` | Today cost for `whatsapp_auto_reply` |
| `adminTodayCostUsd` | Today cost for admin/staff features |
| `totalInputTokens` | Month input tokens |
| `totalOutputTokens` | Month output tokens |
| `totalAiCalls` | Month `aiCallsCount` sum |
| `averageCostPerReply` | Mean cost of successful auto-reply calls (month) |
| `mostExpensiveModel` | Highest-cost model this month |
| `mostExpensiveFeature` | Highest-cost feature this month |

### Phase 2 metrics (`usage`) — **new**

| Field | Description |
|-------|-------------|
| `cacheHitCount` | Today rows with `status=cache_hit` |
| `cacheHitRate` | `cacheHits / (cacheHits + successful/failed LLM calls today)` × 100 |
| `moneySavedByCacheUsd` | `cacheHitCount × averageCostPerReply` (estimate) |
| `budgetBlockedCount` | Today rows with `status=budget_blocked` |
| `duplicateSkippedCount` | Today rows with `status=duplicate_skipped` |
| `promptBudgetWarningCount` | Today rows where metadata contains `budgetWarning` |
| `averagePromptTokens` | Today mean `inputTokens` (successful calls with tokens) |
| `averageCompletionTokens` | Today mean `outputTokens` |

### Budget block (`budget`) — unchanged

`dailyTotalUsd`, `monthlyTotalUsd`, `autoReplyDailyUsd`, budget caps, usage percentages, `aiBudgetPaused`, `autoReplyPaused`, `atWarningThreshold`.

---

## Usage log fields (Phase 2)

| Column | Purpose |
|--------|---------|
| `modelTier` | `cheap_fast`, `balanced`, `premium` |
| `contactId` | Customer chat ID attribution |
| `batchId` | Message buffer batch correlation |
| `metadata.promptBreakdown` | Per-section token estimates |
| `metadata.budgetWarning` | `simple_exceeded` / `auto_reply_exceeded` |
| `status=cache_hit` | Learned intent cache (zero token cost) |

---

## Dashboard UI status

**Rendered today** (`AiUsageCostPanel.tsx`):

- Cost cards: today, month, 7-day, auto-reply today
- **Cost optimization** cards: cache hit rate/count, estimated savings, budget blocked, duplicates skipped, avg prompt/completion tokens, prompt budget warnings
- **Prompt contributors** breakdown (7-day sample from usage metadata)
- **Message buffer activity**: processed/pending/failed today + recent batches table (conversation IDs masked)
- Budget remaining cards + pause/resume
- 14-day cost bar chart
- Cost by model / feature lists
- Budget settings form (auto-save)
- Recent calls table with period (Today / 7d / MTD / All) and status filters; budget-warning badge on status column

**Learning cache UI** (`AiLearningCenterPanel.tsx`):

- Learned intents / unknown messages / cache stats tabs
- Manual intent create, CSV export/import, merge duplicates form
- Approve / reject / disable workflows

`AiUsageSummaryView` in `dashboard/src/services/api.ts` includes all Phase 2 summary fields consumed by the panel.

---

## How to test

1. Run migrations:

```bash
npm run migration:run
npm run migration:show
# [X] AddAiCostTracking1781150000000
# [X] AddAiCostOptimizationPhase21811160000000
```

2. Send a WhatsApp test message → check `ai_usage_logs` or dashboard Recent calls.
3. Seed learned intent → send matching phrase → verify `cache_hit` row and summary metrics:

```bash
curl -s -H "Authorization: Bearer $OPENWA_API_KEY" \
  http://127.0.0.1:2785/api/admin/ai-usage/summary | jq '.usage | {cacheHitCount, cacheHitRate, moneySavedByCacheUsd}'
```

4. Open **Settings → AI → AI Usage & Cost** (`/settings?category=ai&panel=ai-usage`).
5. Verify summary cards, charts, recent table.
6. Pause/resume auto-reply from dashboard.
7. Export CSV.
8. Set budgets and confirm warning banner at threshold.
9. Trigger prompt budget warning (lower `autoReplyPromptBudgetTokens`) → check `promptBudgetWarningCount` in API summary.

---

## How to change model tier

**Settings → AI → Provider** (primary provider) plus fields via API/`ai_config`:

- `autoReplyModelTier`: `cheap_fast` (default), `balanced`, `premium`
- `allowPremiumModelForAutoReply`: `false` by default
- Per-feature overrides: `autoReplyModelOverride`, etc.

---

## How to view cost

- Dashboard: Settings → AI → AI Usage & Cost
- API: `GET /api/admin/ai-usage/summary`
- Learning cache stats (separate): `GET /api/admin/ai-learning/cache-stats`

---

## Pause / resume auto-reply

- Dashboard buttons on Usage panel
- API: `POST /api/admin/ai-control/pause-auto-reply` / `resume-auto-reply`

---

## Permissions

- `ai.cost.view` — usage dashboard, charts, export, budget status banner
- `ai.cost.manage` — budgets, cost settings, pause/resume auto-reply
- `ai.learning.view` / `ai.learning.manage` — learning cache admin (separate controller)
- Defaults: admin (both cost), operator (cost view only), viewer (none)
- API: `GET /api/ai/cost/permissions`

---

## Build verification

```bash
npm run qa:ai-cost-safety
cd dashboard && npm run build
```

---

## Staging API smoke test

```bash
npm run qa:ai-cost-staging
# OPENWA_API_KEY=owa_k1_... if data/.api-key does not match running server
```

---

## Production deployment (after merge)

1. **Backup** database before migration.
2. **Run migrations** on the API host:

```bash
npm run migration:run:prod
# or: npm run migration:run
npm run migration:show
# expect both Phase 1 and Phase 2 [X]
```

3. **Restart** the API process/container so new entities and routes load.
4. **Smoke test**:

```bash
OPENWA_API_URL=https://your-api OPENWA_API_KEY=owa_k1_... npm run qa:ai-cost-staging
```

5. **Dashboard** — Settings → AI → **Usage & Cost**.
6. **Verify Phase 2 metrics** via API summary (cache hits after learned intent test).
7. **Budgets** — confirm defaults (daily $1, monthly $20, auto-reply $0.50) or adjust.
8. **Permissions** — operators get `ai.cost.view` by default.
9. **Live check** — one WhatsApp test message → row in `ai_usage_logs` with `aiCallsCount` ≤ 2 (or `cache_hit` for cached phrase).

CI runs `npm run qa:ai-cost-safety` on every PR (Jest regression + usage panel Playwright e2e).

---

## Related reports

- `AI_COST_OPTIMIZATION_AUDIT.md`
- `AI_LEARNING_CACHE_IMPLEMENTATION_REPORT.md`
- `AI_COST_SAFETY_MANUAL_QA_CHECKLIST.md`
