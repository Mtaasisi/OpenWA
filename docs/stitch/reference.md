# Digital Reconstruction — Stitch Design Reference

Project: `10762313322488880010` (Digital Reconstruction Project)

## Canonical Phase 1 screens

| File | Stitch ID | Title |
|------|-----------|-------|
| `activity-synchronized.html` | `17b497e192c24e50b747c762af1618aa` | Patient Support Dashboard - Activity (Synchronized) |
| `chat-filter-open.html` | `915def37984640f5baaf1268660e314d` | Patient Support Dashboard - Chat Filter Open |

## Design tokens

| Token | CSS variable | Value |
|-------|--------------|-------|
| Font | `--stitch-font` | Inter, system-ui, sans-serif |
| Primary | `--primary` | `#2563eb` (blue-600) |
| Primary hover | `--primary-hover` | `#1d4ed8` (blue-700) |
| Page bg | `--bg-light` / `--stitch-page-bg` | `#F8F9FB` |
| Surface | `--bg-white` | `#FFFFFF` |
| Card | `--bg-card` | `#FFFFFF` |
| Text primary | `--text-primary` | `#111827` (gray-900) |
| Text secondary | `--text-secondary` | `#4b5563` (gray-600) |
| Text muted | `--text-muted` | `#9ca3af` (gray-400) |
| Border | `--border` | `#f3f4f6` (gray-100) |
| Mac red | `--stitch-mac-red` | `#FF5F57` |
| Mac yellow | `--stitch-mac-yellow` | `#FEBC2E` |
| Mac green | `--stitch-mac-green` | `#28C840` |
| Sidebar width | `--stitch-sidebar-w` | `80px` |
| App header height | `--stitch-header-h` | `64px` |
| Chat sub-header | `--stitch-chat-header-h` | `56px` |
| CRM panel width | `--stitch-crm-panel-w` | `380px` |
| Filter dropdown width | `--stitch-filter-menu-w` | `224px` (14rem) |
| Radius sm | `--radius` | `8px` |
| Radius pill | `--stitch-radius-pill` | `9999px` |
| Radius panel | `--stitch-radius-panel` | `16px` |

## Icons (Material Symbols Outlined)

Sidebar: `grid_view`, `mail`, `group`, `smart_toy`, `inventory_2`, `account_tree`, `request_quote`, `history`, `description`, `article`, `settings`

Inbox chrome: `search`, `filter_list`, `expand_more`, `refresh`, `more_horiz`, `close`, `check`, `archive`, `flag`, `mark_chat_unread`, `hourglass_empty`

## Layout structure

```
[Sidebar 80px] | [Main: header 64px + content]
                 | [Inbox: list | thread | CRM 380px]
```

Filter dropdown: `backdrop-blur`, white/80, rounded-2xl, shadow-xl.

## Phase 3 (workspace pages + inbox polish)

| Area | Notes |
|------|-------|
| AI Suggestions panel | Composer card grid; uses quick-reply templates (top 2) |
| Empty thread state | Stitch copy + styling when no chat selected |
| Follow-ups / Products | `stitch-workspace-pages.css` — tokens, cards, tables under `layout--stitch-v1` |

## Phase 4 (workspace shell + CRM polish)

| Area | Notes |
|------|-------|
| Sidebar nav | `STITCH_NAV_MAIN_KEYS` — Dashboard through Content only (+ Settings footer); hides Campaigns, Reports, Channels, Automations |
| Customers / AI / Settings | Token overrides under `layout--stitch-v1`; page headers hidden where global `StitchWorkspaceAppHeader` applies |
| Schedule modal | `fu-schedule-modal--stitch` when Digital Reconstruction theme active |
| CRM Patient Profile | Portrait hero card, blue timeline dots, aside tabs + kicker |

## Phase 5 (inbox layout + dashboard + previews)

| Area | Notes |
|------|-------|
| Inbox thread column | Flex layout so chat header, messages, and composer stack correctly |
| Chat header wrapper | `inbox-chat-header--stitch` resets classic header chrome |
| Dashboard | Control Room `--cr-*` tokens mapped to Stitch blue palette; duplicate header hidden |
| Pipeline / Quotes / Templates / Content | Same workspace page token shell as Follow-ups |
| App header | Home route shows “Dashboard” in Stitch shell |
| Previews | `docs/stitch/app-preview-*.png` regenerated via Playwright |

## Phase 6 (composer + previews)

| Area | Notes |
|------|-------|
| Voice message | Mic button shows info toast (coming soon stub) |
| Composer hint | Subtle `Enter send · Shift+Enter new line` below stitch composer |
| Activity preview | `app-preview-activity.png` — CRM Activity tab with timeline |
| Dashboard preview | `app-preview-dashboard.png` — home route with full sidebar |
| Sidebar | All 10 nav items + Settings; Material icons wght 200; star logo |

