# WhatsApp Safety & Compliance — Full Implementation Report

**Date:** 2026-06-10  
**Status:** Implemented — backend + dashboard + tests passing

---

## Disclaimer

This system **reduces risk from spammy or unsafe usage patterns** (opt-out enforcement, rate limits, warm-up, queue, consent, template rules). It does **not** make unofficial WhatsApp Web automation (`whatsapp-web.js`) compliant with Meta's terms.

**Official WhatsApp Business Cloud API remains the safest production option** for business messaging at scale.

---

## Send paths audited

| Path | File | Guard protected? |
|------|------|------------------|
| Text (API / inbox / internal) | `message.service.ts` → `sendTextInternal` | Yes |
| Bulk text | `bulk-message.service.ts` → `sendTextInternal` | Yes |
| Bulk media | `bulk-message.service.ts` → `MessageService` media methods | Yes |
| Bulk API create | `bulk-message.service.ts` → `createBatch` | Gated by `productBulkSendEnabled` |
| Image / album / video / audio / document | `message.service.ts` | Yes (this session) |
| Location / contact / sticker | `message.service.ts` | Yes (`UTILITY` type) |
| Inbox media | `inbox.controller.ts` → `send*FromInbox` | Yes (staff manual flag) |
| Products | `products.service.ts` | Yes (`product_send` source) |
| Quotes | `quote.service.ts` → `sendText` | Yes (`quote` → `QUOTE_REMINDER` type) |
| AI auto-reply | `ai-inbox-auto-reply.service.ts` | Yes (via `sendTextInternal`) |
| AI staff bridge | `ai-staff-wa-bridge.service.ts` | Yes |
| AI learning reply | `ai-learning-items.service.ts` | Yes |
| Follow-up manual / autopilot | `followup-queue.service.ts`, `followup-autopilot-channel.service.ts` | Yes |
| Follow-up engine auto-send | `followup-engine.service.ts` | Yes |
| Product-demand campaigns | `product-demand-campaign.service.ts` | Yes + preflight |
| Transfer notify | `inbox-transfer.service.ts` | Yes |
| Typing / reactions | `message.service.ts` | No (non-message UX signals) |
| WhatsApp Status | `status.service.ts` | Gated by `statusPostsEnabled` (default off) |
| Native catalog send | `catalog.service.ts` | Guarded; redirects to `POST /products/:id/send` (adapter not implemented) |
| Group admin actions | `group.controller.ts` | Gated — admin + confirm + `groupManagementEnabled` |

**Central choke point:** `WhatsAppOutboundService.checkBeforeSend()` called from `MessageService.assertOutboundSafety()` before engine send.

---

## Database

**Migration:** `src/database/migrations/1780800000000-AddWhatsAppSafetySystem.ts`

| Table | Purpose |
|-------|---------|
| `whatsapp_contact_consent` | Opt-in/opt-out, categories, last message times |
| `whatsapp_safety_settings` | Global + per-session policy defaults |
| `whatsapp_account_warmup` | Day-by-day warm-up limits per session |
| `whatsapp_send_queue` | Central outbound queue with approval states |
| `whatsapp_session_health_events` | Connection/failure/block events |
| `whatsapp_session_automation_state` | Per-session automation pause flag |
| `whatsapp_send_audit` | Every guard decision + send outcome |

**Templates:** Extended existing `followup_message_templates` (not duplicated) via `WhatsAppTemplateGuardService`.

---

## Backend services

Module: `src/modules/whatsapp-safety/`

| Service | Role |
|---------|------|
| `WhatsAppPolicyGuardService` | Central policy evaluation (consent, 24h, warm-up, limits, content) |
| `WhatsAppOutboundService` | Pre-send check API for all callers |
| `WhatsAppConsentService` | Consent CRUD + opt-out handling |
| `WhatsAppServiceWindowService` | 24-hour customer service window |
| `WhatsAppTemplateGuardService` | Approved template requirement outside window |
| `WhatsAppSendQueueService` + `WhatsAppSendQueueWorker` | DB-polled queue, per-session delays |
| `WhatsAppWarmupService` | Account warm-up day plan |
| `WhatsAppSessionHealthService` | Health events, automation pause |
| `WhatsAppSendAuditService` | Audit log + rate counters |
| `WhatsAppCampaignPreflightService` | Campaign launch safety check |
| `WhatsAppInboundHookService` | Inbound opt-out + consent updates |
| `WhatsAppGroupSafetyService` | Group mutation gate (admin + confirm) |
| `WhatsAppStatusSafetyService` | Status/story post gate |
| `WhatsAppCloudTemplateSyncService` | Optional Meta Graph API template status sync |
| `WhatsAppSafetySettingsService` | Settings load/save |

**Default-safe settings:**

- `campaignsEnabled = false`
- `followupAutoSendEnabled = false`
- `groupsAutoReplyEnabled = false`
- `groupManagementEnabled = false`
- `productBulkSendEnabled = false`
- `statusPostsEnabled = false`
- `outside24hRequiresTemplate = true`
- `startupSafeModeEnabled = true`
- `minDelayBetweenMessagesMs = 8000`
- `maxAutoRepliesPerCustomerPerDay = 5`

---

## APIs

Controller: `src/modules/whatsapp-safety/whatsapp-safety.controller.ts`

- `GET/PATCH /whatsapp-safety/settings`
- `GET /whatsapp-safety/overview`
- `POST /whatsapp-safety/check-send`
- `GET /whatsapp-safety/blocked-sends`
- `GET /whatsapp-safety/audit-logs`
- `GET/PATCH /whatsapp-consent`, opt-in/opt-out actions
- `GET /whatsapp-send-queue`, approve/cancel/retry
- `GET/PATCH /whatsapp-warmup`, pause/resume
- `GET /whatsapp-session-health`, pause/resume automation
- `POST /campaigns/:id/preflight`, approve-launch
- `GET /dashboard/whatsapp-safety-alerts`

---

## Settings UI

- Panel: **Settings → WhatsApp Safety** (`whatsapp-safety` in `settings-nav-registry.ts`)
- Component: `dashboard/src/components/settings/WhatsAppSafetyPanel.tsx`
- Tabs: Overview, Policy Guard, Consent, Warm-up, Send Queue, Campaign Safety, Follow-up Safety, AI Reply Safety, Session Health (wired), Audit Logs
- Campaign preflight modal: `ProductDemandCampaignPanel.tsx` (WhatsApp sends only)

---

## Dashboard integration

Extended (not replaced):

- `DashboardNeedsAttention` — blocked sends, queue approvals, health alerts
- `DashboardAiSafetyPanel` — AI blocks, link to safety settings
- `DashboardChannelHealth` — warm-up / queue / health link
- `DashboardTodaysWork` — pending queue approvals
- `dashboard-metrics.ts` + `useDashboardData.ts` — `whatsapp-safety` alert query

---

## Automation safety

| Feature | Change |
|---------|--------|
| AI auto-reply | Guard blocks groups, opt-out, outside 24h, low confidence, risky intent, daily limits; DELAY for human-like pacing |
| Follow-up autopilot | Guard + existing decision service; auto-send off by default |
| Campaigns | Preflight required; disabled by default; queue on launch |
| Bulk API | Text through guard; campaigns disabled unless enabled |
| Startup | `BackgroundSyncService` respects safe mode delays; cancel race fixed |
| Warm-up | Auto-starts on first session READY; restricts campaigns/bulk early days |

---

## Opt-in / opt-out

- Unified keywords: `src/modules/whatsapp-safety/utils/opt-out-keywords.util.ts`
- Delegated from `ai-customer-opt-out.util.ts` and `followup-risk.util.ts`
- Inbound hook updates `whatsapp_contact_consent` + syncs `inbox_thread_crm.aiOptOut`
- One safe opt-out ack via existing `ai-opt-out.constants.ts`

---

## Tests

| Suite | Result |
|-------|--------|
| `whatsapp-policy-guard.service.spec.ts` | Pass |
| `whatsapp-consent.service.spec.ts` | Pass |
| `whatsapp-warmup.service.spec.ts` | Pass |
| `whatsapp-send-queue.service.spec.ts` | Pass |
| `background-sync.service.spec.ts` | Pass |
| `product-demand-campaign.service.spec.ts` | Pass |
| `whatsapp-group-safety.service.spec.ts` | Pass |
| `whatsapp-status-safety.service.spec.ts` | Pass |
| `bulk-message.service.spec.ts` | Pass |
| `catalog.service.spec.ts` | Pass |
| `whatsapp-cloud-template-sync.service.spec.ts` | Pass |
| `test/whatsapp-safety-api.e2e-spec.ts` | Pass |
| `message.service.spec.ts` | Pass (mocks updated) |

**Build:**

- `npm run build` (backend) — pass
- `dashboard npm run build` — pass

---

## Changes in this session

1. **Media send guard** — `sendImage`, `sendImageAlbum`, `sendVideo`, `sendAudio`, `sendDocument` now call `assertOutboundSafety()`
2. **Inbox media** — passes `actorStaffId` so staff sends are treated as manual
3. **Product send** — passes `source: product_send` on all product paths
4. **Background sync cancel race** — generation token prevents cancelled jobs from running
5. **Policy guard tests** — aligned with customer-initiated consent + AI DELAY behavior
6. **Message service tests** — WhatsApp safety dependency mocks added

## Round 2 (continued hardening)

1. **Bulk API gate** — `createBatch` rejects when `productBulkSendEnabled` is false
2. **Bulk media** — all types route through `MessageService` (removed dead direct-engine helper)
3. **Group safety** — `groupManagementEnabled` (default off); admin + `{ confirm: true }` for mutations
4. **Migration** — `1780810000000-AddWhatsAppGroupManagementSetting.ts`
5. **Settings UI** — toggles for group management and bulk sends
6. **Tests** — `whatsapp-group-safety.service.spec.ts`

## Round 3 (UI + remaining guards)

1. **Session Health tab** — `WhatsAppSafetyPanel` lists sessions (pause/resume automation) + recent health events
2. **Campaign preflight UI** — `ProductDemandCampaignPanel` calls `safetyPreflight` before WhatsApp send; shows risk score and required fixes
3. **Status posting guard** — `statusPostsEnabled` (default off) + `WhatsAppStatusSafetyService`; migration `1780820000000-AddWhatsAppStatusPostsSetting.ts`
4. **Quote send typing** — `source: 'quote'` maps to `QUOTE_REMINDER` message type
5. **Bulk tests** — `bulk-message.service.spec.ts` covers disabled/enabled gate
6. **i18n** — expanded `whatsappSafety` keys in `en.json` and `he.json`; campaign preflight strings

## Round 4 (extended send paths + catalog)

1. **Location / contact / sticker guards** — `assertOutboundSafety()` with `UTILITY` message type
2. **API media sends** — `message.controller.ts` passes `actorStaffId` for image/video/audio/document/location/contact/sticker
3. **Catalog API guard** — `catalog.service.ts` runs policy guard before native catalog send; clear error pointing to `POST /products/:id/send`
4. **Catalog auth** — role requirements + `CurrentApiKey` on send endpoints
5. **Blocked sends UI** — overview + audit tab show recent blocked sends via `GET /whatsapp-safety/blocked-sends`
6. **Tests** — `catalog.service.spec.ts`

## Round 5 (Meta Cloud template sync + queue improvements)

1. **Cloud template sync** — `WhatsAppCloudTemplateSyncService` pulls Meta Graph API `message_templates` and updates local `followup_message_templates.whatsappTemplateStatus` by `whatsappTemplateName`
2. **Settings** — `whatsappCloudSyncEnabled`, `whatsappCloudWabaId`, last sync metadata; token via `WHATSAPP_CLOUD_ACCESS_TOKEN` env (not stored in DB)
3. **Migration** — `1780830000000-AddWhatsAppCloudTemplateSyncSettings.ts`
4. **APIs** — `GET /whatsapp-safety/templates`, `GET .../sync-status`, `POST .../sync-from-cloud`, `GET /whatsapp-send-queue/stats`
5. **Queue worker** — uses `findReady()` query (no longer loads all queue rows); poll interval via `WHATSAPP_QUEUE_POLL_MS`
6. **UI** — Templates tab in `WhatsAppSafetyPanel` with WABA ID, sync button, approval template table; queue stats on Overview + Queue tabs
7. **Tests** — `whatsapp-cloud-template-sync.service.spec.ts`

## Round 6 (operator tools + campaign templates)

1. **Check-send tester** — Policy tab dry-runs `POST /whatsapp-safety/check-send` without sending
2. **Consent restore** — Consent tab **Restore** button calls `POST /whatsapp-safety/opt-outs/:id/restore`
3. **Campaign template picker** — Preflight modal selects approved template when outside 24h; passes `templateId` to preflight + send
4. **Reply/forward API** — `message.controller` passes `actorStaffId` for manual staff classification
5. **Queue worker** — forwards `templateId` from queue rows to `sendTextInternal`
6. **Scheduled template sync** — optional `WHATSAPP_CLOUD_SYNC_INTERVAL_HOURS` env (e.g. 24)

## Round 7 (deep links + e2e)

1. **Tab deep links** — `?panel=whatsapp-safety&waTab=queue|audit|health|…`; `whatsappSafetyTabHref()` helper
2. **Dashboard links** — Control room alerts, channel health, and work items open the relevant safety tab
3. **URL sync** — tab changes update `waTab` query param (replace navigation)
4. **E2E** — extended mocks + tests for deep link, health, templates, check-send, consent restore, dashboard queue link

## Round 8 (campaign approve-launch + consent marketing)

1. **Approve launch API** — `POST /product-demand/campaigns/:id/approve-launch` after preflight
2. **Campaign UI** — `ProductDemandCampaignPanel` approve + send preflight modals with template picker
3. **Marketing consent gaps** — `GET /whatsapp-consent/marketing-gaps`; Consent tab section
4. **Restore opt-out** — optional `canMarketing` on restore body
5. **Migration dedup** — storage backup renumbered to `1780799000000`

## Round 9 (approved-send gate + dashboard alerts)

1. **Send gate** — WhatsApp campaigns must be `approved` before `sendCampaign`
2. **Dashboard metrics** — `approvedCampaignsCount` on learning-demand alerts API
3. **Attention alerts** — draft vs approved campaign alerts in control room
4. **Campaigns metrics card** — approved count on Campaigns page

## Round 10 (inbox consent strip + dev stability)

1. **Inbox strip** — `InboxWhatsAppConsentStrip` in CRM panel (opt-out / no marketing / outside 24h)
2. **Consent lookup API** — `GET /whatsapp-consent/lookup?sessionId=&chatId=`
3. **JWT auth fix** — removed `@UseGuards(ApiKeyGuard)` from safety controller (global JWT guard)
4. **Migration repair** — `repairRenamedMigrations()` on SQLite boot; idempotent column migrations
5. **CORS** — `expandLocalhostCorsOrigins()` mirrors `localhost` ↔ `127.0.0.1`

## Round 11 (operator runbook + test hardening)

1. **Operational runbooks** — `docs/11-operational-runbooks.md` §11.4 (blocked sends, queue backlog, campaign launch, migration/CORS)
2. **API e2e fix** — `test/whatsapp-safety-api.e2e-spec.ts` repaired; covers marketing-gaps, lookup, restore
3. **Dashboard e2e** — approved campaign alert test in `dashboard-demand-alert.spec.ts`
4. **QA script** — `npm run qa:whatsapp-safety` (unit + API e2e + Playwright safety specs)

## Round 12 (inbox consent e2e + cloud connection test)

1. **Inbox consent e2e** — `dashboard/e2e/inbox-whatsapp-consent.spec.ts` with `inbox-consent-mocks.ts` (opt-out, no marketing, outside 24h, clear state); **Interakt CRM** path now renders `InboxWhatsAppConsentStrip` (default theme)
2. **Cloud connection test** — `WhatsAppCloudTemplateSyncService.testCloudConnection()` validates WABA + template API access; optional `WHATSAPP_CLOUD_PHONE_NUMBER_ID` for phone lookup
3. **API** — `GET /whatsapp-safety/cloud/connection-test`
4. **UI** — Templates tab **Test Cloud connection** button with inline result
5. **Tests** — unit spec for connection test; API e2e + Playwright templates test; inbox consent Playwright suite in `qa:whatsapp-safety`

## Round 13 (Cloud API template outbound send)

1. **Cloud outbound service** — `WhatsAppCloudOutboundService.sendTemplate()` posts approved Meta templates via Graph API; runs policy guard first; audits SENT/FAILED/BLOCKED
2. **Env** — `WHATSAPP_CLOUD_PHONE_NUMBER_ID` required for sends (documented in `.env.example`)
3. **API** — `POST /whatsapp-safety/cloud/send-template` (ADMIN); sync status exposes `cloudSendReady`
4. **UI** — Templates tab **Send via Cloud API** operator form (session, chat, approved template, optional body params)
5. **Tests** — `whatsapp-cloud-outbound.service.spec.ts`; API e2e + Playwright send test; `qa:whatsapp-safety` includes `whatsapp-cloud` pattern

---

## Remaining risks

1. **Unofficial client** — Meta can still ban accounts using linked-device automation regardless of in-app safeguards
2. **Native catalog adapter** — whatsapp-web.js has no catalog API; use Products send path instead
3. **Queue worker** — DB-polled (not BullMQ); adequate for moderate volume; configurable poll interval
4. **Cloud template sync** — optional; requires valid Meta system user token + WABA ID; outbound sends use Cloud API separately from linked-device automation

---

## Recommended operator checklist

1. Keep **campaigns** and **follow-up auto-send** disabled until warm-up completes
2. Use **Settings → WhatsApp Safety** to review queue and audit logs daily
3. Never enable AI auto-reply on **groups** unless explicitly needed
4. For production business lines, plan migration to **WhatsApp Business Cloud API**
5. To sync template approval from Meta: set `WHATSAPP_CLOUD_ACCESS_TOKEN`, enable sync in **Templates** tab, enter WABA ID, run **Sync from Meta Cloud**
