# AI Learning & Product Demand — Full Audit Report

**Date:** 2026-06-10  
**Scope:** End-to-end AI Learning Center + Product Demand Intelligence (spec items 1–29)

---

## Summary

The AI Learning & Product Demand module was **largely missing** before this work (~5% UI, ~10% APIs). It is now **implemented end-to-end** with:

- 8 new database tables + migration
- Full backend API surface (`/api/ai-learning/*`, `/api/product-demand/*`, `/api/dashboard/ai-learning-demand-alerts`)
- Inbox AI integration (low-confidence waiting reply, pending items, approved-knowledge reuse, staff corrections, product demand events)
- Settings page **AI Learning & Product Demand** with 10 tabs, 6 KPI cards, 9 modals
- Dashboard extensions (Needs Attention, AI Safety, Today's Work, Product Demand link)
- WebSocket admin notifications
- Preserved existing import pipeline, inbox CRM panel, WhatsApp/sessions/AI settings

**Build status:** Backend `npm run build` ✅ · Dashboard `npm run build` ✅ · `npm run smoke:ai` ✅ (30 tests)

---

## What Existed Before

| Area | Prior state |
|------|-------------|
| Settings AI Learning | `AiCustomerLearningPanel` — WhatsApp/CSV import only |
| DB | `ai_learning_imports`, `stocking_reminders`, CRM learning fields |
| APIs | `/api/ai/learning/imports*`, `/api/ai/signals/dashboard` |
| Product demand | Client-side `aggregateProductDemand()` heuristic |
| Inbox learning loop | None (no confidence, no pending queue) |
| Dashboard | `ai-stocking-reminders` alert only |

---

## What Was Fixed / Implemented

### Database migrations / entities

| Table | Entity |
|-------|--------|
| `ai_learning_items` | `AiLearningItem` |
| `ai_learning_knowledge` | `AiLearningKnowledge` |
| `ai_learning_settings` | `AiLearningSettings` |
| `product_demand_events` | `ProductDemandEvent` |
| `product_demand_summary` | `ProductDemandSummary` |
| `product_aliases` | `ProductAlias` |
| `missing_product_requests` | `MissingProductRequest` |
| `product_demand_recommendations` | `ProductDemandRecommendation` |

Migration: `src/database/migrations/1780890000000-AddAiLearningProductDemand.ts`

### API endpoints added

**`/api/ai-learning/*`** (`AiLearningItemsController`)

- `GET /overview`
- `GET|PATCH /items`, `GET /items/:id`, `GET /items/:id/similar`
- `POST /items/:id/approve|reject|ignore|merge|reply-and-teach|teach-only|reply-only`
- `GET|PATCH /knowledge`, `POST /knowledge/:id/disable|mark-needs-review`
- `GET /history`
- `GET|PATCH /settings`, `POST /settings/reset`

**`/api/product-demand/*`** (`ProductDemandController`)

- `GET /overview`, `GET /items`, `GET /items/:id`
- `GET /missing`, `GET /missing/:id`, `POST /missing/:id/map|ignore`
- `POST /alias`, `POST /stocking-reminder`
- `GET /recommendations`, `POST /recommendations/:id/action|dismiss`
- `GET|PATCH /product-requests`, `GET /product-requests/:id`, `POST /product-request`
- `GET|PATCH /campaigns`, `POST /campaigns/:id/send`

**`/api/dashboard/ai-learning-demand-alerts`** (`AiLearningDashboardController`)

Legacy import APIs unchanged: `/api/ai/learning/imports*`

### Backend services

- `AiLearningItemsService` — CRUD, approve/reject/merge, reply-and-teach, overview KPIs
- `AiLearningKnowledgeService` — approved knowledge, reuse lookup, usage tracking
- `AiLearningKnowledgeFileService` — MD append after admin approval
- `AiLearningSettingsService` — singleton settings
- `ProductDemandService` — events, summary rollup, missing products, aliases, recommendations
- `AiLearningInboxService` — confidence routing, low-confidence handling, staff corrections

### AI reply engine integration

- **Before agent:** `findBestMatch()` — high-confidence approved answer short-circuits LLM
- **Low confidence:** sends configurable waiting reply (`Nipe muda kidogo Boss…`), creates `ai_learning_items`, sets `waiting_human`, emits `ai.learning.pending`
- **Staff correction:** `message:sent` hook creates suggested learning item when staff edits AI reply
- **Product demand:** `AiSignalService.processIncoming` → `ProductDemandService.recordFromMessage`

### MD knowledge file updates

- Admin approval → DB first (`ai_learning_knowledge`) → append via `AiKnowledgeService.writeFile`
- `FAQ_KNOWLEDGE.md` maps to existing `FAQ.md`
- Seed stubs added: `FAQ_KNOWLEDGE.md`, `PRODUCT_QA.md`, `WARRANTY_RULES.md`

### UI — Settings → AI & Automation → AI Learning & Product Demand

| Tab | Status |
|-----|--------|
| Overview | ✅ 6 KPI cards + import section |
| Pending Questions | ✅ Table + Review modal |
| Suggested Answers | ✅ Table + Edit & Approve modal |
| Approved Knowledge | ✅ Table + Edit modal |
| Product Demand | ✅ Table + Details modal |
| Missing Products | ✅ Table + Map modal |
| Product Requests | ✅ Table + CSV export + New product request modal |
| Recommendations | ✅ Cards + Action modal |
| Learning History | ✅ Table + Details modal |
| Settings | ✅ Summary + Learning Settings modal |

**Modals:** Review Unknown Question, Edit Suggested Answer, Edit Approved Knowledge, Product Demand Details, Map Missing Product, Recommendation Action, Learning History Details, Learning Settings

**Preserved:** WhatsApp import via `AiLearningImportSection` in Overview tab; legacy `AiCustomerLearningPanel.tsx` removed (superseded by `AiLearningProductDemandPanel`)

### Dashboard sections updated

- **DashboardNeedsAttention:** `ai-learning-pending`, `repeated-unknown`, `urgent-waiting`, `staff-corrections`
- **DashboardAiSafetyPanel:** pending learning, unknown today, AI paused chats
- **DashboardTodaysWork:** `ai-learning` queue items from top pending questions
- **DashboardProductDemand:** links to AI Learning panel; merges API demand data

### Notifications

- WebSocket: `ai.learning.pending`, `ai.learning.repeated`, `product.demand.spike`, `knowledge.needs_review`
- Hook: `useAiLearningAlerts` (admin dashboard)

### Tests added / updated

- `ai-learning-confidence.util.spec.ts` (new)
- `ai-signal.behavior.spec.ts` (product demand mock)
- Existing: `ai-learning-archive.util.spec.ts`, `ai-learning-reply-samples.util.spec.ts`

---

## Files Created

### Backend
- `src/database/migrations/1780890000000-AddAiLearningProductDemand.ts`
- `src/modules/ai/ai-learning.enums.ts`
- `src/modules/ai/product-demand.enums.ts`
- `src/modules/ai/entities/ai-learning-item.entity.ts`
- `src/modules/ai/entities/ai-learning-knowledge.entity.ts`
- `src/modules/ai/entities/ai-learning-settings.entity.ts`
- `src/modules/ai/entities/product-demand-event.entity.ts`
- `src/modules/ai/entities/product-demand-summary.entity.ts`
- `src/modules/ai/entities/product-alias.entity.ts`
- `src/modules/ai/entities/missing-product-request.entity.ts`
- `src/modules/ai/entities/product-demand-recommendation.entity.ts`
- `src/modules/ai/ai-learning-items.service.ts`
- `src/modules/ai/ai-learning-knowledge.service.ts`
- `src/modules/ai/ai-learning-knowledge-file.service.ts`
- `src/modules/ai/ai-learning-settings.service.ts`
- `src/modules/ai/ai-learning-inbox.service.ts`
- `src/modules/ai/product-demand.service.ts`
- `src/modules/ai/ai-learning-items.controller.ts`
- `src/modules/ai/product-demand.controller.ts`
- `src/modules/ai/ai-learning-dashboard.controller.ts`
- `src/modules/ai/utils/ai-learning-confidence.util.ts`
- `src/modules/ai/utils/ai-learning-confidence.util.spec.ts`
- `src/modules/ai/utils/product-demand-detect.util.ts`
- `seed/ai-knowledge/FAQ_KNOWLEDGE.md`
- `seed/ai-knowledge/PRODUCT_QA.md`
- `seed/ai-knowledge/WARRANTY_RULES.md`

### Frontend
- `dashboard/src/components/settings/ai-learning/AiLearningProductDemandPanel.tsx`
- `dashboard/src/components/settings/ai-learning/AiLearningImportSection.tsx`
- `dashboard/src/components/settings/ai-learning/AiLearningModals.tsx`
- `dashboard/src/components/settings/ai-learning/ai-learning.css`
- `dashboard/src/hooks/useAiLearningAlerts.ts`

### Docs
- `AI_LEARNING_PRODUCT_DEMAND_FULL_AUDIT_REPORT.md` (this file)

---

## Files Modified

- `src/modules/ai/ai.module.ts`
- `src/modules/ai/ai-inbox-auto-reply.service.ts`
- `src/modules/ai/ai-signal.service.ts`
- `src/modules/ai/ai-signal.behavior.spec.ts`
- `src/modules/events/events.gateway.ts`
- `dashboard/src/services/api.ts`
- `dashboard/src/components/settings/SettingsPanelsRouter.tsx`
- `dashboard/src/i18n/locales/en.json`
- `dashboard/src/hooks/queries.ts`
- `dashboard/src/hooks/useDashboardData.ts`
- `dashboard/src/lib/dashboard-metrics.ts`
- `dashboard/src/pages/Dashboard.tsx`
- `dashboard/src/components/dashboard/DashboardNeedsAttention.tsx` (via metrics)
- `dashboard/src/components/dashboard/DashboardAiSafetyPanel.tsx`
- `dashboard/src/components/dashboard/DashboardTodaysWork.tsx`
- `dashboard/src/components/dashboard/DashboardProductDemand.tsx`

---

## Build Results

| Command | Result |
|---------|--------|
| `npm run build` (backend) | ✅ Pass |
| `npm run dashboard:build` | ✅ Pass |
| `cd dashboard && npm run test` | ✅ 4 suites, 12 tests |
| `npm run migration:run` | ✅ `AddAiLearningProductDemand1780890000000` applied |
| `npm run smoke:ai` | ✅ 8 suites, 50 tests passed |
| `npm run test:ai-learning-api` | ✅ 4 API e2e tests |
| `cd dashboard && npm run test:e2e` | ✅ 6 Playwright tests |

---

## Phase 2 additions (2026-06-10)

| Item | Status |
|------|--------|
| Create Product Request popup | ✅ `CreateProductRequestModal` + `POST /api/product-demand/product-request` |
| Product Demand tab filters | ✅ `ProductDemandFilterBar` wired to API query params |
| Export CSV | ✅ Product Demand + Missing Products tables |
| Product search in Map Missing | ✅ `AiProductSearchField` (catalog search) |
| `uniqueCustomers` rollup | ✅ `customerIds` on `product_demand_summary` + migration |
| `product_catalog_requests` table | ✅ Migration `1780900000000` |

## Phase 3 additions (2026-06-10)

| Item | Status |
|------|--------|
| Customer outcome tracking | ✅ `detectLearningOutcome` + CRM `pendingKnowledgeOutcome`; bumps `successRate` / sets `needs_review` |
| Outcome on history tab | ✅ Outcome column + modal field |
| Success rate on approved knowledge | ✅ Column in Approved Knowledge tab |
| Recommendation → product request | ✅ `task` action creates `product_catalog_requests` row |
| Recommendation → SMS campaign | ✅ `campaign` action pre-fills `/campaigns` SMS panel via router state |
| Product Demand date range | ✅ `from` / `to` filters in `ProductDemandFilterBar` + API |
| Outcome util tests | ✅ `ai-learning-outcome.util.spec.ts` |
| `ai-signal.behavior.spec` mock | ✅ `learningInbox.processOutcomeOnIncoming` mock added |

## Phase 4 additions (2026-06-10)

| Item | Status |
|------|--------|
| Hebrew i18n | ✅ `he.json` tabs, KPIs, tables, filters, map-missing, recommendations |
| Panel i18n wiring | ✅ `AiLearningProductDemandPanel`, `ProductDemandFilterBar`, key modals |
| CSV export — Pending / Suggested / Approved | ✅ Toolbar export on all three tabs |
| Catalog browse in Map Missing | ✅ `AiProductCatalogPicker` (`ProductCatalogView` select-only modal) |
| Frontend vitest | ✅ `npm run test` in dashboard — filters + export-csv specs (8 tests) |

## Phase 5 additions (2026-06-10)

| Item | Status |
|------|--------|
| Full modal i18n (EN + HE) | ✅ All 8 modals wired via `ai.learning.modals.*` |
| Outcome labels i18n | ✅ `ai.learning.outcomes.*` + `formatLearningOutcome` helper |
| Learning settings UI | ✅ `trackCustomerOutcome` toggle exposed in settings modal |
| History CSV export | ✅ Learning History tab |
| `learning-i18n.spec.ts` | ✅ 4 tests |

## Phase 13 additions (2026-06-10)

| Item | Status |
|------|--------|
| Campaign metrics API | ✅ `GET /api/product-demand/campaigns/metrics` |
| Campaigns page KPIs | ✅ Draft / sent / SMS / WhatsApp counts from real data |
| Real campaign cards | ✅ Demand campaigns replace placeholder samples when present |
| Unified QA script | ✅ `npm run qa:ai-learning` (build + smoke + vitest + Playwright) |
| Playwright campaigns spec | ✅ `dashboard/e2e/campaigns-demand.spec.ts` |

## Phase 12 additions (2026-06-10)

| Item | Status |
|------|--------|
| `product_demand_campaigns` table | ✅ Migration `1780920000000` |
| Campaign API | ✅ `GET|PATCH /product-demand/campaigns`, `POST .../send` |
| Recipient resolution | ✅ From `product_demand_events` via recommendation summary |
| SMS + WhatsApp send | ✅ `SmsService.bulkSend` + `MessageService.sendTextFromInbox` |
| Recommendation → campaign entity | ✅ `campaign` action creates DB row + `campaignId` in response |
| Campaigns page UI | ✅ `ProductDemandCampaignPanel` with edit/send |
| SMS prefill enhancement | ✅ Auto-select recipients when `demandCampaignId` in router state |

## Phase 11 additions (2026-06-10)

| Item | Status |
|------|--------|
| Missing product detail API | ✅ `GET /api/product-demand/missing/:id` + deduped `recentChats` from demand events |
| Map Missing inbox send | ✅ `AiMapMissingInboxSend` — chat picker, `InboxProductPicker`, quick send, open chat |
| Map & send action | ✅ Maps alias then `POST /products/:id/send` to selected chat |
| i18n (EN + HE) | ✅ Recent chats, browse/send, map & send labels |

## Phase 10 additions (2026-06-10)

| Item | Status |
|------|--------|
| `productId` + `fulfilledAt` on catalog requests | ✅ Migration `1780910000000` |
| Link request → catalog product | ✅ `POST /api/product-demand/product-requests/:id/link-product` |
| Auto-fulfill on product create | ✅ `ProductsService.create` → `fulfillMatchingCatalogRequests` (name match) |
| Product Requests UI | ✅ Link picker in Details modal + Catalog product column |
| Name match util | ✅ `catalog-request-match.util.ts` |

## Phase 9 additions (2026-06-10)

| Item | Status |
|------|--------|
| Product request status enum | ✅ `ProductCatalogRequestStatus` (open, in_progress, done, cancelled) |
| List filter API | ✅ `GET /api/product-demand/product-requests?status=` (active default) |
| Update request API | ✅ `PATCH /api/product-demand/product-requests/:id` |
| Get request API | ✅ `GET /api/product-demand/product-requests/:id` |
| Product Requests UI | ✅ Status filter, localized labels, Details modal with complete/cancel |
| Tests | ✅ `product-catalog-request.service.spec.ts`, `product-demand-api.e2e-spec.ts`, Playwright modal test |

## Phase 8 additions (2026-06-10)

| Item | Status |
|------|--------|
| Product Requests tab | ✅ Lists `product_catalog_requests` via `GET /api/product-demand/product-requests` |
| Product Requests CSV export | ✅ Toolbar export on Product Requests tab |
| Dead code cleanup | ✅ Removed unused `AiCustomerLearningPanel.tsx` |
| Playwright — product requests | ✅ Mock + tab test in `ai-learning-panel.spec.ts` |

## Phase 7 additions (2026-06-10)

| Item | Status |
|------|--------|
| `ai-learning-items.service.spec.ts` | ✅ Inbox→pending→approve pipeline (4 tests) |
| `test/ai-learning-api.e2e-spec.ts` | ✅ Supertest API contract (overview, items, settings, history) |
| Playwright scaffolding | ✅ `dashboard/e2e/ai-learning-panel.spec.ts` (2 tests) |
| `npm run test:e2e` (dashboard) | ✅ Pass on port 2896 (isolated dev server) |
| `npm run test:ai-learning-api` | ✅ Pass |
| `npm run smoke:ai-learning` | ✅ Jest smoke + API e2e combo script |
| `npm run qa:ai-learning` | ✅ Full automated QA (build + unit + e2e) |

## Phase 6 additions (2026-06-10)

| Item | Status |
|------|--------|
| Inbox→learning behavior tests | ✅ `ai-learning-inbox.behavior.spec.ts` (9 cases) |
| Signal wiring test | ✅ `processOutcomeOnIncoming` + `recordFromMessage` on `processIncoming` |
| Covered flows | ✅ `decideBeforeAgent`, `handleLowConfidence`, outcome tracking, staff correction |

## Phase 15 additions (2026-06-10)

| Item | Status |
|------|--------|
| `topDraftCampaigns` on alerts API | ✅ Up to 5 draft rows for dashboard widgets |
| Today's Work queue | ✅ Draft demand campaigns with Open Campaigns action |
| Product Demand panel hint | ✅ Banner when drafts exist → link to `/campaigns` |
| Dashboard alert unit test | ✅ `dashboard-attention-alerts.spec.ts` |
| Dashboard e2e | ✅ `dashboard-demand-alert.spec.ts` |

## Phase 14 additions (2026-06-10)

| Item | Status |
|------|--------|
| Campaigns nav live | ✅ Removed `comingSoon` badge from `/campaigns` sidebar item |
| i18n `nav.comingSoon` | ✅ Added to `en.json` / `he.json` (social publishing strip only) |
| Dashboard draft campaign alert | ✅ `draftCampaignsCount` on alerts API → Needs Attention → Open Campaigns |
| Live QA helper | ✅ `npm run qa:inbox-learning-live` (`scripts/qa-inbox-learning-live.sh`) |

## Remaining Gaps (honest)

| Item | Notes |
|------|-------|
| Live WhatsApp inbox E2E | Playwright uses mocked APIs; use `npm run qa:inbox-learning-live` + manual checklist |
| Instagram/Facebook/TikTok publishing | Sample cards on Campaigns page still placeholder (“coming soon”) |

---

## Manual QA Checklist

- [ ] Unknown question gets waiting reply (`Nipe muda kidogo Boss…`)
- [ ] Pending question appears in Settings → AI Learning → Pending Questions
- [ ] Pending question appears on Dashboard Needs Attention
- [ ] Admin can **Reply Customer + Teach AI** from Review modal
- [ ] Approved answer is reused on similar next message (high-confidence short-circuit)
- [ ] Target MD file updates after approval (check `FAQ.md` or selected file)
- [ ] Product demand event created from customer product message
- [ ] Missing product appears in Missing Products tab when unmatched
- [ ] Admin can map missing product to existing product (alias created)
- [ ] Product alias improves next match
- [ ] Product Demand dashboard section shows counts / links to learning panel
- [ ] Recommendation can create stocking reminder
- [ ] Recommendation **Create product request** creates catalog request row
- [ ] Recommendation **Start SMS campaign** opens Campaigns with prefilled message and demand campaign row
- [ ] Campaigns page KPI cards reflect draft/sent demand outreach counts
- [ ] Dashboard Needs Attention shows draft demand campaign alert when drafts exist
- [ ] Customer reply after approved-knowledge reuse updates success rate / outcome on history
- [ ] Low-confidence message creates pending item (automated: `ai-learning-inbox.behavior.spec.ts`)
- [ ] Staff edit of AI reply creates suggested item (automated: `handleStaffCorrection` spec)
- [ ] Product Demand date range filter narrows rows
- [ ] Product Requests tab lists catalog requests created from recommendations or Missing Products
- [ ] Admin can mark product request in progress, complete, or cancelled from Details modal
- [ ] Product Requests status filter shows active / done / all rows correctly
- [ ] Link product request to catalog product from Details modal marks request done
- [ ] Creating a catalog product with matching name auto-closes open product requests
- [ ] Map Missing modal lists customers who asked and can send mapped product via inbox send flow
- [ ] All 10 tabs render without errors
- [ ] Review / Edit / Map / Settings modals open and save
- [ ] Staff edit of AI reply creates suggested learning item
- [ ] WebSocket toast on new pending learning item (admin dashboard open)
- [ ] WhatsApp import still works in Overview tab
- [ ] Inbox, sessions, AI settings, products, follow-ups, SMS unchanged

---

## Route Reference

| Spec | Implemented |
|------|-------------|
| `GET /ai-learning/items` | `GET /api/ai-learning/items` |
| `GET /product-demand/overview` | `GET /api/product-demand/overview` |
| `GET /dashboard/ai-learning-demand-alerts` | `GET /api/dashboard/ai-learning-demand-alerts` |
| `GET /ai/learning/imports` | Unchanged (backward compatible) |
