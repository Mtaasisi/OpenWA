# UI Reorganization Report

Social CRM Workspace UI reorganization — implementation summary.

## Files created

### Lib
- `dashboard/src/lib/channels.ts` — Channel registry (WhatsApp active, others coming soon)
- `dashboard/src/lib/workspace-nav.ts` — Unified sidebar navigation

### Workspace components (`dashboard/src/components/workspace/`)
- `workspace.css`, `index.ts`, `WORKSPACE_UI_GUIDE.md`
- `AppShell.tsx`, `MainSidebar.tsx`, `TopBar.tsx`, `MobileBottomNav.tsx`
- `MetricCard.tsx`, `StatusBadge.tsx`, `ChannelBadge.tsx`, `AccountBadge.tsx`
- `FilterBar.tsx`, `SearchInput.tsx`, `DataTable.tsx`, `EmptyState.tsx`, `ComingSoonPanel.tsx`
- `CustomerMiniCard.tsx`, `TimelineItem.tsx`, `ActionMenu.tsx`, `QuickActionButton.tsx`
- `RightInspectorPanel.tsx`, `SlideOverPanel.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`

### Layouts & hooks
- `dashboard/src/layouts/WorkspacePageLayout.tsx`
- `dashboard/src/hooks/useWorkspaceBreakpoint.ts`

### Pages (new route shells)
- `dashboard/src/pages/Quotes.tsx` + `Quotes.css`
- `dashboard/src/pages/Templates.tsx` + `Templates.css`
- `dashboard/src/pages/Automations.tsx` + `Automations.css`
- `dashboard/src/pages/Content.tsx` + `Content.css`
- `dashboard/src/pages/Campaigns.tsx` + `Campaigns.css`
- `dashboard/src/pages/Reports.tsx` + `Reports.css`
- `dashboard/src/pages/Channels.tsx` + `Channels.css`

### Supporting components
- `dashboard/src/components/WhatsAppChannelPanel.tsx`
- `dashboard/src/components/CustomersPipelinePanel.tsx`
- `dashboard/src/components/InboxChannelFilter.tsx`

## Files modified

- `dashboard/src/components/Layout.tsx` — Composes AppShell + MainSidebar + TopBar + MobileBottomNav
- `dashboard/src/App.tsx` — New routes and redirects
- `dashboard/src/App.css` — Imports workspace.css
- `dashboard/src/pages/Dashboard.tsx` — Channels link (was Sessions)
- `dashboard/src/pages/Customers.tsx` — WorkspacePageLayout, pipeline view merge
- `dashboard/src/pages/InboxClassicView.tsx` — ChannelBadge on conversation rows
- `dashboard/src/pages/InboxCustomerPanel.tsx` — Expanded CRM tabs (Profile, Channels, Lead, Products, Quotes, Orders, Notes, Timeline)
- `dashboard/src/components/InboxInteraktListHeader.tsx` — Channel filter chips, All Accounts label
- `dashboard/src/pages/Settings.tsx` — Workspace quick links
- `dashboard/src/pages/Settings.css` — Workspace links styles
- `dashboard/src/components/dashboard/DashboardProductDemand.tsx` — TS fix
- `dashboard/src/i18n/locales/en.json` — Omnichannel nav, channels, pages, inbox CRM tabs
- `dashboard/src/i18n/locales/he.json` — Matching keys (English fallback where uncertain)

## Reusable components added

| Component | Purpose |
|-----------|---------|
| AppShell | Root layout wrapper |
| MainSidebar | Unified nav (standard + Interakt) |
| TopBar | Mobile header |
| MobileBottomNav | Mobile bottom navigation |
| MetricCard | KPI cards |
| StatusBadge | Status pills |
| ChannelBadge | Channel identity badge |
| AccountBadge | Session/account badge |
| FilterBar | Search + filter chips |
| SearchInput | Styled search field |
| DataTable | Lightweight table |
| EmptyState | Empty data states |
| ComingSoonPanel | Future feature placeholder |
| CustomerMiniCard | Compact customer summary |
| TimelineItem | Activity timeline row |
| ActionMenu | Dropdown actions |
| QuickActionButton | Icon toolbar button |
| RightInspectorPanel | Desktop detail column |
| SlideOverPanel | Tablet/mobile drawer |
| Modal / ConfirmDialog | Dialog primitives |
| WorkspacePageLayout | Standard page chrome |

## Routes added

| Route | Page |
|-------|------|
| `/quotes` | Quotes (coming soon shell) |
| `/templates` | Templates (coming soon shell) |
| `/automations` | Automations (coming soon shell) |
| `/content` | Content (coming soon shell) |
| `/campaigns` | Campaigns (coming soon shell) |
| `/reports` | Reports hub (+ embeds staff/pipeline reports via `?section=`) |
| `/channels` | Channels (WhatsApp accounts + channel cards) |

## Redirects added

| From | To |
|------|-----|
| `/sessions` | `/channels?channel=whatsapp` |
| `/pipeline` | `/customers?view=pipeline` |
| `/pipeline/dashboard` | `/reports?section=pipeline` |
| `/pipeline/reports` | `/reports?section=pipeline` |
| `/followups/reports` | `/reports?section=staff` |

## Pages using real WhatsApp data

| Page | Data source |
|------|-------------|
| Dashboard | Sessions, inbox, follow-ups, quotes, pipeline stats (existing control room) |
| Inbox | Unified inbox, messages, CRM (unchanged controller) |
| Customers | `followupApi.listCustomers` + pipeline panel |
| Follow-ups | `followupApi` queue |
| Products | `productsApi` |
| Channels | `Sessions` embedded via WhatsAppChannelPanel |
| Reports (sections) | FollowupReports, PipelineReports |

## Pages that are future placeholders

| Page | Status |
|------|--------|
| Quotes | ComingSoonPanel shell |
| Templates | ComingSoonPanel shell (Settings quick-replies still active) |
| Automations | ComingSoonPanel shell (Settings AI/rules still active) |
| Content | ComingSoonPanel shell |
| Campaigns | ComingSoonPanel shell |
| Reports hub | Channel rows disabled except WhatsApp |
| Inbox channel filters | Non-WhatsApp chips disabled |
| Customer 360 Orders tab | ComingSoonPanel |

## Intentionally not changed

- `useInboxController.ts` — No modifications
- Message sending logic — Unchanged
- Backend APIs — No new integrations
- Original page files (`Sessions.tsx`, `Pipeline.tsx`, etc.) — Retained on disk
- Settings sections — All existing sections preserved
- `layout-interakt-nav.ts` — File kept; Layout no longer imports it
- `dashboard/src/components/dashboard/*` — Pre-existing dashboard primitives retained alongside new workspace components

## Build result

```
cd dashboard && npm run build
```

**Result:** PASS (exit 0). Minor CSS minify warnings only; no TypeScript errors.

## Batch 2 status

See **`UI_REORGANIZATION_BATCH_2_REPORT.md`** for full Batch 2 deliverables (Quotes pipeline, Templates/Automations extraction, Products/Follow-ups workspace layout, Inbox header metadata strip, Settings grouped nav, Dashboard channels links).

**Build:** PASS after Batch 2.

## Batch 3 status (completed 2026-06-08)

| Item | Result |
|------|--------|
| Inbox composer tabs | Reply / Notes / Follow-up / Quote tab bar in `InboxInteraktChrome`; header actions switch tabs; `channelSupportsAction` gating |
| Dashboard channel health | `getComingSoonChannels()` from `lib/channels.ts` |
| Content / Campaigns | Calendar + upcoming posts; campaign sample cards + metrics bento |
| ProductCard | `ProductCatalogView` + CRM recent products (`InboxCrmRecentProducts`) |
| Quotes create flow | `QuoteNewModal` on `/quotes`; `?create=1` deep link; embedded `InboxQuoteBuilder` |
| Dashboard ↔ workspace | Panels import via `dashboard/index` barrel; dead `dash-*` primitive CSS removed; `ws-*` glass overrides |

**Verification (2026-06-08):**

```bash
npm run build                    # backend — pass (clean dist first if ENOTEMPTY)
npm test -- --testPathPatterns=products.service.spec   # 11/11 pass
cd dashboard && npm run build    # pass
```

## Remaining gaps (post–Batch 3)

1. **Backend APIs** — Group members/leads/topics, broadcast context, commerce orders sync, content/campaign scheduling
2. **Dashboard data** — Aggregate unread API, richer staff reply metrics (see `DASHBOARD_CONTROL_ROOM_UI_REPORT.md`)
3. **E2E / manual** — Full Interakt composer tab smoke on live inbox; broadcast thread banner (needs broadcast threads)
4. **i18n review** — Hebrew strings for new composer/quote/content keys
