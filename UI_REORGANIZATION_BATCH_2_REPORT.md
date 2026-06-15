# UI Reorganization — Batch 2 Report

Continuation of the Social CRM Workspace reorganization. Batch 2 focuses on real data pages, Settings extraction, and omnichannel metadata in Inbox/Dashboard.

## Completed in Batch 2

### Quotes page (`dashboard/src/pages/Quotes.tsx`)
- Full workspace page with `quoteApi.list()` and status filter chips (All, Draft, Sent, Accepted, Rejected, Expired, Paid)
- Metric cards (total, draft, sent, won)
- `DataTable` with customer, channel, account, amount, status, created columns
- `SlideOverPanel` detail drawer with send / accept / reject actions
- `Quotes.css` for detail panel layout

### Templates page (`dashboard/src/pages/Templates.tsx`)
- Tabs: **Quick Replies** (`QuickRepliesPanel`) + **Follow-up Templates** (`FollowupTemplatesPanel`)
- Extracted from Settings without removing Settings sections

### Automations page (`dashboard/src/pages/Automations.tsx`)
- Tabs: **Follow-up Rules** (`FollowupRulesPanel`), **AI Auto-reply** (`AiIntegrationPanel`), **More automations** (`ComingSoonPanel`)

### Follow-ups page (`dashboard/src/pages/Followups.tsx`)
- `WorkspacePageLayout` with metric cards
- `ChannelBadge` + `AccountBadge` on queue rows
- `SlideOverPanel` detail drawer
- Reports link → `/reports?section=staff`

### Products page (`dashboard/src/pages/Products.tsx`)
- Migrated to `WorkspacePageLayout` with `MetricCard`, `FilterBar`, `SearchInput`
- Legacy table retained; old `PageHeader` / stat cards removed

### New workspace component
- `dashboard/src/components/workspace/ProductCard.tsx` — reusable product card (exported via `index.ts`)

### Inbox chat header
- `InboxInteraktChatHeader.tsx` — metadata strip with `ChannelBadge`, `AccountBadge`, stage, assignee, AI state, follow-up due badges
- Styles in `workspace.css` (`.inbox-interakt-chat-header__meta-strip`)

### Dashboard
- `DashboardChannelHealth.tsx` — links to `/channels` (was `/sessions`); QR scan → `/channels?channel=whatsapp`

### Settings
- Grouped sidebar nav: Business Profile, Channels & Inbox, Integrations, Team & System (admin), About
- Group label styles in `Settings.css`

### i18n (`en.json`, `he.json`)
- `quotes.list.*`, `quotes.views.*`, `quotes.metrics.*`, search/empty/detail keys
- `templates.tabs.*`, `automations.tabs.*`
- `settings.groups.*`
- `dashboard.controlRoom.openChannels`

## Files touched (Batch 2)

| File | Change |
|------|--------|
| `Quotes.tsx`, `Quotes.css` | Full quotes pipeline page |
| `Templates.tsx` | Panel extraction |
| `Automations.tsx` | Panel extraction |
| `Followups.tsx` | Workspace layout + badges + drawer |
| `Products.tsx` | Workspace layout |
| `ProductCard.tsx` | New component |
| `workspace.css`, `workspace/index.ts` | ProductCard, meta strip, settings nav |
| `InboxInteraktChatHeader.tsx` | Omnichannel metadata strip |
| `DashboardChannelHealth.tsx` | Channels route links |
| `Settings.tsx`, `Settings.css` | Grouped nav |
| `en.json`, `he.json` | Batch 2 strings |

## Build result

```
cd dashboard && npm run build
```

**Result:** PASS (exit 0). Minor CSS minify warnings only; no TypeScript errors.

## Batch 3 (completed)

All Batch 3 candidates shipped — see **`UI_REORGANIZATION_REPORT.md`** § Batch 3 status for file list and verification commands.

## Remaining gaps (post–Batch 3)

- Backend: group CRM APIs, orders sync, social publishing/scheduling
- Dashboard: aggregate unread, staff reply analytics (UI reads existing APIs)
- Manual QA: composer tabs, quote create from `/quotes`, product send regression

## Constraints preserved

- `useInboxController.ts` — not modified
- Message sending logic — unchanged
- No new social network backends
- Original page files and Settings sections retained
