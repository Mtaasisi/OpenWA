# Inbox — feature inventory

Checklist of what the **Inbox** section includes today (`/inbox` in the dashboard). Use this when planning changes, QA, or comparing against designs.

**Route:** `/inbox`  
**Main files:** `dashboard/src/pages/Inbox.tsx`, `InboxClassicView.tsx`, `InboxTacticalView.tsx`, `useInboxController.ts`, `InboxCustomerPanel.tsx`, `InboxTacticalCrmPanel.tsx`, `inbox-helpers.ts`, `inbox-media.ts`, `Inbox.css`, `InboxTactical.css`  
**API:** `src/modules/message/inbox.controller.ts`, `message.service.ts`, `inbox-crm.service.ts`

---

## 1. Page shell & empty states

| Feature | Description |
|--------|-------------|
| Page title & subtitle | “Inbox” — view and reply to WhatsApp conversations |
| Document title | Browser tab uses i18n `inbox.title` |
| Loading (no sessions loaded yet) | Full-page spinner while sessions list loads |
| No sessions | Empty state + link to **Sessions** (`/sessions`) to create/link an account |
| Three-column layout (desktop) | Conversation list · message thread · customer CRM panel |
| Full viewport height | Inbox fills available main content height (minimal scrollbars on inner regions) |

---

## 2. Toolbar (top)

| Feature | Description |
|--------|-------------|
| **All accounts** view | Unified inbox: conversations from every session the API key can access |
| **One account** view | Conversations for a single selected session only |
| Session dropdown | Visible in “One account” mode; lists all sessions with `name (status)` |
| Manual **Refresh** | Refetches sessions, conversations, and open thread messages |
| Syncing indicator | “Syncing…” after ~400ms while conversations/messages are refetching |
| WebSocket reconnecting | “Reconnecting…” when `/events` socket disconnects |
| **Start session** (toolbar) | In “One account” mode when selected session is not `ready`; starts WhatsApp session |
| Session not ready hint | Text when one-account session is offline |
| Connected hint | Green “Connected — you can send messages” when send is allowed |
| Unsaved CRM guard | Switching view mode (all ↔ one) blocked if CRM has unsaved edits (confirm dialog) |

---

## 3. Conversation list (left column)

### 3.1 Header & search

| Feature | Description |
|--------|-------------|
| “Conversations” label | Column title |
| Total unread badge | Header badge (`99+` cap) — sum of `unreadCount` across loaded conversations |
| Search box | Filters by display name, chat ID, session name, last preview, **CRM customer name**, **linked external ID** |

### 3.2 Filter chips

| Filter | Rule |
|--------|------|
| **All** | Every conversation |
| **Unread** | `unreadCount > 0` |
| **Needs reply** | Last message incoming and not resolved |
| **Private** | Not a group (`@g.us`) |
| **Groups** | Group chats |
| **Resolved** | CRM/thread marked resolved |

### 3.3 List items

| Feature | Description |
|--------|-------------|
| Avatar initials | Derived from conversation title (customer name → display name → formatted ID) |
| Session badge | Colored pill with session name ( **All accounts** mode only ) |
| Title | `customerName` → `displayName` → formatted phone/chat ID |
| Subtitle | Formatted chat ID (phone, group, or linked device) |
| Last message time | Today = time only; older = locale date |
| Last preview | Snippet or “No preview” |
| Status chips | Group, Follow-up, Resolved, Needs reply, Replied (logic in `conversationStatusChips`) |
| Unread count badge | Per row; capped at `99+` |
| Unread row styling | Visual emphasis when `hasUnread` |
| Active selection | Highlight for open thread |
| Click to open | Opens thread; mobile switches to chat pane |

### 3.4 Empty states (list)

| State | Message |
|-------|---------|
| No conversations at all | Different copy if any session is ready vs all offline (stored history only) |
| No filter/search matches | “No conversations match your search or filter.” |

---

## 4. Chat thread (center column)

### 4.1 Empty / selection

| Feature | Description |
|--------|-------------|
| No conversation selected | “Choose a conversation” placeholder |

### 4.2 Chat header

| Feature | Description |
|--------|-------------|
| Back button | Mobile only — returns to list (with unsaved CRM confirm) |
| Avatar | Same initials as list |
| Session badge | All-accounts mode |
| Session status pill | e.g. `ready`, `qr_ready`, `failed` (i18n `sessionStatus.*`) |
| Contact title & formatted chat ID | |
| Status chips | Same set as list row |
| **Customer** drawer button | Tablet/mobile (≤1024px) — opens CRM drawer |

### 4.3 Connection banners

| Feature | Description |
|--------|-------------|
| Thread disconnected banner | When open thread’s session is not `ready`: explains stored history only + **Start session** for that account |
| Composer start link | Text link above textarea to start session when disconnected but user can write |

### 4.4 Messages

| Feature | Description |
|--------|-------------|
| Message list | Incoming/outgoing bubbles |
| Date separators | Today / Yesterday / weekday date between messages |
| Auto-scroll | Smooth scroll to bottom when new messages appear |
| **Load older messages** | Pagination: +100 messages per click (`INBOX_MESSAGE_PAGE_SIZE`) |
| Empty thread | “No messages in this thread yet” |
| Loading state | Spinner while first page loads |
| Skipped types | System/protocol types filtered out (`notification_template`, `e2e_notification`, `gp2`, `protocol`) |

### 4.5 Message bubble (`InboxMessageBubble`)

| Feature | Description |
|--------|-------------|
| Direction styling | Incoming vs outgoing layout |
| Text body | Plain text |
| Long text collapse | >420 chars — “Read more” / “Show less” |
| Copy message | Clipboard; shows “Copied” feedback |
| Outgoing delivery status | pending · sent · delivered · read · failed (i18n) |
| Timestamp | Per message |
| **Media messages** | image, sticker, video, audio, ptt, document (and `metadata.media`) |
| Media loading | Spinner + “Loading media…” |
| Media unavailable | When session offline or API 404 — “Start session to load media” |
| Media display | Image/sticker preview; video/audio players; document download link |
| Media API | `GET /api/sessions/:id/messages/:messageId/media` |

### 4.6 Composer

| Feature | Description |
|--------|-------------|
| Textarea | Multi-line draft |
| **Enter** send | **Shift+Enter** new line |
| Send button | Green when connected; disabled/grey when not |
| Optimistic send | Outgoing bubble with `pending` status until API succeeds |
| Send error | Alert above composer; removes optimistic message |
| Disabled reasons | Viewer role (no write); session not ready (disconnected) |
| Placeholder copy | Changes per permission/connection state |
| Composer hint | “Enter to send · Shift+Enter for new line” |

---

## 5. Customer CRM panel (right column / drawer)

### 5.1 Layout

| Feature | Description |
|--------|-------------|
| Desktop panel | Fixed third column when width > 1024px |
| CRM drawer | Overlay drawer ≤1024px; close button + overlay click |
| Empty state | Icon + “Select a conversation to see customer context” |
| Loading | Spinner while CRM fetch in progress |

### 5.2 Header (per thread)

| Feature | Description |
|--------|-------------|
| Large avatar initials | |
| Customer name | From conversation title helper |
| Formatted chat ID subtitle | |
| Session badge + CRM status pill | Needs reply / Replied / Resolved |

### 5.3 Tabs

#### Details (read-only)

| Field | Source |
|-------|--------|
| Display name | WhatsApp `displayName` |
| Phone / chat ID | Formatted label (private / group / linked device) |
| WhatsApp account | Session name |
| Chat type | Private vs group (icons) |
| Status | Needs reply / Replied / Resolved |
| Follow-up | Due or past follow-up datetime (if set) |
| Unread count | |
| Messages in inbox | Stored message count (+ tooltip hint) |
| Last activity | Timestamp |
| Linked customer block | Name, phone, external ID (if any CRM data) |

#### Actions (editable if operator/admin)

| Action | Description |
|--------|-------------|
| Mark resolved / Reopen | Toggles `resolved` immediately via API |
| Internal note | Team-only textarea (saved with “Save changes”) |
| Follow-up reminder | `datetime-local` input |
| Clear follow-up | Button when date is set |

#### Customer record (editable if operator/admin)

| Field | Description |
|-------|-------------|
| Customer name | Overrides display in list/header when set |
| Customer phone | |
| External customer ID | CRM/ERP link |

### 5.4 Save flow

| Feature | Description |
|--------|-------------|
| Dirty detection | Note, follow-up, name, phone, external ID vs server |
| Unsaved warning | Orange hint in panel; confirm when leaving thread or mobile back |
| **Save changes** button | Appears when dirty; saves all CRM fields in one request |
| Save success/error toast text | Inline message (2s) |

### 5.5 CRM behavior

| Feature | Description |
|--------|-------------|
| Reset tab on thread change | Defaults to **Details** |
| Tab state | `details` · `actions` · `record` |
| `hideTitle` | Panel title hidden when header already shows context |

---

## 6. Real-time, polling & data

| Feature | Description |
|--------|-------------|
| Fast poll (5s) | When at least one relevant session is `ready` |
| Slow poll (30s) | When no ready session (refresh stored history) |
| Poll targets | Sessions (10s), conversations, open thread messages |
| React Query | Stale times, background refetch, window focus refetch, placeholder data |
| WebSocket | Subscribes to `message.received` / `message.sent` on `/events` |
| WS scope | All sessions (`*`) in unified mode; single session in one-account mode |
| WS invalidation | Refreshes inbox queries; clears pending optimistic on matching thread |
| Mark as read | On open thread: unified `PATCH /inbox/conversations/read` or per-session route; updates DB + WhatsApp seen when possible |
| Read API role | VIEWER+ (mark-read allowed for viewers) |
| CRM write API role | OPERATOR+ |

---

## 7. Permissions (API key roles)

| Role | Inbox capabilities |
|------|-------------------|
| **Viewer** | Read conversations/messages/CRM; mark read; no send; CRM fields disabled |
| **Operator** | Send messages; edit/save CRM |
| **Admin** | Same as operator |

---

## 8. Responsive & UX polish

| Breakpoint | Behavior |
|------------|----------|
| ≤768px (mobile) | List OR chat pane; back to list; CRM in drawer |
| ≤1024px (compact) | CRM hidden from column; drawer button in chat header |
| >1024px | Three columns |
| Minimal scrollbars | Thin thumbs on list, messages, CRM tab panel |
| i18n | English + Hebrew (`inbox.*`, `sessionStatus.*`) |
| RTL | Layout/sidebar aware (global app) |

---

## 9. Backend API (inbox-related)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/inbox/conversations` | Unified conversation list (all allowed sessions) |
| `PATCH` | `/api/inbox/conversations/read` | Mark read (body: `sessionId`, `chatId`) |
| `GET` | `/api/inbox/threads/crm` | CRM for one thread |
| `PATCH` | `/api/inbox/threads/crm` | Update CRM |
| `GET` | `/api/sessions/:id/conversations` | Per-session conversations (one-account mode) |
| `PATCH` | `/api/sessions/:id/conversations/:chatId/read` | Mark read (one-account mode) |
| `GET` | `/api/sessions/:id/messages` | List messages (`chatId`, `limit`, `offset`, `total`) |
| `POST` | `/api/sessions/:id/messages/text` | Send text (composer) |
| `GET` | `/api/sessions/:id/messages/:messageId/media` | Download media blob |

**Conversation model highlights:** `sessionId`, `sessionName`, `chatId`, `displayName`, `lastPreview`, `lastMessageAt`, `lastDirection`, `unreadCount`, `messageCount`, `resolved`, `hasFollowUp`, `customerName`, `linkedExternalId`.

**CRM model:** `resolved`, `internalNote`, `followUpAt`, `customerName`, `customerPhone`, `linkedExternalId`, `updatedAt`.

---

## 10. Chat ID & display helpers

| Feature | Description |
|--------|-------------|
| Phone formatting | International spacing; 10-digit US-style; long group IDs grouped |
| Group detection | `@g.us` |
| Linked device | `@lid` suffix label |
| Title priority | CRM customer name → display name → formatted ID |
| Avatar initials | 1–2 letters from words |

---

## 11. Tactical Overlay theme (`/themes` → apply **Tactical Overlay**)

When the active dashboard theme has `effects: tactical`, `Inbox.tsx` renders **`InboxTacticalView`** instead of **`InboxClassicView`**. State (sessions, threads, send, CRM dirty, mobile panes) comes from the shared **`useInboxController`** hook.

### 11.1 Layout & chrome

| Area | Behavior |
|------|----------|
| App sidebar | Hidden on `/inbox` (`layout--tactical-inbox`) — full-bleed tactical shell |
| Global toolbar | Brand (`inbox.tactical.brand`), **All nodes** / **Single node**, session pill, refresh, WS reconnect, sync, connected hint |
| **Start session** | Toolbar button in single-node mode when selected session is not `ready` |
| User menu (avatar) | Links to Dashboard (`/`), Settings appearance (`/settings?section=appearance`), Logout |
| Session rail | 64px column — quick switch between sessions; **settings** icon → `/settings` (hidden ≤768px) |
| Conversation list | ~340px — search, six filter chips, tactical list chips |
| Chat thread | Grid background, HUD bubbles (`InboxTacticalMessageBubble`), tactical composer placeholder |
| CRM panel | Inline column **>1024px**; **drawer** ≤1024px (header user icon in chat) |
| Styles | `InboxTactical.css` + `styles/tactical-overlay.css` — palette `#22d3ee` on `#02060c` |

Classic inbox UI remains for all other themes.

### 11.2 Filters (tactical list)

Same rules as §3.2: **All**, **Unread**, **Needs reply**, **Private**, **Groups**, **Resolved**.

### 11.3 Responsive breakpoints

| Viewport | Behavior |
|----------|----------|
| **Desktop (>1024px)** | Rail + list + thread + inline CRM (360px) |
| **Tablet (769–1024px)** | CRM hidden inline; open via chat-header **user** icon → slide-in drawer |
| **Mobile (≤768px)** | Session rail hidden; **one pane** at a time (`tac--show-list` / `tac--show-chat`); **back** arrow in chat header returns to list; CRM via same drawer |

### 11.4 CRM (tactical)

| Tab (UI label) | Internal id | Content |
|----------------|-------------|---------|
| **Overview** | `telemetry` | Contact details, resolved toggle, follow-up datetime, activity stats |
| **Notes** | `intel` | Internal note only (same field as classic CRM) |
| **Customer** | `gear` | Customer name, phone, linked external ID; product picker to send catalog items |

Save shows success/error feedback when CRM is dirty (same PATCH as classic). Unsaved warning when switching threads or view mode still applies via controller.

### 11.5 Tactical QA checklist

Prerequisites: dashboard `http://localhost:2886`, API key `dev-admin-key`, at least one session.

1. **Enable theme:** Settings → Appearance → **Manage themes** (or `/themes`) → **Tactical Overlay** → Apply → open `/inbox`.
2. **Desktop (1280×800):** Rail visible; list + thread + CRM inline; filters **Groups** / **Resolved** work; send text if session `ready`.
3. **Tablet (768×1024):** No inline CRM; tap user icon in chat → drawer opens; close via X or overlay click.
4. **Mobile (375×812):** List only initially; open conversation → chat pane; **back** returns to list; CRM drawer from user icon.
5. **Toolbar:** User menu → Dashboard / Settings / Logout; **Start session** when single-node + offline.
6. **Disconnected:** Banner in thread; composer disabled; stored history still visible.
7. **Theme switch:** Apply a non-tactical theme → classic three-column inbox returns; app sidebar visible again.

---

## 12. Not in scope today (gaps / future ideas)

Use this section so “must have” vs “nice to have” stays clear:

- Attachments / media **send** from inbox composer (text only)
- Reply-to / quote specific message
- Typing indicators
- Assign conversation to agent
- Tags/labels beyond resolved + follow-up
- Bulk actions (archive many, mark all read)
- Full-text search inside message bodies
- Push/browser notifications
- Server-side search/filter pagination (all client-side on loaded list)
- Export conversation
- Block/mute contact from inbox
- Voice note recording in UI
- Read receipts per message in UI (only aggregate status on outgoing)

---

## 13. QA smoke checklist

### Classic inbox (any non-tactical theme)

- [ ] Open `/inbox` with at least one linked session
- [ ] Toggle **All accounts** / **One account** and pick a session
- [ ] Search and each filter chip (including **Groups**, **Resolved**)
- [ ] Open private chat and group chat
- [ ] Unread badge and mark-read on open
- [ ] Send text while session `ready`; optimistic bubble then server message
- [ ] Composer disabled when session offline; start session from banner/link
- [ ] Load older messages when `total > displayed`
- [ ] Image/document bubble + media download when session ready
- [ ] CRM: Details / Actions / Customer record tabs, save, resolved toggle, unsaved warning
- [ ] Mobile: list ↔ chat ↔ CRM drawer (≤1024px)
- [ ] Viewer role: read-only composer and CRM
- [ ] Hebrew strings render; RTL layout acceptable

### Settings (`/settings`)

- [ ] All sections visible for admin; operators see Notifications/API read-only
- [ ] Appearance: mode, theme select, language; **Manage themes** opens `/themes` with back link
- [ ] Inbox defaults save to localStorage and apply on next inbox visit
- [ ] Integrations hub opens each integration inline (not redirect to `/products`)
- [ ] INAUZWA sync configurable under `integration=products`; catalog link optional
- [ ] **All integrations** returns to hub; sidebar **Integrations** resets hub
- [ ] Mobile: section menu → panel → **Sections** back
- [ ] Clear local preferences resets inbox/product defaults

### Tactical Overlay (see §11.5)

- [ ] Apply **Tactical Overlay**; app sidebar hidden on inbox
- [ ] Desktop: rail + inline CRM; tablet/mobile: CRM drawer only
- [ ] Mobile list ↔ chat via back button
- [ ] Toolbar user menu + start session (single-node offline)
- [ ] Tactical CRM tabs **Overview** / **Notes** / **Customer**; save when dirty

---

## 14. Settings page (`/settings`)

Hub for preferences moved out of the main sidebar. **Themes** and **Plugins** are no longer top-level nav items; they are linked from here.

**Files:** `dashboard/src/pages/Settings.tsx`, `Settings.css`, `dashboard/src/lib/user-preferences.ts`

### 14.1 Sidebar navigation

| Main nav | Moved into Settings |
|----------|---------------------|
| Dashboard, Sessions, Inbox, Products, **Settings** | **Webhooks**, **Infrastructure**, **API keys**, **Plugins** → Integrations |
| | **Message tester** & **Logs** → API & system → Developer tools |
| | **Themes** → Appearance → Create & edit (`/themes`) |

Footer **appearance** button opens `/settings?section=appearance` (does not toggle theme inline).

### 14.2 Sections

| Section | Who | What |
|---------|-----|--------|
| **Account** | All | Role badge, masked API key, API health, change key / logout |
| **Appearance** | All | Light / dark / system, **theme gallery** (click card to apply), link to create/edit themes (`/themes`), language |
| **Inbox** | All | Default view (all vs one account), default WhatsApp account, product-send defaults (localStorage) |
| **WhatsApp accounts** | All | Create, QR link, start/stop sessions (embedded from Sessions page) |
| **Notifications** | All view; admin edit | Webhook alerts, email notifications |
| **API & system** | All view; admin edit | Auto-reconnect, debug mode, rate limit, API docs; **developer tools** hub: Message tester & audit logs inline (`?section=api&tool=…`) |
| **Integrations** | All | In-app hub: configure INAUZWA, webhooks, infrastructure, plugins, API keys without leaving Settings (see §14.5) |
| **Data & privacy** | All | Clear browser inbox/product preferences |
| **About** | All | App name, API base path, shortcut to Inbox |

Server settings (`PUT /api/settings`) apply until API restart; non-admins see values read-only with a banner.

### 14.3 Mobile (≤768px)

- Section **menu** first; tap a section to open its panel.
- **Sections** back control returns to the menu.
- Deep links (`?section=appearance`) open the panel directly.

### 14.4 Local preferences (`user-preferences.ts`)

| Key | Used by |
|-----|---------|
| `inboxDefaultView` | `useInboxController` initial view mode |
| `inboxDefaultSessionId` | Default session when inbox is in single-account mode |
| `productInStockOnly`, `productIncludeDevices`, `productIncludeImage`, `productRefreshBeforeSend` | Inbox product picker |

### 14.5 Integrations (in Settings)

**Route:** `/settings?section=integrations`  
**Drill-in:** `?section=integrations&integration=products|webhooks|plugins|infrastructure|api-keys`  
**Files:** `dashboard/src/components/settings/SettingsIntegrationsSection.tsx`, `InauzwaIntegrationPanel.tsx`

| Integration | Configure in Settings | Legacy route |
|-------------|----------------------|--------------|
| **Product catalog (INAUZWA)** | Branch, vendor, sync mode, auto-sync, sync now | `/products` — SKU catalog only |
| **Webhooks** | Full webhook CRUD embedded | `/webhooks` → redirect |
| **Plugins** (admin) | Full plugins UI embedded | `/plugins` → redirect |
| **Infrastructure** | Full infra config embedded | `/infrastructure` → redirect |
| **API keys** (admin) | Full API key management embedded | `/api-keys` → redirect |

Use **All integrations** (back control) to return to the hub. Legacy paths redirect here with a dismissible notice.

---

### 14.6 Developer tools (in Settings → API & system)

**Route:** `/settings?section=api`  
**Drill-in:** `?section=api&tool=message-tester` | `?section=api&tool=logs`

| Tool | Purpose |
|------|---------|
| Message tester | Send text/media to a phone or group via API |
| Audit logs | Search, filter, export CSV, QR noise cleanup (admin) |

Use **All tools** to return to the hub. Bookmarks to `/message-tester` and `/logs` redirect here with a dismissible notice. Standalone full-page routes are no longer in the main sidebar.

*Last updated: Sidebar trimmed to core workflow; integrations and dev tools redirect to Settings.*
