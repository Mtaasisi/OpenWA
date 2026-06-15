# Smart Progressive Customer Profiling — Implementation Report

## Summary

Smart Progressive Customer Profiling extends the existing AI auto-reply and CRM stack with safe name detection, progressive one-question-per-reply profiling, lost-demand notify flows, staff review queues, and dashboard visibility — without rebuilding inbox or learning systems.

## Backend

| Area | Files |
|------|-------|
| Migration | `src/database/migrations/1780930000000-AddCustomerProfileEnrichment.ts` |
| Entities | `customer-profile-enrichment`, `customer-profile-learning-event`, `lost-demand-followup` |
| Service | `src/modules/ai/customer-profile-enrichment.service.ts` |
| Utils | `customer-name-detector`, `customer-name-correction`, `profile-question-planner`, `profile-field-extractor` |
| Auto-reply | `ai-inbox-auto-reply.service.ts` (profiling before signals) |
| APIs | `customer-profile.controller.ts` |
| Dashboard counts | `ai-learning-dashboard.controller.ts` → `profile` payload |
| Settings | `ai-config.entity.ts`, `ai-settings.service.ts`, `ai.dto.ts` |

## Frontend

| Area | Files |
|------|-------|
| AI settings | `AiIntegrationPanel.tsx` — master toggle + sub-settings |
| Customer CRM | `CustomerAiProfilePanel.tsx`, `CustomerProfilePanel.tsx`, `InboxCustomerPanel.tsx` |
| Follow-ups | `LostDemandFollowupsPanel.tsx` on `Followups.tsx` |
| API types | `dashboard/src/services/api.ts` — `customerProfileApi`, `AiLearningDemandAlerts.profile` |
| Dashboard | `buildAttentionAlerts`, `useDashboardData`, `DashboardTodaysWork`, `DashboardProductDemand`, `DashboardAiSafetyPanel` |

## Deployment note

Local dev data lives in `./openwa` (SQLite, `DATABASE_NAME=openwa` in `.env`). Schema verified:

- `customer_profile_enrichment`, `customer_profile_learning_events`, `lost_demand_followups`
- `ai_config.progressiveProfilingEnabled` and related columns

Port `2785` on this machine is served by **Docker**, not `npm run dev` — use `OPENWA_API_KEY` from that instance for API QA.

Production UI (`187.77.101.136:2886`) was checked: **Smart Progressive Profiling card is not deployed yet** (settings panel stops at Operational Constraints → AI Capability tools). Deploy latest dashboard + API + run migrations on the VPS to enable live QA there.

Live QA helper:

```bash
OPENWA_API_URL=http://127.0.0.1:2785 OPENWA_API_KEY=your-key ./scripts/qa-profiling-live.sh
```

## Manual QA Checklist

- [ ] Enable **Smart Progressive Profiling** in Settings → AI & Automation; save and reload — toggle persists.
- [ ] Send `Naitwa Asha` in a private chat — AI replies with name-save template and CRM name updates.
- [ ] Reply `Sio Asha, ni Aisha` — correction reply fires and name updates.
- [ ] Ask for out-of-stock product and reject alternative — lost-demand row appears on Follow-ups page.
- [ ] Medium-confidence name → `nameNeedsReview` shows in Customer AI Profile panel; approve clears flag.
- [ ] Dashboard **Needs Attention** shows profile / lost-demand alerts when counts > 0.
- [ ] Group chat with **Disable profiling in groups** on — no profiling questions.

## Tests

```bash
npm run build
npm run smoke:ai
cd dashboard && npm run build && npm run test && npm run test:e2e
```

| Layer | Specs |
|-------|--------|
| Jest | `customer-name-detector`, `customer-name-correction`, `profile-question-planner` |
| Vitest | `dashboard-attention-alerts.spec.ts` (profile alerts) |
| Playwright | `dashboard-profile-alerts.spec.ts`, `followups-lost-demand.spec.ts`, `ai-profiling-settings.spec.ts` |

One-command profiling QA:

```bash
npm run qa:profiling
```

**i18n:** English + Hebrew keys for settings, dashboard alerts, customers AI profile, and follow-ups lost demand.

**Last full QA run:** backend build, `smoke:ai` (76 tests), dashboard build, vitest (17 tests), playwright (12 tests) — all passing.
