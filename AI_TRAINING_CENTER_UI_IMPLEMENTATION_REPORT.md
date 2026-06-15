# AI Training Center UI — Implementation Report

## Summary

Production-ready **AI Training Center** module with Apple-style layout (light background, blue primary buttons, rounded cards, stitch-adjacent spacing). Lives at `/ai-training-center/*` with internal sub-navigation; does not replace `/ai` training tab or Settings learning panels.

## Pages created

| Route | Component |
|-------|-----------|
| `/ai-training-center` → redirect | `dashboard` |
| `/ai-training-center/dashboard` | `TrainingDashboardPage.tsx` |
| `/ai-training-center/learned-intents` | `LearnedIntentsPage.tsx` |
| `/ai-training-center/unknown-messages` | `UnknownMessagesPage.tsx` |
| `/ai-training-center/reply-templates` | `ReplyTemplatesPage.tsx` |
| `/ai-training-center/analytics` | `TrainingAnalyticsPage.tsx` |
| `/ai-training-center/settings` | `TrainingSettingsPage.tsx` |

Host router: `dashboard/src/pages/AiTrainingCenter.tsx`

## Components created

| Area | Files |
|------|--------|
| Layout | `AITrainingLayout.tsx`, `ai-training-center.css` |
| Pages | `TrainingDashboardPage`, `LearnedIntentsPage`, `UnknownMessagesPage`, `ReplyTemplatesPage`, `TrainingAnalyticsPage`, `TrainingSettingsPage` |
| Shared | `shared.tsx` — `StatusBadge`, `IntentBadge`, `ConfidenceIndicator`, `TrainingMetricCard`, empty/loading/error, `AITCModal` |
| Modals | `modals.tsx` — Add/Edit Intent, Intent Details drawer, Reply Template, Review Unknown, Bulk Actions, Add New Training |

## Routes & navigation

- `dashboard/src/App.tsx` — `Route path="ai-training-center/*"`
- `dashboard/src/lib/workspace-nav.ts` — **AI Training Center** sidebar item (`school` icon), Stitch nav key `aiTrainingCenter`
- `dashboard/src/lib/workspace-page-title.ts` — page title key `nav.aiTrainingCenter`
- i18n: `nav.aiTrainingCenter` in `en.json` / `he.json`

Internal sub-nav badge: pending unknown message count on **Unknown Messages** link.

## API layer

| File | Role |
|------|------|
| `dashboard/src/lib/ai-training-center/api.ts` | `aiTrainingCenterApi` — bridges real APIs + mock fallback |
| `dashboard/src/lib/ai-training-center/types.ts` | TypeScript interfaces |
| `dashboard/src/lib/ai-training-center/mock-data.ts` | Mock dashboard/analytics/intents/unknown/templates |
| `dashboard/src/lib/ai-training-center/nav.ts` | Sub-nav config |
| `dashboard/src/hooks/useAiTrainingPermissions.ts` | `ai.learning.view` / `ai.learning.manage` via `/ai/cost/permissions` |

### Connected backend (live)

- `aiLearningCacheApi` — learned intents, unknown messages, cache stats (`/admin/ai-learning/*`)
- `aiTrainingApi.getOverview()` — training queue KPIs
- `aiTrainingApi.getSettings()` / `patchSettings()` — auto-learning toggle
- `aiApi.getConfig()` / `saveConfig()` — context, buffer, safety, confidence thresholds

### Mock / local-only (until dedicated APIs ship)

- **Reply templates** — `localStorage` key `openwa_aitc_reply_templates` + seed data in `mock-data.ts`
- **Analytics charts** (cost saved series, cache hit detail) — live `/admin/ai-learning/analytics` with range param
- **Dashboard overview chart** — mock series blended with live counts when API succeeds

Force full mock: set `VITE_AI_TRAINING_CENTER_MOCK=1` in dashboard env.

### Future backend endpoints (spec alignment)

When implementing `/api/admin/ai-learning/*` aggregate routes:

```
GET  /api/admin/ai-learning/dashboard
GET  /api/admin/ai-learning/analytics
GET  /api/admin/ai-learning/reply-templates
POST /api/admin/ai-learning/reply-templates
PATCH /api/admin/ai-learning/reply-templates/:id
```

Replace methods in `aiTrainingCenterApi.getAnalytics()`, `listReplyTemplates()`, etc.

## Permissions

- View: `ai.learning.view`, `ai.analytics.view`, or AI cost view
- Manage: `ai.learning.manage`, `ai.settings.manage`, or AI cost manage
- Restricted users see empty state on module entry

## How to test

1. `npm run dashboard:dev` → open `http://localhost:2886/ai-training-center/dashboard`
2. Sidebar: **AI Training Center**
3. **Dashboard** — KPIs, charts, recent table, status card; **Add Training** opens modal
4. **Learned Intents** — tabs, search, view drawer, add intent (needs manage permission)
5. **Unknown Messages** — review modal, Save & Train / Reject / Save + Next
6. **Reply Templates** — card grid, new template modal (persists in localStorage)
7. **Analytics** — KPIs + CSS charts
8. **Settings** — tabbed form; Save writes `ai_config` + training settings

Existing E2E: `dashboard/e2e/ai-training-center.spec.ts` (legacy `/ai?tab=training` path still works).

## Build

```bash
cd dashboard && npm run build
```

Verified: `tsc -b && vite build` passes.

## Remaining backend work

| Feature | Status |
|---------|--------|
| Learned intents CRUD | Partial — cache admin API |
| Unknown messages review | Live — approve/reject |
| Reply templates API | **Live** — `/admin/ai-learning/reply-templates` CRUD + seed defaults |
| Analytics time-series | **Live** — aggregates usage logs, intents, unknown messages |
| Bulk actions on unknown/intents | **Live** — `/learned-intents/bulk` + `/unknown-messages/bulk` |
| Import training data | **Live** — CSV import via `learned-intents/import-csv` |
| Dedicated `/api/admin/ai-learning/settings` | Merged into `ai_config` + `ai-training/settings` |

## Style notes

- Primary blue: `#0A84FF`
- Card pattern aligned with inbox stitch C360: white cards, `#E5E7EB` borders, 12px radius, soft shadow
- No purple CTAs; primary actions use `aitc-btn--primary`

## Integration (follow-up)

- Main sidebar badge `aiTrainingUnknown` — pending unknown message count (polls `/admin/ai-learning/unknown-messages`)
- Settings product-demand banner → `/ai-training-center/dashboard`
- Status bar training link → new module
- Inbox teach strip (no item id) → `/ai-training-center/unknown-messages`
- Modals: Escape key + backdrop click to close
- E2E: `dashboard/e2e/ai-training-center-module.spec.ts`


- `/ai?tab=training` — legacy `AiTrainingCenterPanel` (approval workflow)
- Settings → **AI Learning Cache** — admin cache tools
- Settings → **AI Learning** (product demand) — links to training center
