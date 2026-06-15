# SMS Channel (MobiShastra, Outgoing-Only) — Implementation Report

## Summary

Outgoing-only SMS notifications via **MobiShastra** are implemented as a parallel channel to WhatsApp. SMS is optional, disabled until credentials are saved and a test succeeds. No incoming SMS, inbox, or webhooks were added.

---

## Files Created

### Backend (`src/modules/sms/`)

| File | Purpose |
|------|---------|
| `sms.module.ts` | NestJS module registration |
| `sms.controller.ts` | REST API endpoints |
| `sms.service.ts` | Business logic, encryption, logging |
| `sms.enums.ts` | Status enums, constants |
| `sms-provider.interface.ts` | Provider abstraction |
| `providers/mobishastra.provider.ts` | MobiShastra HTTP GET client |
| `dto/sms-settings.dto.ts` | Settings, send, test, bulk DTOs |
| `entities/sms-provider-settings.entity.ts` | Provider credentials table |
| `entities/sms-message-log.entity.ts` | Outbound message logs |
| `utils/phone-normalize.util.ts` | Tanzania phone normalization |
| `utils/sms-segments.util.ts` | GSM/Unicode segment counting |
| `utils/mobishastra-codes.util.ts` | Response code mapping |

### Migration

| File | Purpose |
|------|---------|
| `src/database/migrations/1780710000000-AddSmsProvider.ts` | `sms_provider_settings` + `sms_message_logs` tables |

### Frontend

| File | Purpose |
|------|---------|
| `dashboard/src/components/SmsChannelPanel.tsx` | Channels → SMS setup UI |
| `dashboard/src/components/SmsChannelPanel.css` | Panel + logs styles |
| `dashboard/src/components/SmsLogsPanel.tsx` | SMS log table + filters |
| `dashboard/src/components/SendSmsModal.tsx` | Reusable send modal |
| `dashboard/src/components/SendSmsModal.css` | Modal styles |
| `dashboard/src/components/SmsCampaignPanel.tsx` | Bulk SMS campaign UI |
| `dashboard/src/lib/sms-segments-client.ts` | Client-side segment preview |

---

## Files Modified

| File | Change |
|------|--------|
| `dashboard/src/lib/channels.ts` | SMS active, link state, status types |
| `dashboard/src/hooks/useLinkedChannels.ts` | SMS status query, `isSmsReady` |
| `dashboard/src/pages/Channels.tsx` | SMS panel (removed from coming soon) |
| `dashboard/src/services/api.ts` | `smsApi`, follow-up channel param, `quoteApi.notifyBySms` |
| `dashboard/src/i18n/locales/en.json` | SMS i18n keys |
| `dashboard/src/pages/Followups.tsx` | Send channel picker integration |
| `dashboard/src/pages/Quotes.tsx` | Notify by SMS button |
| `dashboard/src/pages/Campaigns.tsx` | Admin SMS campaign panel |
| `dashboard/src/components/PipelineLeadDetail.tsx` | Send SMS from customer CRM |
| `dashboard/src/components/followups/FollowupDetailDrawer.tsx` | WhatsApp / SMS / Both picker |
| `dashboard/src/components/followups/FollowupFilterBar.tsx` | SMS filter option |
| `dashboard/src/components/settings/FollowupTemplatesPanel.tsx` | Channel select on templates |
| `dashboard/src/lib/ai-quick-actions.ts` | Link to SMS settings |
| `src/app.module.ts` | Register `SmsModule`, entity glob |
| `src/modules/audit/entities/audit-log.entity.ts` | SMS audit actions |
| `src/modules/followup/followup.module.ts` | Import `SmsModule` |
| `src/modules/followup/followup-queue.service.ts` | Route follow-up send via SMS |
| `src/modules/followup/followup-engine.service.ts` | Auto-send SMS by template channel |
| `src/modules/followup/followup.controller.ts` | Pass channel to send |
| `src/modules/followup/dto/followup.dto.ts` | `channel` on `SendFollowupDto` |
| `src/modules/quote/quote.module.ts` | Import `SmsModule` |
| `src/modules/quote/quote.service.ts` | `notifyBySms()` |
| `src/modules/quote/quote.controller.ts` | `POST /quotes/:id/notify-sms` |

---

## MobiShastra Endpoints Used

| Operation | URL |
|-----------|-----|
| Single SMS | `https://mshastra.com/sendurl.aspx` |
| Bulk SMS | `https://mshastra.com/sendurlcomma.aspx` |
| Balance | `https://mshastra.com/balance.aspx` |

**Parameters:** `user`, `pwd`, `senderid`, `mobileno`, `msgtext`, `priority`, `CountryCode`, `ShowError=C`

**Response codes handled:** 000 (success), 001, 003, 005, 006, 007, 008, 009, 010, 011, 012, 013

---

## Features Implemented

### Channel registry
- SMS is `active` and configurable (not coming soon)
- Statuses: Not Connected, Testing, Connected, Low Balance, Failed, Disabled
- Linked when enabled + connected (test passed)

### Backend API
- `GET /sms/status` — safe summary for UI gating
- `GET /sms/settings` — masked settings (operator+)
- `POST /sms/settings` — save credentials (admin)
- `POST /sms/test` — test send (operator+)
- `GET /sms/balance` — balance check (operator+)
- `POST /sms/send` — single SMS (operator+)
- `POST /sms/bulk-send` — bulk SMS (admin)
- `GET /sms/logs` — message logs (operator+; own logs for non-admin)
- `POST /sms/disable` / `POST /sms/activate` — admin
- `POST /sms/preview-segments` — segment count preview

### Phone normalization (Tanzania)
- `0712345678`, `712345678`, `255712345678`, `+255712345678` → `255712345678`

### SMS segment rules
- GSM: 160 first / 153 subsequent
- Unicode: 70 first / 63 subsequent
- Warnings for multi-segment messages

### Low balance
- Threshold: **&lt; 100** credits → `low_balance` status

---

## Where SMS Can Be Used

| Location | Action |
|----------|--------|
| **Channels → SMS** | Setup, test, balance, activate/disable, logs |
| **Customer profile** (`PipelineLeadDetail`) | Send SMS modal |
| **Follow-ups** | Send via WhatsApp / SMS / Both |
| **Follow-up templates** | Channel: whatsapp / sms / both |
| **Quotes** | Notify by SMS (short Swahili message) |
| **Repair ready** | Default SMS template seeded (`repair_ready`) |
| **Campaigns** | Admin bulk SMS to selected customers |
| **System status banner** | Low balance, failed, not connected, disabled alerts + link to SMS settings |
| **Dashboard control room** | Channel health card, needs-attention alerts, system tab alerts |
| **AI global search** | `search_everywhere` category `sms` — SMS logs + settings link (no credentials) |
| **AI quick actions** | Link to `/channels?channel=sms` |

WhatsApp inbox, composer, sessions, and message flows are unchanged.

---

## Security Protections

- MobiShastra password encrypted at rest (`encryptAiSecret` / AES-256-GCM)
- API never returns raw password; `passwordMasked: true` when set
- Password never logged in provider HTTP calls
- Settings save: **admin**; test/balance/send: **operator+**; bulk/disable: **admin**
- Audit events: `SMS_CREDENTIALS_SAVED`, `SMS_TEST_SENT`, `SMS_SENT`, `SMS_BULK_SENT`, `SMS_DISABLED`, `SMS_FAILED`
- Role mapping: admin = full; operator = send + own logs; viewer = no send

---

## Not Implemented (By Design)

- **No incoming SMS**
- **No SMS inbox / conversation threads**
- **No SMS webhook endpoints**
- WhatsApp remains the primary conversation channel

---

## Build Status

| Target | Result |
|--------|--------|
| **Dashboard** (`dashboard/npm run build`) | ✅ Pass |
| **Backend** (`npm run build`) | ✅ Pass |

## i18n

- **English:** `dashboard/src/i18n/locales/en.json` — full SMS + channels keys
- **Hebrew:** `dashboard/src/i18n/locales/he.json` — full SMS + channels keys (added)

---

## Manual QA Checklist

- [ ] Save MobiShastra credentials
- [ ] Password is masked after save
- [ ] Test SMS sends successfully
- [ ] Balance check works
- [ ] Send SMS from customer profile
- [ ] Send SMS from follow-up reminder (WhatsApp / SMS / Both)
- [ ] Notify quote by SMS
- [ ] Bulk SMS campaign sends to selected customers
- [ ] Failed SMS logs error clearly
- [ ] Disabled SMS hides send actions

---

## Role Mapping (Confirmed)

| Spec role | Codebase role |
|-----------|---------------|
| admin | `admin` |
| manager / customer_care / sales | `operator` |
| viewer | no send access |
