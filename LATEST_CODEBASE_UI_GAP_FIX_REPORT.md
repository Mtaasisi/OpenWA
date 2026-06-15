# LATEST_CODEBASE_UI_GAP_FIX_REPORT

**Date:** 2026-06-08  
**Scope:** Social CRM Workspace Phases 1–8 + follow-up UI polish (no backend business-logic changes)

**Status:** ✅ Phases 1–8 + Pages Deep Scan Remediation (R0–R6) — build passing

---

## 1. Source cleanup (Phase 1)

| Item | Result |
|------|--------|
| `._*` files | **0 found** — tree already clean |
| `.DS_Store` files | **0 found** |
| `.git/cursor/` | **Absent** |
| `dashboard/.gitignore` | **Updated** — `._*`, `.DS_Store?`, `.git/cursor/` |

---

## 2. Primitives consolidated (Phase 2)

**Canonical:** `dashboard/src/components/workspace/`  
**Dashboard panels:** `dashboard/src/components/dashboard/` (non-primitive only)

Consolidated: StatusBadge, ChannelBadge, AccountBadge, EmptyState, ComingSoonPanel, MetricCard, DataTable, TimelineItem, QuickActionButton, FilterBar (deleted duplicate dashboard copies).

**Bug fix:** `render-icon.tsx` — Lucide ForwardRef icons in MetricCard / QuickActionButton / EmptyState.

`dashboard/src/components/dashboard/index.ts` re-exports workspace primitives.

---

## 3. Navigation (Phase 3 + polish)

- Content / Campaigns always visible in `workspace-nav.ts` with `comingSoon: true`
- Sidebar **Soon** badge beside labels (`MainSidebar.tsx`, `Layout.css`)
- Removed dead `layout-interakt-nav.ts`
- **Legacy redirects:** `legacy-nav-redirects.ts` — old settings deep links → `/templates`, `/automations`
- **Mobile bottom nav:** unread + overdue badges (parity with sidebar)

---

## 4. Role-based dashboard (Phase 4)

| Role | Dashboard |
|------|-----------|
| `admin` | Full Control Room |
| Other roles | **My Workspace** (staff-scoped) |

`dashboard-scope.ts`, `buildStaffKpis`, `buildStaffAttentionAlerts`, `useDashboardData(scope)` with `staffId`.

**Staff KPI fix:** Replies sent today from audit `message_sent` logs (`useAuditMessageSentQuery`).

---

## 5. Chat-type foundation (Phase 5)

**Lib:** `conversation-types.ts` — client-only JID inference.

**Components:** `dashboard/src/components/inbox-crm/`

- Badges, filters, typed panels, `InboxCrmPanelRouter`
- `group-participants.ts` — infer members from loaded messages

---

## 6. Inbox wiring (Phases 6–7 + tactical)

| Theme | Chat-type filter | CRM router | Group composer safety |
|-------|------------------|------------|------------------------|
| Classic | Inline with status chips | ✅ | ✅ |
| Interakt | Main chip row + advanced panel | ✅ | ✅ |
| Tactical | `tac-type-chip` row | ✅ (typed panels) | ✅ |

Group CRM tabs with **client-side data:** overview stats, members from messages, products from catalog messages, timeline from loaded messages.

Typed panels (spam/system/broadcast/internal) show headers, badges, and contextual hints.

---

## 7. Pages — data status

| Page | Status |
|------|--------|
| Dashboard admin / staff | Real APIs (+ audit-derived staff replies) |
| Inbox direct_customer | Full Customer 360 |
| Inbox group | Mixed — members/products/timeline from loaded messages; leads/topics/rules API TBD |
| Inbox broadcast/internal/system/spam | Contextual placeholder panels |
| Content / Campaigns | Coming soon (nav visible) |
| Quotes, Templates, Automations, Reports, Channels, Pipeline | Real data |

**Removed orphan:** `PipelineDashboard.tsx` (unrouted duplicate).

---

## 8. i18n

- English: full `inbox.groupCrm`, `spamCrm` hints, `nav.comingSoonShort`
- Hebrew: matching `chatType`, `groupCrm`, typed CRM, `groupComposer` blocks

---

## 9. Remaining backend gaps (out of UI scope)

| Gap | Notes |
|-----|-------|
| Group members API | UI infers from message senders only |
| Group lead detection | Leads tab placeholder |
| Group topics / rules persistence | Placeholders |
| Broadcast campaign context | No thread-level API |
| `conversationType` server field | Client inference only |
| Spam ML / auto-classify | Uses `outcome`/`stage` heuristics |

---

## 10. Build

```bash
cd dashboard && npm run build
```

**Result:** ✅ Success (`tsc -b && vite build`)

---

## 11. Key files (full pass)

| Area | Paths |
|------|-------|
| Nav | `workspace-nav.ts`, `legacy-nav-redirects.ts`, `MainSidebar.tsx`, `MobileBottomNav.tsx`, `Layout.tsx` |
| Primitives | `workspace/*`, `render-icon.tsx` |
| Dashboard | `dashboard-scope.ts`, `dashboard-metrics.ts`, `useDashboardData.ts`, `Dashboard.tsx` |
| Inbox | `conversation-types.ts`, `inbox-crm/*`, `group-participants.ts`, `useInboxController.ts`, `InboxClassicView.tsx`, `InboxTacticalView.tsx`, `InboxInteraktListHeader.tsx` |
| i18n | `en.json`, `he.json` |

---

## 12. Pages Deep Scan Remediation (R0–R6)

### R0 — UI shell unification

| Change | Result |
|--------|--------|
| `WorkspaceEmbeddedPanel` | New component for Settings/admin embeds |
| `AiChat`, `Themes` | Migrated to `followups-interakt` + `WorkspacePageHeader` + `fu-btn` |
| `Settings` body | `btn btn-secondary` → `fu-btn fu-btn--ghost` |
| Settings → Sessions | `embedContext="workspace"` + `FilterBar` / `fu-btn` toolbar |
| Admin embed toolbars | Webhooks, API Keys, Plugins, Logs embedded actions use `fu-btn` |
| `WorkspacePageLayout` | Deprecated; now wraps `WorkspacePageHeader` |
| `WORKSPACE_UI_GUIDE.md` | Updated — canonical shell = `followups-interakt` + `WorkspacePageHeader` |

**Intentional exception:** Inbox keeps custom chrome.

### R1 — Nav & IA

| Change | Result |
|--------|--------|
| Pipeline in sidebar | `nav.pipeline` → `/pipeline` (after Quotes) |
| Stale `/sessions` UI links | Replaced with `/channels?channel=whatsapp` (Inbox, Dashboard, metrics, AI quick actions) |
| i18n | `inbox.goToChannels`, `dashboard.controlRoom.actions.openChannels` |

### R3 — Channels coming-soon grid

- `Channels.tsx` renders `getComingSoonChannels()` grid with disabled `ChannelBadge` + Soon badge

### R4 — Inbox CRM placeholders

| Area | Result |
|------|--------|
| Group CRM leads/topics/rules/campaigns | `requiresBackend` badge on empty states |
| Customer `orders` tab | `EmptyState` + link to `/quotes` |

### R5 — Mobile, role, i18n

| Change | Result |
|--------|--------|
| Role-based sidebar | `viewer` role hides Channels nav item |
| App boot screens | i18n via `app.boot.*` (en + he) |
| Automations “More” tab | Planned sections list (business hours, opt-out, multi-channel, escalation) |
| Mobile bottom nav | Documented 5-item scope in UI guide |

### R6 — Verification

```bash
cd dashboard && npm run build
```

**Result:** ✅ Success (2026-06-08)

**Build fix:** Removed duplicate `shouldShowSessionLabel` in `inbox-helpers.ts`.

### UI match scorecard (post-remediation)

| Full Shell A match | Partial | Custom (OK) |
|--------------------|---------|-------------|
| Dashboard, Customers, Follow-ups, Products, Quotes, **Pipeline**, Templates, Automations, Content, Campaigns, Reports, Channels, **AiChat**, **Themes**, Settings (header + body buttons) | Settings embed modals (legacy modal `btn-*`), Inbox CRM sub-panels | Inbox message area, Login |

### Remaining (backend / future PRs)

- Group members/leads/topics/rules APIs
- Commerce orders sync
- Content & Campaigns scheduling APIs
- Server-persisted `conversationType`
