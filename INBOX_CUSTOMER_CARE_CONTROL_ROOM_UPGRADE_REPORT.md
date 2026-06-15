# Inbox Customer Care Control Room — Upgrade Report

**Date:** 2026-06-13  
**Scope:** Incremental upgrade (no rebuild). Existing inbox features preserved.

---

## Files scanned (inbox architecture map)

### Backend (`src/modules/message/`, related)
| Area | Files |
|------|--------|
| REST API | `inbox.controller.ts`, `message.controller.ts`, `session.controller.ts` |
| Core services | `message.service.ts`, `inbox-crm.service.ts`, `inbox-thread-summary.service.ts`, `inbox-transfer.service.ts` |
| **New** | `inbox-thread-state.service.ts`, `inbox-send-pipeline.service.ts`, `inbox-ai-diagnosis.service.ts`, `inbox-thread-event.service.ts`, `inbox-cursor.util.ts` |
| Entities | `inbox-thread-crm.entity.ts`, `inbox-thread-summary.entity.ts`, `inbox-thread-read.entity.ts`, `message.entity.ts`, **`inbox-thread-event.entity.ts`** |
| DTOs | `inbox-conversations-query.dto.ts`, `inbox-thread-crm.dto.ts`, `inbox-send-*.dto.ts` |
| Migration | `1781060000000-AddInboxThreadEvents.ts` |

### Frontend (`dashboard/src/`)
| Area | Files |
|------|--------|
| Pages | `Inbox.tsx`, `InboxWorkspaceView.tsx`, `InboxClassicView.tsx`, `useInboxController.ts`, `inbox-helpers.ts`, `InboxCustomerPanel.tsx` |
| Workspace | `components/inbox-workspace/InboxComposer.tsx`, `InboxFilterBar.tsx`, **`InboxHealthStrip.tsx`**, **`InboxAiDiagnosisPanel.tsx`** |
| CRM | `components/inbox-crm/*`, `InboxCrmAiControls.tsx`, `InboxInteraktAiStatusStrip.tsx` |
| CSS | `Inbox.css`, `InboxTactical.css`, `interakt-inbox.css`, `tactical-inbox-bridge.css`, `inbox-speed.css`, `inbox-crm/inbox-crm.css`, **`InboxHealthStrip.css`**, **`InboxAiDiagnosisPanel.css`** |
| API | `services/api.ts` (`inboxApi`) |
| Identity | **`lib/inbox-staff-identity.ts`** (auth staffId first, localStorage fallback) |

---

## Current structure (preserved)

```
Top:    List header + health strip + filters + account/session
Left:   Work queue / conversations (virtual + infinite scroll)
Center: Chat + message timeline
Right:  Customer Action Center (InboxCustomerPanel / CRM router)
Bottom: Composer (+ tools, quote bar, AI strip)
```

All existing flows remain: unified + single-session inbox, AI pause/resume, CRM, follow-ups, product/quote/quick replies, media, transfer, resolve, search, notifications, groups.

---

## Issues found (before upgrade)

1. **Thread state** relied on `lastDirection === 'incoming'` — “Asante/OK” falsely flagged as needs reply.
2. **Single-session** `GET /sessions/:id/conversations` used a separate code path without unified filters/pagination.
3. **Assignment “Me”** could mismatch when localStorage staff id ≠ authenticated `staffId`.
4. **Send paths** (text/media) duplicated gate logic; no shared audit/event trail.
5. **AI diagnosis** existed only via staff AI agent tools — not per-chat in inbox.
6. **No business event timeline** in chat view.
7. **CSS** spread across 6+ inbox stylesheets with overlapping selectors.

---

## Implemented in this upgrade

### Phase 2 — Thread State Engine ✅
- `InboxThreadStateService` with states: `needs_reply`, `waiting_customer`, `ai_handling`, `ai_needs_human`, `human_handling`, `followup_*`, `hot_lead`, `opted_out`, `group_lead_only`, `send_failed`, etc.
- Acknowledgment detection (“Asante”, “Sawa”, “OK”, 👍).
- Fields exposed on `ConversationSummary` / frontend `Conversation`: `threadState`, `threadStateReason`, `needsReply`, `needsHuman`, …

### Phase 3 — Work queue filters ✅ (partial UI)
- Backend `queue` query param + `includeCounts`.
- Frontend filter keys extended: `my_work`, `hot_leads`, `waiting_payment`, `waiting_stock`, `followup_due`, `unassigned`, `failed_sends`.
- `buildUnifiedInboxQuery()` maps filters → server `queue`.

### Phase 4 — Unified endpoint ✅
- `GET /api/inbox/conversations` remains canonical.
- `GET /sessions/:id/conversations` now delegates to `queryUnifiedConversations` with same filters/context.

### Phase 5 — Cursor pagination ✅ (backend)
- `cursor` + `nextCursor` / `hasMore` on unified response.
- Offset/limit still supported for backward compatibility.

### Phase 6 — Assignment identity ✅
- `getInboxStaffId()` prefers `sessionStorage` auth staffId (`openwa_key_id`).
- Server `assignedToMe` uses `ctx.apiKeyId` (unchanged, correct for JWT/API key auth).

### Phase 7 — AI handover strip ✅ (existing + health)
- Existing `InboxInteraktAiStatusStrip` retained.
- New compact **`InboxHealthStrip`** (disconnected / AI needs human / failed sends).

### Phase 8 — AI Reply Diagnosis ✅
- `GET /api/inbox/ai-diagnosis?sessionId=&chatId=`
- **`InboxAiDiagnosisPanel`** in Customer Action Center with re-run, reasons, fix links.

### Phase 9 — Unified send pipeline ✅ (inbox REST)
- `InboxSendPipelineService` wraps text + all media inbox sends.
- Permission gate, opt-out check (automated), audit log, thread events.

### Phase 10–11 — Quoted reply / media tracking ⚠️ Partial
- Pipeline structure ready; quoted-reply fields on DTO not fully wired to engine yet.
- Failed message retry/resend endpoints unchanged (`InboxFailedMessageActions`).

### Phase 12 — Composer ⚠️ Existing
- `InboxComposerTools` + Interakt composer unchanged; no major re-layout in this pass.

### Phase 13 — Customer Action Center ✅ (extended)
- Diagnosis panel added to `InboxCustomerPanel` (existing sections retained).

### Phase 14 — Business event timeline ✅ (foundation)
- `inbox_thread_events` table + `GET /api/inbox/threads/events`.
- Events recorded on: staff send, AI send (automated), message failed, human takeover, AI resume.

### Phase 15–17 — Resolve / notifications / account purpose ⚠️ Not in this pass
- Existing resolve outcomes + inbox notification prefs unchanged.

### Phase 18–20 — Search / pinned / saved views ⚠️ Partial
- Global search + message search unchanged.
- Server-side pinned/saved views not added.

### Phase 21 — Inbox health strip ✅
- See Phase 7.

### Phase 22 — CSS conflict cleanup ⚠️ Partial
- New components scoped under `.inbox-workspace` / component CSS.
- Legacy sheets not removed (safe backward compatibility).

### Phase 23 — Mobile ⚠️ Existing
- Existing breakpoints (`INBOX_WIDTH_MOBILE`, drawer CRM) unchanged.

---

## Tests & build

| Check | Result |
|-------|--------|
| `npm run build` (backend) | ✅ Pass |
| `npm run test -- inbox-thread-state` | ✅ 8/8 pass |
| `dashboard npm run build` | ✅ Pass |
| `inbox-unified.service.spec` | ⚠️ Pre-existing Jest/baileys ESM import issue when loading `MessageService` |

---

## Remaining risks / next steps

1. **Queue filter after pagination** — `queue` filters enriched page in memory; for large inboxes, denormalize `threadState` onto `inbox_thread_summaries` or SQL-filter.
2. **Quoted reply** — extend `InboxSendTextDto` + engine adapter for all send types.
3. **Timeline UI** — render `inbox_thread_events` as system rows in message list.
4. **Resolve outcome workflows** — wire won/lost/waiting_payment to follow-up + product demand (Phase 15).
5. **Notification settings panel** — dedicated Inbox Notifications under Settings (Phase 17).
6. **CSS consolidation** — migrate to single `.inbox-workspace` shell stylesheet.
7. **AI/product/campaign sends** — route through `InboxSendPipelineService` from AI auto-reply and product send modules.

---

## API summary (new/changed)

```
GET  /api/inbox/conversations?queue=needs_reply&cursor=...&includeCounts=true
GET  /api/inbox/ai-diagnosis?sessionId=&chatId=
GET  /api/inbox/threads/events?sessionId=&chatId=
GET  /api/sessions/:id/conversations  → same unified service + query params
POST /api/inbox/send-*                → via InboxSendPipelineService
```
