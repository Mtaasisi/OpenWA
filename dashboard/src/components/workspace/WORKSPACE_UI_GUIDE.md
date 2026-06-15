# Workspace UI Guide

Shared patterns for the Social CRM Workspace UI.

## Canonical page shell (Shell A)

Every non-Inbox page should use the **Interakt workspace shell**:

```tsx
<div className="followups-interakt {page}-interakt">
  <WorkspacePageHeader
    title={t('page.title')}
    showSearch={false}
    showExport={false}
    showNewTask={false}
    extraActions={<>...</>}
  />
  <div className="followups-interakt__scroll">
    {/* KPIs, fu-chips, fu-glass-card content */}
  </div>
</div>
```

| Layer | Pattern |
|-------|---------|
| Page wrapper | `div.followups-interakt.{page}-interakt` |
| Header | `WorkspacePageHeader` → `.fu-header` |
| Scroll body | `.followups-interakt__scroll` |
| Cards | `.fu-glass-card` |
| Buttons / chips | `.fu-btn`, `.fu-btn--ghost`, `.fu-btn--primary`, `.fu-chip` |

## Settings embeds

Admin tools embedded in Settings (Sessions, Webhooks, API Keys, Logs, etc.) use **`WorkspaceEmbeddedPanel`** or the workspace toolbar pattern (`FilterBar` + `fu-btn`) — **no** legacy `PageHeader`.

```tsx
<WorkspaceEmbeddedPanel toolbar={<button className="fu-btn fu-btn--primary">...</button>}>
  {content}
</WorkspaceEmbeddedPanel>
```

Sessions inside **Channels** uses `<Sessions embedded embedContext="workspace" />`.

## Intentional exceptions

| Page | Notes |
|------|-------|
| **Inbox** | Custom Interakt/tactical/classic chrome — no `WorkspacePageHeader`. Empty/offline states link to `/channels?channel=whatsapp` with `fu-btn`. |
| **Login** | Standalone auth screen outside workspace shell. |

## Deprecated layout helper

`WorkspacePageLayout` (`dashboard/src/layouts/WorkspacePageLayout.tsx`) is **deprecated**. It now wraps `WorkspacePageHeader` for backward compatibility, but new pages should use the shell pattern above directly.

## Card style

- Use `.ws-metric-card` via `MetricCard` component
- Soft border (`var(--border)`), radius (`var(--radius)`), light shadow
- Link cards use `ws-metric-card--link` with hover border highlight

## Badge style

- **StatusBadge** — `success | warning | error | neutral` pill variants
- **ChannelBadge** — channel color dot + label; disabled at 55% opacity
- **AccountBadge** — neutral pill for session/account names

## Channel badge rules

- Only WhatsApp is active (`channels.ts`: `active: true`)
- Coming-soon channels: `disabled` or `comingSoon: true` — show on Dashboard and **Channels** page grids
- Use `channelSupportsAction(channelId, action)` before showing composer toolbar items

## Empty state rules

- Centered icon + title + description
- Optional CTA button below (`fu-btn`)
- Use when API returns zero rows, not for loading states

## Coming soon behavior

- `ComingSoonPanel` — dashed border, no backend calls
- Disabled filter chips — `disabled` prop, reduced opacity
- Placeholder pages: Content, Campaigns, Automations “More” tab, future channel cards

## Navigation

- Sidebar items: `dashboard/src/lib/workspace-nav.ts`
- **Pipeline** (`/pipeline`) is separate from **Quotes** (`/quotes`)
- **Themes** (`/themes`) — linked from Settings → Appearance only (not main nav)
- Legacy `/sessions` redirects to `/channels?channel=whatsapp`; UI links must use Channels URL
- **Viewer** role: Channels nav item hidden via `filterWorkspaceNavItems`

## Mobile bottom nav

`MobileBottomNav` shows five items: Inbox, Customers, Follow-ups, Dashboard, Settings (More). Secondary routes (Products, Quotes, Pipeline, Reports, AI) are reachable via sidebar on tablet/desktop or Settings/More — this is an accepted scope trade-off.

## Responsive behavior

| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥1024px) | Sidebar + main; inspector panel visible |
| Tablet (768–1023px) | Collapsible sidebar; use `SlideOverPanel` for detail |
| Mobile (<768px) | Bottom nav; inbox uses existing sheet patterns |

Use `useWorkspaceBreakpoint()` for panel mode switching.

## Active vs placeholder pages

| Real WhatsApp data | Placeholder UI |
|--------------------|----------------|
| Dashboard, Inbox, Customers, Follow-ups, Products, Channels (WhatsApp), Settings | Content, Campaigns, future channel filters |
| Quotes, Templates, Automations (rules + auto-reply), Reports, Pipeline | Automations “More”, group CRM leads/topics/rules tabs |
