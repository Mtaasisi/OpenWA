# WhatsApp Inbox — Chat List, Chat Section & CRM Panel

UI-only reference for the three main inbox panes. Themes (**Classic**, **Interakt**, **Tactical**) share the same structure but differ in labels and layout density where noted.

---

## 1. Chat list (left pane)

Panel label: **“Chats”** (Classic/Tactical; hidden label in Interakt).

### 1.1 Header

**Classic / Tactical**
- Title **“Conversations”**
- Total unread badge (e.g. “3 unread messages”)

**Interakt (Edition layout)**
- **Account dropdown** — card list with session status, phone, open count
- **Search** / **Filter** icons — inline search + advanced filter panel
- **Filter row**: Open (count), Newest sort, Me / All assignee toggle
- Advanced filter panel: all filters + lead source dropdown

### 1.2 Search
- Placeholder: “Search conversations…” (Tactical: “DECRYPT_SEARCH_ID...”)
- Shortcut: `Ctrl/⌘K` or `/`

### 1.3 Filters

**Classic & Tactical — filter chips** (keys `1`–`6` = first six):

| Filter | Badge |
|--------|-------|
| All | — |
| Unread | Count |
| Needs reply | — |
| Needs human | Count |
| AI opt-out | Count |
| Private | — |
| Groups | — |
| Resolved | — |

Plus **lead source** dropdown: All sources + configured sources.

**Interakt — Command Center chip row + advanced panel**
- Visible chips: Open, Overdue, AI Active, Me, All
- Advanced panel: all filters including Needs human, Groups, Resolved, etc.
- Lead source dropdown in advanced panel

### 1.4 Conversation row

Click a row to open the chat.

**Every theme**
- **Avatar** (photo or initials; offline ring if session disconnected)
- **Name** (or phone/chat ID)
- **Time** of last message
- **Preview** (or “No preview”)

**Classic extras**
- Session badge (all-accounts mode)
- Direct / Group badge
- Phone / chat ID subline
- Lead source badge
- AI pills: “AI replying…”, “Needs human”
- Status chips: Needs reply, Replied, Resolved, Follow-up, Group
- Numeric unread badge

**Interakt (Edition)**
- Relative time (“now”, “5 min”)
- Clean preview row — no chip row
- **Unread dot** on active row highlight

**Tactical extras**
- “ID: …” line
- Chips: IDENTIFIED, URGENT
- Lead source badge
- Session node tag (2 letters, all-accounts mode)

### 1.5 Empty states
- Loading spinner
- “No conversations yet…”
- “No conversations match your search or filter.”
- Offline: “No stored conversations for this account yet.”

---

## 2. Chat section (center pane)

Panel label: **“Messages”**. Includes header, thread, composer, and modals opened from the composer.

### 2.1 Empty state (no chat selected)
- **“Choose a conversation”**
- “Pick a chat from the list to view messages and customer details.”

### 2.2 Chat header

**Classic**
- **Back** (mobile or collapsed list)
- Avatar, session badge, session status
- Contact name, chat ID
- Status chips, **“AI is typing…”** pill
- **Customer panel** button (opens CRM drawer on narrow screens)

**Interakt (Edition)**
- **Back** (mobile / collapsed list)
- Contact name + WhatsApp channel subtitle (green dot)
- **Header actions**: Resume AI, Send Quote, Follow-up | Close chat
- **Customer 360** button when CRM is in drawer mode (<860px)
- **AI awareness strip** with Take Over when AI is active

**Tactical**
- Back, avatar, title, READY pill
- Meta: session // chat ID
- Chips (CLIENT, Group, …), AI typing pill
- CRM drawer button

### 2.3 Banners
- **Disconnected:** “WhatsApp is not connected…” + **Start session**
- **Offline history:** stored-messages-only hint

### 2.4 Message thread
- **Load older messages**
- Loading / “No messages in this thread yet”
- **Date separators** (Today, Yesterday, or date)
- Auto-scroll on new messages

### 2.5 Message bubbles

**Classic & Interakt**
- Incoming left / outgoing right
- WhatsApp formatting (bold, italic, links, etc.)
- **Copy message** + “Copied”
- **Read more / Show less**
- **Media:** image (open tab), video/audio controls, document download; loading / unavailable states
- **AI badge** on auto-replies
- Outgoing status: Sending…, Sent, Delivered, Read, Failed (Classic) or read tick (Interakt)
- **Interakt incoming:** initials beside bubble
- **Interakt outgoing:** “Business reply” badge on staff messages

**Tactical**
- REMOTE_SRC / LOCAL_OP labels, framed style
- AI badge, timestamp with seconds, delivery ticks

**Album messages**
- Grouped images in one bubble (thumbnail grid + caption)

### 2.6 Composer

**Classic**
- Error banner
- **Start session** when offline
- **Attach image** (JPEG, PNG, WebP, GIF)
- **Quick replies** picker
- **Quote builder** trigger
- Textarea + **Send** (disabled if empty, offline, or read-only)
- Hint: Enter send · Shift+Enter newline · shortcuts

**Interakt — Reply | Notes | Follow-up | Quote tabs**

| Tab | UI |
|-----|-----|
| **Reply** | Toolbar (§2.7) + textarea + **Send** |
| **Notes** | Internal note textarea + **ADD** |
| **Follow-up** | Reason, date, time + **Schedule Follow-up** |
| **Quote** | Embedded quote builder |
| Tab bar | **Sending from** account chip (right side) |

**Tactical**
- Error banner, start-session link
- Textarea (“ENTER_TRANSMISSION_DATA…”)
- Attach, quick replies, quote builder + **Send**

**Placeholders when blocked**
- “Session must be ready to send”
- “Connect WhatsApp for this account to send messages”
- “You do not have permission to send messages”

### 2.7 Interakt composer toolbar (Reply tab)

| Button | Opens |
|--------|---------|
| $ Quote | Quote builder |
| Package Product | Product catalog picker |
| List Lists | Quick replies (“Lists”) |
| Zap Quick replies | Quick replies |
| Paperclip Attach | Image picker |
| Templates | Follow-up templates picker |
| Emoji | Emoji grid modal |

### 2.8 Modals & pickers (from chat composer)

**Quick replies**
- Search, category filter, favorites toggle
- Template list (star to favorite)
- Preview with variables → **Insert into composer**
- Edit mode (if permitted): name, category, body, save

**Quote builder**
- Create / select quote, status, lead source, total
- Line items (qty × price, stock, remove)
- Add product, custom item, delivery fee
- WhatsApp preview + refresh
- Send to WhatsApp, mark accepted/rejected, convert to sale

**Product catalog** (Interakt toolbar; Classic/Tactical via CRM only)
- Offline banner + start session
- Search, refresh stock (INAUZWA)
- Grid / list toggle
- Checkboxes: in stock only, IMEI devices, send image, refresh before send
- Product cards → variant picker or send
- Send-all-variants option; confirm dialog (Tactical)

**Follow-up templates** (Interakt only)
- Search, list, preview → **Insert**

**Emoji picker** (Interakt only)
- Grid of emojis → insert at cursor

**Keyboard shortcuts** (`?`)
- Enter send, Shift+Enter newline, Esc back, search, compose, J/K chats, filters 1–6, attach, CRM toggle, list toggle

### 2.9 Mobile (chat section)
- &lt;680px: list OR chat pane; **Back** returns to list
- CRM opens as drawer from header button

---

## 3. CRM panel (right pane)

Panel label: **“Customer”**. Side panel on wide screens; **drawer** (overlay + close X) on narrow screens.

### 3.1 Empty state
- “Select a conversation to see customer context”

### 3.2 AI block (private chats only; hidden for groups)

| Control | UI |
|---------|-----|
| AI auto-reply for this chat | Checkbox + hint |
| Customer opted out of AI | Checkbox + hint |
| AI handling | Badge: AI ready / AI replying… / Needs human / Staff handling |
| Take over / Resume AI | Buttons |
| Hints | Escalation / opt-out messages when relevant |

### 3.3 Classic CRM

**Header:** avatar, name, chat ID, session, status

**Tabs: Details | Lead & follow-up**

**Details**
- Read-only: display name, phone/chat ID, account, chat type, lead source, status, follow-up due, unread, messages stored, last activity, linked customer
- Editable: customer name, phone, external customer ID
- Lead source select/badge
- **Browse catalog** → product picker

**Lead & follow-up**
- **Mark resolved** / **Reopen conversation**
- Internal note + save
- Follow-up datetime + **Clear**
- Pipeline **stage** dropdown
- Follow-up history
- Lead outcome actions (§3.6)

**Dirty state:** “Save changes” + unsaved warning

### 3.4 Interakt CRM (Customer 360)

**Header:** “Customer 360” title + profile hero card with stage/follow-up/AI chips

**Tabs: Details | Lead | Products | Quotes | Timeline**

**Details**
- Profile card + **Edit Details** modal
- Quick actions (edit, catalog, schedule, pipeline)
- AI controls (auto-reply, opt-out, handling)

**Lead & follow-up**
- Follow-up scheduler, pipeline stage, history, outcome actions

**Products**
- Recent products + **Browse catalog**

**Quotes**
- Quote list for thread + embedded quote builder

**Timeline**
- Product sends, notes, AI state, follow-up history rows

**Resolve**
- **Resolve** header button opens reason + note modal before closing chat

### 3.5 Tactical CRM

**Header** + unsaved warning + same AI block

**Tabs: Overview | Notes | Customer**

**Overview**
- Contact details (read-only)
- **Mark resolved**
- Follow-up scheduler, “Reminder scheduled”
- Activity: unread, message count, external ID set/not

**Notes**
- Internal note textarea
- Lead source badge, stage, history, outcome actions

**Customer**
- Name, phone, external ID (with hints)
- Embedded **product picker** (confirm before send)
- **Record sale** block

**Footer:** **Save changes** (“Sync”) + message

### 3.6 Lead outcome actions (Lead / Notes tabs)

| Action | UI |
|--------|-----|
| Mark won | Button |
| Close lost | Button → reason, notes, checkboxes, confirm |
| Link sale ID | Input + link button |

### 3.7 Modals & pickers (from CRM)

**Product catalog** (Browse catalog / embedded)
- Same UI as §2.8 product picker
- **Manage products** link

**Record sale**
- Current lead source badge
- Sale source select, optional amount
- Sale ID input + **Generate**
- **Complete sale**, **Set payment pending**
- Shows linked sale when already set

**Edit Smart Card** (Interakt)
- Modal: name, phone, external ID, note

### 3.8 Resolve & notes by theme

| Action | Classic | Interakt | Tactical |
|--------|---------|----------|----------|
| Mark resolved | Lead tab | Chat header | Overview tab |
| Internal notes | Lead tab | Composer Notes tab | Notes tab |

### 3.9 Mobile (CRM)
- &lt;1020px (Classic/Tactical) or &lt;860px (Interakt): drawer from chat header
- Tap overlay or Esc to close
- Unsaved changes → confirm before switching chat

### 3.10 Read-only role
- No editable CRM fields, no lead outcome buttons, no save bar

---

## Theme quick reference (these three panes)

| | Classic | Interakt | Tactical |
|---|---------|----------|----------|
| Chat list filters | 8 chips | Command Center chips + panel | 8 chips |
| Chat list row | Full metadata | Chips + session + AI | Terminal + node |
| Chat header | Standard | Command Center actions + AI strip | Terminal meta |
| Composer | Single box | 4 tabs + toolbar | Terminal framed |
| Product in composer | No | Yes | No (CRM only) |
| CRM tabs | Details, Lead | Details, Lead, Products, Quotes, Timeline | Overview, Notes, Customer |

---

## Interakt app shell (sidebar)

When the **Interakt** theme is active, the global sidebar switches to the Command Center navigation:

| Item | Route | Badge |
|------|-------|-------|
| Inbox | `/inbox` | Unread open conversations |
| Customers | `/customers` | — |
| Follow-ups | `/followups` | Overdue queue count |
| Products | `/products` | — |
| Quotes | `/pipeline` (+ sub-routes) | — |
| Templates | Settings → Quick replies integration | — |
| Auto Reply | Settings → AI integration | — |
| My Performance | `/followups/reports` | — |
| **Admin** | | |
| Reports | `/pipeline/reports` | — |
| Sessions | `/sessions` | — |
| Settings | `/settings` (non-integration sections) | — |

Footer shows role avatar + logout. **New chat** button at top of sidebar opens the inbox new-chat flow.
