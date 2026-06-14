# AI Usage Dashboard Implementation Report

## What changed

Production-ready AI cost controls: database logging, budget guards, model tiers, token/tool limits, intent-gated context, deduplication, admin APIs, and Settings → AI → **AI Usage & Cost** dashboard.

## Files changed (high level)

- Backend: migration, `ai_config` extensions, cost services, `ai-chat.service` hardening, inbox agent/auto-reply, admin controllers
- Dashboard: `AiUsageCostPanel`, `aiUsageApi`, settings nav, `AiIntegrationPanel` link

## How to test

1. Run migrations (app startup or `npm run migration:run` if configured)
2. Send a WhatsApp test message → check `ai_usage_logs` or dashboard Recent calls
3. Open **Settings → AI → AI Usage & Cost** (`/settings?category=ai&panel=ai-usage`)
4. Verify summary cards, charts, recent table
5. Pause/resume auto-reply from dashboard
6. Export CSV
7. Set budgets and confirm warning banner at threshold

## How to change model tier

**Settings → AI → Provider** (primary provider) plus new fields via API/`ai_config`:

- `autoReplyModelTier`: `cheap_fast` (default), `balanced`, `premium`
- `allowPremiumModelForAutoReply`: `false` by default
- Per-feature overrides: `autoReplyModelOverride`, etc.

## How to view cost

- Dashboard: Settings → AI → AI Usage & Cost
- API: `GET /api/admin/ai-usage/summary`

## Pause / resume auto-reply

- Dashboard buttons on Usage panel
- API: `POST /api/admin/ai-control/pause-auto-reply` / `resume-auto-reply`

## Permissions

- `ai.cost.view` — usage dashboard, charts, export, budget status banner
- `ai.cost.manage` — budgets, cost settings, pause/resume auto-reply
- Defaults: admin (both), operator (view only), viewer (none)
- API: `GET /api/ai/cost/permissions`

## Build verification

```bash
npm run qa:ai-cost-safety
cd dashboard && npm run build
```

## Staging API smoke test

```bash
npm run qa:ai-cost-staging
# OPENWA_API_KEY=owa_k1_... if data/.api-key does not match running server
```

Migration: `npm run migration:show` — confirm `[X] AddAiCostTracking1781150000000`.

## Production deployment (after merge)

1. **Backup** database before migration.
2. **Run migration** on the API host:
   ```bash
   npm run migration:run:prod
   # or: npm run migration:run
   npm run migration:show   # expect [X] AddAiCostTracking1781150000000
   ```
3. **Restart** the API process/container so new entities and routes load.
4. **Smoke test** (from a machine that can reach the API):
   ```bash
   OPENWA_API_URL=https://your-api OPENWA_API_KEY=owa_k1_... npm run qa:ai-cost-staging
   ```
5. **Dashboard** — Settings → AI → **Usage & Cost** (`/settings?category=ai&panel=ai-usage`).
6. **Budgets** — confirm defaults (daily $1, monthly $20, auto-reply $0.50) or adjust under Usage panel or Provider cost settings.
7. **Permissions** — operators get `ai.cost.view` by default; grant `ai.cost.manage` on API keys for staff who should pause auto-reply or edit budgets.
8. **Live check** — one WhatsApp test message → row in `ai_usage_logs` with `aiCallsCount` ≤ 2.

CI runs `npm run qa:ai-cost-safety` on every PR (Jest regression + usage panel Playwright e2e).

## Pull request

Branch: `feature/ai-cost-optimization`  
Open PR: https://github.com/Mtaasisi/OpenWA/pull/new/feature/ai-cost-optimization
