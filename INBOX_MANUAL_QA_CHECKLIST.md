# Inbox Customer Care Control Room — Manual QA Checklist

Use after backend restart + dashboard refresh.

## Work queue & thread state

- [ ] 1. Send customer message → appears in **Needs Reply** queue (not only unread).
- [ ] 2. AI replies → conversation leaves **Needs Reply** (`threadState` → `waiting_customer` or `ai_handling`).
- [ ] 3. Customer says “Asante” after answer → **not** flagged urgent needs reply.
- [ ] 4. Single-session mode (`/sessions/:id/conversations`) returns same filters as unified inbox.
- [ ] 5. Cursor pagination: load more → no duplicate conversations.

## AI handover & diagnosis

- [ ] 6. Pause AI for chat → handover strip shows paused / human handling.
- [ ] 7. Open Customer panel → **AI reply diagnosis** → shows exact reasons.
- [ ] 8. Click **Re-run** diagnosis after fixing settings → updates summary.
- [ ] 9. **Resume AI** from diagnosis panel works.

## Send pipeline

- [ ] 10. Send manual text → persists, appears in timeline, no duplicate sends.
- [ ] 11. Send product from picker → message appears (existing flow).
- [ ] 12. Send quoted reply → quote bar + bubble context (if engine supports chat).
- [ ] 13. Send image/document → sends; failed media shows retry (existing).
- [ ] 14. Failed send → appears in **Failed Sends** filter when applicable.

## Assignment & CRM

- [ ] 15. Assign chat to staff → **Assigned to Me** uses logged-in user (not stale localStorage).
- [ ] 16. Resolve as waiting stock → follow-up / demand flow (existing resolve modal).
- [ ] 17. Customer replies to resolved chat → chat reopens (existing CRM behavior).

## Groups & sessions

- [ ] 18. Group chat → AI auto-reply disabled strip / `group_lead_only` state.
- [ ] 19. Health strip shows **WhatsApp disconnected** when session not ready + link to QR.
- [ ] 20. WhatsApp account purpose badge visible on conversation rows (existing `accountPurpose`).

## UI & mobile

- [ ] 21. Mobile: list → chat → CRM drawer without layout break.
- [ ] 22. No CSS regression on filters, composer, or three-column desktop layout.
- [ ] 23. Notification settings still load under user preferences (existing).

## API smoke (optional)

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:2886/api/inbox/conversations?queue=needs_reply&includeCounts=true"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:2886/api/inbox/ai-diagnosis?sessionId=SESSION&chatId=CHAT"
```
