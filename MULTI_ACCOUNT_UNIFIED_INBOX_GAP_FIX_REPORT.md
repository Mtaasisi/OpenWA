# Multi-Account Unified Inbox — Gap Fix Report

## Summary

The unified inbox was upgraded incrementally across 9 phases: enriched `ConversationSummary`, server-side filters/pagination, safer `POST /inbox/send-text`, account safety UI, controlled transfer, required resolve flow, Customer 360 cross-account history, enriched notifications, and targeted tests. Existing `GET /inbox/conversations` and `POST /sessions/:id/messages/send-text` remain intact.

## Changed Files by Phase

### Phase 1 — Enrich unified inbox response
- `src/modules/message/message.service.ts` — extended `ConversationSummary`, enrichment helpers
- `src/modules/followup/followup-conversation.service.ts` — `getInboxEnrichmentMapForThreads`
- `src/modules/followup/followup-inbox-enrichment.types.ts` — new
- `dashboard/src/services/api.ts` — `Conversation` interface parity
- `dashboard/src/pages/inbox-helpers.ts` — overdue filter uses `nextFollowupAt` / `followupOverdue`

### Phase 2 — Backend filters and pagination
- `src/modules/message/dto/inbox-conversations-query.dto.ts` — new query DTO + result type
- `src/modules/message/inbox.controller.ts` — query params on `GET /inbox/conversations`
- `src/modules/message/message.service.ts` — `queryUnifiedConversations` with operator auto-scope
- `dashboard/src/hooks/queries.ts` — paginated unified query hook
- `dashboard/src/pages/useInboxController.ts` — server-side filter params, load-more offset
- `dashboard/src/pages/inbox-helpers.ts` — `buildUnifiedInboxQuery`
- `dashboard/src/components/Layout.tsx` — badge uses paginated response
- `src/modules/ai/ai-app-tools.ts` — uses `queryUnifiedConversations`

### Phase 3 — Safer inbox sending
- `src/modules/message/dto/inbox-send-text.dto.ts` — new
- `src/modules/message/inbox.controller.ts` — `POST /inbox/send-text`
- `src/modules/message/message.service.ts` — `sendTextFromInbox`, `hasInboxThread`
- `dashboard/src/services/api.ts` — `inboxApi.sendText`
- `dashboard/src/pages/useInboxController.ts` — text composer uses inbox endpoint

### Phase 4 — Account status and send safety UI
- `dashboard/src/components/InboxActiveSendAccount.tsx` — “Sending from”, status, reconnect
- `dashboard/src/components/InboxActiveSendAccount.css`
- `dashboard/src/pages/InboxClassicView.tsx` — account badge on rows/header, send strip always visible
- `dashboard/src/components/InboxInteraktChatHeader.tsx` — account name/phone/status in header
- `dashboard/src/pages/InboxTacticalView.tsx` — reconnect on send strip
- `dashboard/src/pages/useInboxController.ts` — stricter `canSend` (requires ready session + thread)

### Phase 5 — Controlled transfer flow
- `src/modules/message/dto/inbox-transfer.dto.ts` — new
- `src/modules/message/inbox-transfer.service.ts` — new
- `src/modules/message/inbox.controller.ts` — `PATCH /inbox/conversations/transfer`
- `src/modules/message/message.module.ts` — wiring + `FollowupConversation` repo
- `src/modules/audit/entities/audit-log.entity.ts` — `INBOX_CHAT_TRANSFERRED`, `INBOX_CHAT_RESOLVED`
- `dashboard/src/components/InboxTransferChatModal.tsx` — new
- `dashboard/src/components/InboxInteraktChatHeader.tsx` — Transfer button + modal

### Phase 6 — Safe resolve flow
- `src/database/migrations/1780600000000-AddInboxResolveOutcomeFields.ts` — `outcome`, `resolvedByStaffId`
- `src/modules/message/entities/inbox-thread-crm.entity.ts`
- `src/modules/message/dto/inbox-thread-crm.dto.ts` — outcome, lostReason
- `src/modules/message/dto/inbox-resolve-outcome.enum.ts` — new
- `src/modules/message/inbox-crm.service.ts` — resolve validation, follow-up queue on resolve
- `src/modules/followup/dto/followup.dto.ts` — `lostReason` on update DTO
- `dashboard/src/components/InboxResolveChatButton.tsx` — required modal on all variants

### Phase 7 — Customer 360 multi-account history
- `dashboard/src/components/InboxCustomerThreadsPanel.tsx` — new
- `dashboard/src/pages/InboxCustomerPanel.tsx` — wired into Customer 360 tab
- `dashboard/src/pages/InboxClassicView.tsx` — passes `allSessions` + `onOpenThread`

### Phase 8 — Notifications
- `src/modules/message/message.service.ts` — `enrichInboundNotificationPayload`
- `src/modules/session/session.service.ts` — enriched WS `message.received` payload
- `src/modules/followup/followup-queue.service.ts` — follow-up alerts include `sessionName`, `stage`
- `src/modules/followup/followup.module.ts` — `Session` entity for alert enrichment
- `dashboard/src/hooks/useInboxNotifications.ts` — browser notifications
- `dashboard/src/hooks/useFollowupAlerts.ts` — toast includes account name
- `dashboard/src/components/Layout.tsx` — mounts `useInboxNotifications`

### Phase 9 — Tests
- `src/modules/message/inbox-unified.service.spec.ts`
- `src/modules/message/inbox-transfer.service.spec.ts`
- `src/modules/message/inbox-crm-resolve.spec.ts`
- `src/modules/message/message-session-send.spec.ts` — inbox send wrapper case

## Verification

| Check | Result |
|-------|--------|
| `npm run build` (backend) | Pass |
| `cd dashboard && npm run build` | Pass |
| Inbox unit tests | 12 passed |

## Remaining Gaps

1. **Media sends** still use `POST /sessions/:sessionId/messages/send-image` (and siblings); only text uses `/inbox/send-text`.
2. **Transfer** moves CRM + follow-up `sessionId`; **message history stays on the source session** (by design for integrity).
3. **`accountPurpose`** reads `session.config.purpose` optionally — no UI to set it yet; must be stored in session config JSON manually.
4. **Single-session mode** (`viewMode === 'one'`) still uses `GET /sessions/:id/conversations` without server filters/pagination.
5. **Cursor pagination** not implemented; offset/limit only.
6. **`assignedToMe` in UI** still partially relies on localStorage staff id for single-session client filters; unified mode uses API key id via backend auto-scope.
7. **Interakt list rows** show account badge in Classic; Interakt-specific list styling for account dot may need further polish.
8. **Browser notifications** require user permission; no Settings toggle yet (permission requested on first load).

## Manual QA Checklist

- [ ] Open unified inbox (`viewMode: all`) — conversations from multiple sessions appear with account fields (`accountPhoneNumber`, `stage`, `assignedStaffName`).
- [ ] Filter by session, unread, overdue, assigned-to-me — results change without client-only filtering for those modes.
- [ ] Paginate / load more when `total > limit`.
- [ ] Select thread on account A — composer shows “Sending from: {name}”; send disabled when account not `ready`.
- [ ] Send text — uses `/inbox/send-text`; disconnected session shows clear error + reconnect CTA.
- [ ] Transfer chat — requires reason + destination; CRM/follow-up move to new session; optional customer notify.
- [ ] Resolve chat — modal requires outcome + reason; lost requires `lostReason`; follow-up later requires date + creates queue item.
- [ ] Customer 360 — “Other accounts” lists same-phone threads with open button.
- [ ] Notifications — new message toast/browser title includes customer + account name; follow-up alerts include account.
- [ ] Operator API key — sees only unassigned + own assigned conversations by default.
- [ ] `GET /sessions/:id/messages/send-text` still works for plugins/AI.
