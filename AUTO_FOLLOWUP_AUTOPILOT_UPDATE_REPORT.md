# Auto Follow-up Autopilot Update Report

## Summary

Added a safe **Auto Follow-up Autopilot** layer on top of the existing rule-based follow-up system. Existing scheduler, rules, templates, manual queue, KPI reports, and WhatsApp sending remain intact. When autopilot is disabled (default), behavior is unchanged.

---

## Files Created

### Backend
- `src/database/migrations/1780810000000-AddFollowupAutopilot.ts`
- `src/modules/followup/entities/followup-autopilot-settings.entity.ts`
- `src/modules/followup/entities/followup-autopilot-audit.entity.ts`
- `src/modules/followup/followup-autopilot-settings.service.ts`
- `src/modules/followup/followup-autopilot-audit.service.ts`
- `src/modules/followup/followup-ai.service.ts`
- `src/modules/followup/followup-autopilot-decision.service.ts`
- `src/modules/followup/followup-autopilot-orchestrator.service.ts`
- `src/modules/followup/followup-autopilot-channel.service.ts`
- `src/modules/followup/followup-autopilot-report.service.ts`
- `src/modules/followup/utils/followup-risk.util.ts`
- `src/modules/session/dto/update-session-followup-autopilot.dto.ts`

### Dashboard
- `dashboard/src/components/settings/FollowupAutopilotSettingsPanel.tsx`
- `dashboard/src/components/dashboard/DashboardAutopilotSummary.tsx`

---

## Files Modified

### Backend
- `src/modules/followup/followup.enums.ts` — autopilot modes, risk levels, queue statuses/filters, permissions
- `src/modules/followup/followup.module.ts` — new services, AiModule, entities
- `src/modules/followup/followup-engine.service.ts` — orchestrator hook in `applyRule` (legacy path preserved when autopilot off)
- `src/modules/followup/followup-queue.service.ts` — autopilot queue items, approve/reject/schedule, filters, stop on reply
- `src/modules/followup/followup-hook.service.ts` — opt-out phrases, staff takeover pause, stop conditions
- `src/modules/followup/followup.controller.ts` — autopilot settings, dashboard, approve/reject, pause/resume APIs
- `src/modules/followup/dto/followup.dto.ts` — autopilot DTOs, `smsBody`, `customerRefusedFollowup`
- `src/modules/followup/entities/followup-queue-item.entity.ts` — autopilot columns
- `src/modules/followup/entities/followup-message-template.entity.ts` — `smsBody`
- `src/modules/followup/utils/template.util.ts` — extended template variables
- `src/modules/followup/utils/permissions.util.ts` — `approve_autopilot_followups` for operators
- `src/modules/message/entities/inbox-thread-crm.entity.ts` — per-thread autopilot pause
- `src/modules/message/inbox-crm.service.ts` — pause/resume/isPaused
- `src/modules/message/dto/inbox-thread-crm.dto.ts` — autopilot pause fields
- `src/modules/audit/entities/audit-log.entity.ts` — autopilot audit actions
- `src/modules/session/session.service.ts` — `followupAutopilotEnabled` per session
- `src/modules/session/session.controller.ts` — PATCH `/sessions/:id/followup-autopilot`
- `src/modules/session/dto/session-response.dto.ts` — response field

### Dashboard
- `dashboard/src/services/api.ts` — autopilot types and API methods
- `dashboard/src/components/followups/followup-utils.ts` — autopilot chips, badges, risk classes
- `dashboard/src/components/followups/FollowupViewChips.tsx` — autopilot tabs
- `dashboard/src/components/followups/FollowupDetailDrawer.tsx` — autopilot detail + actions
- `dashboard/src/components/followups/FollowupQueueTable.tsx` — autopilot status badges
- `dashboard/src/pages/Followups.tsx` — approve/reject/pause mutations, autopilot counts
- `dashboard/src/pages/Automations.tsx` — Autopilot settings tab
- `dashboard/src/components/settings/FollowupTemplatesPanel.tsx` — SMS body field
- `dashboard/src/pages/Dashboard.tsx` — `DashboardAutopilotSummary` widget

---

## Current Follow-up Behavior Preserved

- Seeded rules remain `create_task` mode
- Scheduler tick order unchanged (no-reply, stale, escalations, KPI)
- Manual send/complete/reschedule/assign on queue unchanged
- Per-rule `auto_send` still works when **global autopilot is off**
- Staff KPI reports unchanged
- Pipeline and inbox CRM unchanged except new optional autopilot pause fields

---

## New Autopilot Settings

| Setting | Default |
|---------|---------|
| `enabled` | `false` |
| `autopilotMode` | `auto_send_safe` (stored; effective `off` until enabled) |
| `businessHoursOnly` | `true` |
| `quietHoursStart/End` | `09:00` / `17:00` |
| `maxFollowupsPerCustomerPerDay` | `1` |
| `maxFollowupsPerLead` | `3` |
| `requireApprovalForMediumRisk` | `true` |
| `requireApprovalForHighRisk` | `true` |
| `allowSmsFallback` | `false` |
| `allowWhatsAppSmsBoth` | `false` |
| `allowGroupAutopilot` | `false` |
| `staffTakeoverPauseMinutes` | `120` |

**Effective mode:** `off` unless master switch + per-session `followupAutopilotEnabled` (admin). If AI not configured → `suggest_only`.

Configure at **Automations → Follow-up Autopilot** or `PATCH /followup/autopilot/settings`. Enable per account: `PATCH /sessions/:id/followup-autopilot`.

---

## AI Analysis Behavior

- **Template-first:** render template + variables, optional AI polish (no price/commitment changes)
- **Fallback without AI:** heuristic reason/risk from stage + trigger + message keywords
- **No free-form-only sends** when no template exists → approval or suggest queue
- Outputs: `detectedReason`, `customerMood`, `riskLevel`, `confidenceScore`, `suggestedChannel`, `suggestedMessage`

---

## Auto-send Safety Rules (decision engine)

1. Autopilot enabled (effective mode)
2. Not a group chat (unless explicitly allowed)
3. No customer reply after item created
4. Not opted out / refused follow-up
5. Not won/lost/closed/resolved
6. Thread autopilot not paused
7. WhatsApp connected OR SMS fallback allowed
8. Within business hours (if configured)
9. Under daily/per-lead limits
10. No duplicate message today
11. Risk/mode gate (low + confidence for `auto_send_safe`)
12. Template approved / within 24h window; message non-empty and safe

---

## Approval Queue

**Statuses:** `ai_suggested`, `needs_approval`, `scheduled`, `auto_sent`, `sent`, `failed`, `stopped`, `converted`, `rejected`

**UI tabs on `/followups`:** AI Suggestions, Needs Approval, Scheduled, Auto Sent, Failed, Stopped, Converted

**Actions:** Approve & Send, Reject, Schedule Later, Pause/Resume Autopilot, Open Chat (via drawer)

**API:** `POST /followup/queue/:id/approve|reject|schedule-autopilot`

---

## SMS Fallback Behavior

- Default channel: WhatsApp
- If WA disconnected and `allowSmsFallback=true` and SMS ready → send SMS (uses `smsBody` when set)
- If both channels configured → WhatsApp first, SMS on failure or when `allowWhatsAppSmsBoth`
- No SMS if provider disabled or not ready

---

## Stop Conditions

Autopilot items stop (`stopped` status) on: customer reply, opt-out phrases, won/lost/closed, group (default), limits, hours, duplicate, staff takeover (pause), staff reject.

Stored: `stopReason`, `stoppedAt`, `stoppedBy` (`system`/`staff`/`customer`).

---

## Reports Added

- `GET /followup/reports/autopilot` — suggestions, auto-sent, approval, stopped, failed, SMS fallback, template performance
- `GET /followup/autopilot/dashboard` — dashboard widget metrics
- Dashboard: **Follow-up Autopilot** summary on admin overview

---

## Audit Logs

Dedicated table `followup_autopilot_audit` + `AuditAction` entries:
`followup_autopilot_suggested`, `_approved`, `_rejected`, `_auto_sent`, `_stopped`, `_failed`, `_paused`

---

## Build Status

- Backend: `npm run build` — **pass**
- Dashboard: `npm run build` — **pass**

Run migration: start app or apply `1780810000000-AddFollowupAutopilot`.

---

## Manual QA Checklist

- [ ] Existing rule-based follow-up still creates tasks and manual send works
- [ ] Enable autopilot + per-session flag; AI suggestion appears for stale price conversation (`suggest_only` if AI off)
- [ ] Low-risk follow-up auto-sends when `auto_send_safe` + account enabled
- [ ] Medium/high risk appears under **Needs Approval**
- [ ] Customer reply stops scheduled autopilot item (`stopped`)
- [ ] Group chat does not auto-send (default)
- [ ] Disconnected WhatsApp blocks send or uses SMS fallback when enabled
- [ ] `maxFollowupsPerCustomerPerDay` enforced
- [ ] Staff can pause/resume autopilot from follow-up drawer
- [ ] Audit log entry created for auto-sent message (`followup_autopilot_auto_sent`)

---

## Safety Labels (UI)

Badges shown in queue table and detail drawer: **AI Suggested**, **Needs Approval**, **Auto Sent**, **Scheduled**, **Stopped**, **Failed**, **Converted**.

Warning copy: *"Autopilot will not send messages in group chats, complaint cases, or outside allowed hours."*

---

## Gap-fill (continued)

Additional wiring completed after initial implementation:

- **Inbox CRM panel**: `InboxFollowupAutopilotControls` — pause/resume autopilot per thread in inbox sidebar
- **Inbox list badges**: `autopilot_paused` chip when thread autopilot is paused
- **Settings hub**: `followup-autopilot` entry under Settings → Integrations
- **Sessions**: per-account `followupAutopilotEnabled` toggle (detail modal + session card)
- **Follow-up reports**: autopilot performance section (30-day metrics)
- **Dashboard alerts**: needs-approval count surfaced in control room
- **WebSocket**: `followup.autopilot_paused` event on pause/resume
- **Queue service**: `stopItem()` for explicit autopilot stop
- **Quote hooks**: `handleStageChange` on quote send/accept (fires `stage_entered` rules)
- **API types**: `Conversation.followupAutopilotPaused`, `InboxThreadCrm` pause fields, `sessionApi.setFollowupAutopilot`

### Polish (second pass)

- **Inbox CRM resolve/follow-up** → `handleStageChange` so `stage_entered` rules fire from inbox outcomes
- **Staff takeover** → WebSocket `followup.autopilot_paused` when staff sends a message
- **Dashboard WebSocket** → inbox + follow-up query invalidation on autopilot pause/resume
- **`FollowupAutopilotSuggestionRow`** → AI suggestion preview in queue table
- **Deep link** → dashboard “Needs approval” opens follow-ups with `needs_approval` filter
- **Stage API fix** → `POST .../stage` no longer double-updates stage

### Polish (third pass)

- **Real-time queue** → WebSocket `followup.autopilot_updated` on create, approve, reject, schedule, send, fail
- **Schedule later** → autopilot pending items can be scheduled via drawer or snooze modal
- **Session health** → admin can unpause failure-paused accounts from autopilot settings
- **Dashboard** → paused account names shown; settings link goes to integrations panel

### Polish (fourth pass)

- **Edit before approve** → staff can edit suggested message in follow-up drawer before sending
- **Autopilot audit log** → `GET /followup/autopilot/audit` + reports table
- **Unit tests** → `followup-risk.util.spec.ts` for opt-out, risk, and safe-message rules

Both builds re-verified: **pass**.
