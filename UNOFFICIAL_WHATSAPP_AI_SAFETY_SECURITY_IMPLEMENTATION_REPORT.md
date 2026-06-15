# Unofficial WhatsApp AI Safety & Security Implementation Report

**Date:** 2026-06-10  
**Scope:** Extend and harden the existing `whatsapp-safety` module — not a rebuild.

> **Disclaimer:** This safety system reduces risk for unofficial WhatsApp automation but **cannot guarantee** that WhatsApp accounts will never be banned. It is designed to prevent spam-like behavior, limit automation, enforce customer-initiated messaging, and route risky sends through delays, queues, and admin approval — not to bypass WhatsApp rules.

---

## 1. Send paths discovered

| Path | File | Trigger | Guard status |
|------|------|---------|--------------|
| Inbox text | `inbox.controller.ts` → `sendTextFromInbox` | Manual staff | ✅ Policy guard |
| Inbox media | `inbox.controller.ts` → `sendImage/Video/...FromInbox` | Manual staff | ✅ `assertOutboundSafety` |
| Session API text/media | `message.controller.ts` | Manual/API | ✅ Guard on all types |
| AI auto-reply | `ai-inbox-auto-reply.service.ts` | Automated | ✅ `AiSendPermissionService` + guard |
| AI staff bridge | `ai-staff-wa-bridge.service.ts` | Automated | ✅ Guard |
| AI learning reply | `ai-learning-items.service.ts` | Manual staff | ✅ Guard (manual) |
| Profile name replies | `customer-profile-enrichment.service.ts` | AI (exempt templates) | ✅ Guard + content exempt |
| Follow-up manual | `followup-queue.service.ts` | Staff / template | ✅ `source: followup` |
| Follow-up engine | `followup-engine.service.ts` | Automated | ✅ `source: followup` |
| Follow-up autopilot | `followup-autopilot-channel.service.ts` | Automated | ✅ `source: followup` |
| Product demand campaign | `product-demand-campaign.service.ts` | Campaign | ✅ Preflight + `source: campaign` |
| Product send | `products.service.ts` | Manual / product | ✅ `source: product_send` + media guard |
| Quote send | `quote.service.ts` | Manual | ✅ Guard |
| Transfer notify | `inbox-transfer.service.ts` | System utility | ✅ Guard |
| Bulk text/media | `bulk-message.service.ts` | Bulk API | ✅ Via `MessageService` (no direct engine bypass) |
| Queue worker | `whatsapp-send-queue.worker.ts` | Deferred | ✅ Pre-approved at enqueue |
| Reply / forward | `message.service.ts` | Manual | ✅ Guard |
| Group mutations | `group.controller.ts` | Admin only | ✅ `@RequireRole(ADMIN)` + audit |
| Catalog (stub) | `catalog.service.ts` | N/A | Not implemented |
| Status/Stories | `status.service.ts` | Out of chat scope | N/A |
| SMS | `sms.service.ts` | Separate channel | N/A |

**All automated WhatsApp chat sends** now pass through `WhatsAppOutboundService` → `WhatsAppPolicyGuardService` (alias: `UnofficialWhatsAppSafetyGuardService`) before delivery or queueing.

---

## 2. Services added / extended

| Service | Path | Role |
|---------|------|------|
| `UnofficialWhatsAppSafetyGuardService` | `services/unofficial-whatsapp-safety-guard.service.ts` | Alias export of policy guard |
| `WhatsAppPolicyGuardService` | `services/whatsapp-policy-guard.service.ts` | **Extended** — customer-initiated, campaign caps, delays, duplicate detection, warm-up enforcement |
| `AiSendPermissionService` | `services/ai-send-permission.service.ts` | **New** — AI “should this send?” brain |
| `WhatsAppOutboundService` | `services/whatsapp-outbound.service.ts` | **Extended** — media guard, delay scheduling, dashboard alerts on block |
| `WhatsAppSendQueueWorker` | `services/whatsapp-send-queue.worker.ts` | **Extended** — media payloads, typed warm-up counters |
| `WhatsAppWarmupService` | `services/whatsapp-warmup.service.ts` | **Extended** — day plan, per-type counters, reset |
| Opt-out util | `utils/opt-out-keywords.util.ts` | **Extended** — DB keyword merge |

---

## 3. Database

**Migration:** `1780940000000-HardenWhatsAppSafetySettings.ts`

New / aligned settings columns:
- `aiSafetyEnabled`, `productBulkSendEnabled`, `maxAutoRepliesPerHour`
- `minAiReplyDelayMs`, `maxAiReplyDelayMs`
- `riskyIntentRequiresApproval`, `unknownQuestionRequiresApproval`

Warm-up counters on `whatsapp_account_warmup`:
- `autoReplySentToday`, `followupSentToday`, `campaignSentToday`
- `maxAutoRepliesToday`, `maxFollowupsToday`

Existing tables reused (no renames): `whatsapp_send_queue`, `whatsapp_safety_settings`, `whatsapp_send_audit`, `whatsapp_session_health_events`, `whatsapp_account_warmup`, `whatsapp_contact_consent`.

**Defaults aligned:** 20/hr, 100/day outbound; 0 campaign/day by default.

---

## 4. API endpoints

Existing routes retained. Added:

| Method | Route |
|--------|-------|
| POST | `/whatsapp-warmup/:sessionId/reset` |
| GET | `/whatsapp-safety/opt-outs` |
| POST | `/whatsapp-safety/opt-outs/:id/restore` |
| POST | `/product-demand/campaigns/:id/safety-preflight` |
| POST | `/product-demand/campaigns/:id/approve-launch` |

Audit logs support filters: `source`, `decision`, `riskLevel`.

---

## 5. Settings UI

**Location:** Settings → Integrations → **WhatsApp Safety** (`WhatsAppSafetyPanel.tsx`)

Tabs: Overview, Policy Guard, Consent, Warm-up, Send Queue, Campaign, Follow-up, AI Reply, Session Health, Audit Logs.

Enhancements:
- Queue approve / cancel / retry actions
- Warm-up pause / resume per session
- API client methods for all safety actions (`dashboard/src/services/api.ts`)

---

## 6. Dashboard integration

- `DashboardNeedsAttention` — blocked sends, queue backlog, approval required
- `DashboardAiSafetyPanel` — WA blocked today, queue pending
- `DashboardTodaysWork` — approval-required queue items, critical health alerts
- `useDashboardData` — consumes `GET /dashboard/whatsapp-safety-alerts`

---

## 7. Feature-specific safety

### AI auto-reply
- `AiSendPermissionService` runs before every AI send
- Blocks: group, opt-out, no customer initiation, warm-up limits, startup safe mode
- Risky / low-confidence → staff escalation (no auto-send)
- Name-save / name-correction templates preserved and content-exempt

### Follow-ups
- Auto-send **OFF** by default (`followupAutoSendEnabled: false`)
- All sends tagged `source: followup`
- Guard blocks no-reply follow-ups and opted-out customers

### Campaigns
- Preflight before WhatsApp launch
- `approve-launch` sets status `approved`
- Day 1 warm-up blocks campaigns

### Product send
- `source: product_send` on text and media
- Group product send requires manual staff / approval path

### Warm-up
- 7-day plan with replies-only days 1–2
- Per-type daily counters
- Pause / resume / reset via API + UI

### Queue
- Automated sends enqueue with `scheduledAt` + jitter
- Approval-required items do not send until approved
- Worker respects per-session and per-contact cooldown

### Startup safe mode
- Blocks automated sends after QR connect until delay elapses
- Throttled sync via `background-sync.service.ts`

### Opt-out
- Swahili + English keywords (configurable via settings)
- Suppresses AI, follow-ups, campaigns
- One-time opt-out ack supported via consent `optOutAckSent`

### Session health
- Events for connect, block, failure rate, automation paused
- High failure rate pauses automation

### Audit
- Every guard decision logged to `whatsapp_send_audit`

---

## 8. Tests

```
Test Suites: 7 passed
Tests:       22 passed
```

Includes:
- `whatsapp-policy-guard.service.spec.ts` — group block, opt-out, customer-initiated, campaign disabled
- `ai-send-permission.service.spec.ts` — group block, name template allow, risky intent approval
- `opt-out-keywords.util.spec.ts` — Swahili + custom keywords
- Existing `whatsapp-group-safety.service.spec.ts`

---

## 9. Build results

| Target | Result |
|--------|--------|
| Backend `npm run build` | ✅ Pass |
| Dashboard `npm run build` | ✅ Pass |

---

## 10. Remaining risks

1. **Unofficial API** — WhatsApp may still restrict accounts regardless of pacing.
2. **Media guard** — Uses caption/body heuristics; large albums still count as outbound volume.
3. **Duplicate message detection** — Heuristic-based; consider body-hash storage in audit for production hardening.
4. **Campaign approval** — `approved` status is stored on campaign row; send still re-runs preflight at launch.
5. **Catalog send** — Still stubbed; wire through `MessageService` when implemented.

---

## 11. Name/profile preservation

Verified preserved:
- Name save: `"Sawa {name}, ngoja nisave namba yako 😊"`
- Name correction: `"Ahaa basi powa nimekupata."`

These templates are exempt from spam content flags and receive `ALLOW_SEND` from `AiSendPermissionService`.
