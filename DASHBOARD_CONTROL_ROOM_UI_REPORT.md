# Dashboard Control Room UI Report

Implementation of the Social CRM Daily Control Room on the home Dashboard (`/`). No backend changes were made.

## Build verification

```bash
cd dashboard && npm run build
```

Result: **passed** (tsc + vite build) — verified after Interakt UI restyle.

---

## Interakt / Inbox workspace UI (overview tab)

The overview tab matches the Social CRM Control Room mockup and shares visual language with the Inbox (`data-theme-effects='interakt'`):

| Area | Layout / styling |
|------|------------------|
| **Page shell** | Gradient background (`Dashboard.css`), glass cards via `dashboard-primitives.css` |
| **KPI row** | 5-column glass metric cards (icon + trend, large value, caps label) |
| **Main grid** | 2fr / 1fr — Critical feed + right rail (Channel Health compact, Work Summary) |
| **Pipeline band** | Full-width stage funnel with chevrons and stage tint classes |
| **Bottom grid** | Staff leaderboard (compact) · Hot leads opportunity list (compact) · Activity log (compact) |
| **AI widgets** | AI Safety panel under staff column; floating AI Core bubble (overview only) |

Glass styling is scoped under `[data-theme-effects='interakt'] .dashboard--control-room` so non-Interakt themes keep readable fallbacks.

### Overview-specific components

| Component | Notes |
|-----------|-------|
| `DashboardWorkSummary` | Pending tasks + due-today counts (mini widget in right rail) |
| `DashboardAiSafetyPanel` | Autonomy %, manual takeovers, flagged anomalies (purple glass card) |
| `DashboardAiStatusBubble` | Floating “AI Core” status + link to `/ai` |
| `DashboardHotLeads` `compact` | Opportunity rows with avatar initials, subtitle, Hot/Warm badge |
| `DashboardChannelHealth` `compact` | Channel rail with green top accent |
| `DashboardStaffPerformance` `compact` | Leaderboard with progress bars |
| `DashboardRecentActivity` `compact` | Material Symbol timeline + “Load history” link |

Other tabs (Today, Sales, Team, Channels, System) retain functional layouts with shared glass primitives where the Interakt theme is active.

---

## Changed files

| File | Change |
|------|--------|
| `dashboard/src/pages/Dashboard.tsx` | Replaced minimal stats page with tabbed control room |
| `dashboard/src/pages/Dashboard.css` | Control-room layout, Interakt gradient, overview/bottom grids |
| `dashboard/src/components/dashboard/dashboard-primitives.css` | Glass morphism, KPI cards, alerts, pipeline, opportunity rows |
| `dashboard/src/hooks/useDashboardData.ts` | **New** — central data hook with derived metrics |
| `dashboard/src/lib/dashboard-metrics.ts` | **New** — KPI, alerts, pipeline, quotes, timeline helpers |
| `dashboard/src/hooks/queries.ts` | Added dashboard query wrappers (follow-ups, pipeline, quotes, audit, etc.) |
| `dashboard/src/pages/Followups.tsx` | Reads `location.state.filter` from dashboard KPI/alert links |
| `src/modules/audit/entities/audit-log.entity.ts` | `inbox_ai_takeover` / `inbox_ai_resumed` audit actions |
| `src/modules/message/inbox-crm.service.ts` | Audit log on staff AI takeover and resume |
| `src/modules/stats/stats.service.ts` | `failedBySession` on overview stats |
| `src/modules/followup/pipeline.service.ts` | Expose `budget` and `closedAt` on pipeline cards |
| `dashboard/src/components/Layout.tsx` | Branch-scoped follow-ups overdue nav badge |
| `dashboard/src/i18n/locales/en.json` | Added `dashboard.controlRoom.*` strings |
| `dashboard/src/i18n/locales/he.json` | Added Hebrew `dashboard.controlRoom.*` strings |

---

## Created components

### Shared primitives (`dashboard/src/components/dashboard/`)

| Component | Status |
|-----------|--------|
| `MetricCard` | **Created** |
| `StatusBadge` | **Created** |
| `ChannelBadge` | **Created** |
| `AccountBadge` | **Created** |
| `FilterBar` | **Created** |
| `EmptyState` | **Created** |
| `ComingSoonPanel` | **Created** |
| `DataTable` | **Created** |
| `TimelineItem` | **Created** |
| `QuickActionButton` | **Created** |
| `DashboardSection` | **Created** (layout helper) |
| `dashboard-primitives.css` | **Created** — Interakt-aligned styles |

### Section components (same folder)

| Section | File |
|---------|------|
| KPI row | `DashboardKpiRow.tsx` |
| Needs Attention | `DashboardNeedsAttention.tsx` |
| Today's Work | `DashboardTodaysWork.tsx` |
| Sales Pipeline | `DashboardSalesPipeline.tsx` |
| Channel Health | `DashboardChannelHealth.tsx` |
| Staff Performance | `DashboardStaffPerformance.tsx` |
| Hot Leads | `DashboardHotLeads.tsx` |
| Product Demand | `DashboardProductDemand.tsx` |
| Quote Performance | `DashboardQuotePerformance.tsx` |
| Recent Activity | `DashboardRecentActivity.tsx` |
| Work Summary | `DashboardWorkSummary.tsx` |
| System tab | `DashboardSystemPanel.tsx` |

### Reused from existing codebase

| Component | Source |
|-----------|--------|
| `PageHeader` | `components/PageHeader.tsx` |
| `AskAiLink` | `components/AskAiLink.tsx` |
| `MaterialSymbol` | `components/MaterialSymbol.tsx` |
| `PipelineLeadDetail` | `components/PipelineLeadDetail.tsx` |
| `Skeleton` | Available but section-level loading uses metric ellipsis |
| Session disconnect | `useStopSessionMutation` from `hooks/queries.ts` |

---

## Dashboard tabs and sections

| Tab | Sections |
|-----|----------|
| **Overview** | Priority KPIs, Needs Attention feed, Channel Health + Work Summary rail, Pipeline band, Staff / Hot Leads / Activity bottom grid, AI Safety, floating AI bubble |
| **Today** | Priority KPIs, Work queue (glass cards) + Work Summary / Activity rail |
| **Sales** | Priority KPIs, Pipeline band, Hot Leads (compact) + Quote Performance, Product demand card grid |
| **Team** | Staff Performance table + AI Safety / Activity rail |
| **Channels** | WhatsApp channel cards + future channel placeholders |
| **System** | System alerts (accent border), condensed sessions list with disconnect |

---

## Real data vs placeholders

| Section | Data source | Notes |
|---------|-------------|-------|
| **KPI — Unread** | `GET /inbox/conversations` (open, limit 200) | Client sum of `unreadCount` |
| **KPI — New messages** | `GET /stats/overview` | `messages.today.received` |
| **KPI — Overdue / Due today / Payment** | `GET /followup/queue/counts` | Real counts |
| **KPI — Hot leads** | Queue counts + pipeline counts | Real |
| **KPI — Quotes sent** | `GET /quotes` | Client filter `status=sent` |
| **KPI — Won today** | `GET /quotes` | **Partial** — accepted/converted with `updatedAt` today |
| **KPI — Failed sends** | `GET /stats/overview` | `messages.failed` (all-time total) |
| **KPI — Connected accounts** | `GET /sessions/stats/overview` | `ready` count |
| **Needs Attention** | Inbox snapshot, queue counts, sessions, hot leads pipeline, INAUZWA sync | Real; max 8 alerts |
| **Today's Work** | Follow-up queues, draft quotes, assigned open chats | Real |
| **Sales Pipeline** | `GET /followup/pipeline/counts` + dashboard stats | Stage mapping client-side |
| **Channel Health — WhatsApp** | `GET /sessions` + inbox unread per session | Real |
| **Channel Health — Other channels** | — | **Placeholder** (`ComingSoonPanel`) |
| **Staff Performance** | `GET /followup/reports`, conversion report, `leadsByStaff` | Real when KPI rows exist; empty state otherwise |
| **Hot Leads** | `GET /followup/pipeline?bucket=hot_leads` | Real; amounts from quotes + lead `budget` |
| **Product Demand** | Aggregated `productInterest` from pipeline cards + quote items | **Heuristic**; empty when no interest data |
| **Quote Performance** | `GET /quotes` client aggregate | Real; needs-follow-up derived from expired `validUntil` |
| **Recent Activity** | `GET /audit?limit=25` | Real for mapped audit actions |
| **AI Safety** | `GET /settings/ai/status` + inbox snapshot | Autonomy derived from enabled/auto-reply/tools/test; takeovers = paused/human threads |
| **System alerts** | Sessions, INAUZWA sync, AI status, failed sends | Real (same logic as `SystemStatusBanner`) |

---

## Remaining dashboard gaps

1. **No aggregate unread API** — unread total requires fetching up to 200 open conversations (branch-filtered when INAUZWA branch is set).
2. **Per-session failed sends** — shown on Channel Health via `GET /stats/overview` → `messages.failedBySession`.
3. **Won Today KPI** — max of quotes accepted/converted today and pipeline `won_leads` with `closedAt` today.
4. **Product demand** — name-matching aggregation only; no dedicated product-request analytics.
5. **Staff replies / avg response time columns** — KPI reports may lack reply counts; avg response shows `—` until richer tracking exists.
6. **Pipeline estimated value** — quoted / payment / won stages show quote totals; hot-lead rows use max(quote, lead budget).
7. **AI takeover/resume** — logged as `inbox_ai_takeover` / `inbox_ai_resumed`; dashboard AI Safety shows 24h takeover count from audit.
8. **Future channels** (Instagram, Messenger, TikTok, etc.) — UI placeholders only.
9. **Branch scoping** — dashboard data and sidebar follow-ups overdue badge use INAUZWA `branchId` when configured; inbox unread badge remains global.

---

## Navigation enhancements

- KPI cards and alerts link to Inbox, Follow-ups, Pipeline, Sessions, Logs, and Settings.
- Follow-ups page honors `navigate('/followups', { state: { filter: 'overdue' } })` from dashboard.
- Inbox honors `navigate('/inbox', { state: { filter: 'unread' | 'needs_reply' | 'needs_human' } })`.

---

## WhatsApp safety

- No changes to message send paths, inbox engine, or session start/QR flows.
- Dashboard only reads data, navigates, and reuses existing **Disconnect** (`POST /sessions/:id/stop`) in Channel Health and System tabs.
