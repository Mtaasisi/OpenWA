# Mchele AI Reply — Root Cause Fix Report

**Date:** 2026-06-13  
**Scope:** AI auto-reply silent failures, manual takeover duration, failed send recovery, presence/greeting behavior  
**Production chat analyzed:** Mchele (`19770372038672@lid`)

---

## Executive summary

The AI audit for Mchele’s chat identified three themes: empty catalog, long manual takeover, and failed sends. Live investigation showed:

| Audit claim | Actual state after prior sync | Fix in this pass |
|-------------|------------------------------|------------------|
| Empty catalog | **274 products** (33 MacBooks, 13 chargers) — catalog was empty during early messages | Product-not-found **fallback reply** even when search returns 0 |
| AI stuck on product questions | Agent returned empty / errors (`SQLITE_CONSTRAINT` on learning settings) | Fallback path + learning settings race fix (prior commit) |
| Manual "hi" blocked AI 2+ hours | `takeOverFromAi` set **permanent** pause | **15 min temporary** takeover (`manualTakeoverMinutes`) |
| Failed send invisible | Failed status in DB, no retry UI | Retry/resend API + inbox bubble actions + auto-retry |
| "Upo online now" → greeting | Presence path existed but burst/takeover blocked it | Burst-aware presence + regex hardening |
| Repeated greeting | Cooldown existed | Skip full greeting when thread already has product intent |

---

## Root causes fixed

### 1. AI silent on product-not-found
**Cause:** When `search_products` returned 0 results (or agent returned empty), auto-reply logged skip and sent nothing.

**Fix:** `AiProductNotFoundService` + fast path in `AiInboxAutoReplyService`:
- Search catalog before/alongside agent
- If 0 results → deterministic Swahili fallback (MacBook / charger / generic)
- Record product demand + catalog request (24h dedup)
- Create stocking reminder via existing `createProductRequest`

**Setting:** `replyWhenProductNotFound` (default `true`) on `ai_config`

### 2. Product demand not actionable
**Cause:** Demand was logged but customer got no reply.

**Fix:** `recordDemandWithDedup()` increments `product_catalog_requests.customerCount` or creates open request with example messages; ties into Product Demand dashboard.

### 3. Manual takeover too long
**Cause:** Staff send called `takeOverFromAi()` → permanent `aiAutoReplyPaused: true`.

**Fix:**
- Staff sends → `takeOverFromStaffReply(minutes)` with `autopilotPauseReason: manual_takeover`
- `manualTakeoverUntil` on `inbox_thread_crm` — auto-expires
- Explicit “Take over” button → `autopilotPauseReason: explicit` (no auto-resume)
- Each staff message **extends** takeover from current deadline

**Setting:** `manualTakeoverMinutes` (default `15`) on `ai_config`

### 4. Failed AI sends not recoverable
**Cause:** `MessageStatus.FAILED` stored with no metadata, no inbox retry.

**Fix:**
- Failure metadata: `sendFailureReason`, `retryable`, `retryCount`, `maxRetries`
- `POST /api/inbox/messages/:id/retry` and `/resend`
- Auto-retry hook on `message:failed` for AI messages (backoff, max 3)
- UI: `InboxFailedMessageActions` on failed bubbles (Retry / Edit & resend / Copy / Open QR)

**Setting:** `aiFailedSendMaxRetries` (default `3`) on `ai_config`

### 5. Presence treated as greeting
**Cause:** Burst debounce used latest text ("Hi") while earlier message was "Upo online now"; takeover also blocked replies.

**Fix:**
- `pickBurstFocusText()` selects presence/product intent from burst
- Presence regex accepts `uko online now`, trailing punctuation
- Presence fast path before greeting and product paths

### 6. Greeting repeated unnecessarily
**Fix:** `shouldSendFullGreeting()` returns false when recent incoming messages mention products (`macbook`, `chaji`, etc.).

---

## Files changed

### Backend
| File | Change |
|------|--------|
| `src/modules/ai/ai-product-not-found.service.ts` | **New** — catalog search + fallback + demand |
| `src/modules/ai/utils/product-not-found-fallback.util.ts` | **New** — reply templates + query detection |
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Product fallback paths, staff takeover minutes, failed retry hook, burst focus |
| `src/modules/ai/ai-pause-reason.constants.ts` | **New** — pause reason constants |
| `src/modules/ai/entities/ai-config.entity.ts` | 3 new settings columns |
| `src/modules/message/inbox-crm.service.ts` | Takeover expiry, `takeOverFromStaffReply`, `getManualTakeoverRemainingMs` |
| `src/modules/message/entities/inbox-thread-crm.entity.ts` | `manualTakeoverUntil` |
| `src/modules/message/message.service.ts` | Failure metadata, retry/resend, `findMessageById` |
| `src/modules/message/inbox.controller.ts` | Retry/resend endpoints |
| `src/modules/ai/utils/ai-intent-detector.util.ts` | Presence regex |
| `src/modules/ai/utils/ai-behavior.util.ts` | Greeting repeat guard |
| `src/database/migrations/1781060000000-McheleAiReplyFixes.ts` | **New** migration |

### Dashboard
| File | Change |
|------|--------|
| `dashboard/src/components/InboxInteraktAiStatusStrip.tsx` | Manual takeover countdown + Resume / Keep paused |
| `dashboard/src/components/InboxFailedMessageActions.tsx` | **New** — failed message actions |
| `dashboard/src/pages/InboxMessageBubble.tsx` | Failed actions (classic) |
| `dashboard/src/pages/InboxTacticalMessageBubble.tsx` | Failed actions (tactical) |
| `dashboard/src/lib/inbox-ai-takeover.ts` | Manual takeover helpers |
| `dashboard/src/services/api.ts` | `retryMessage`, `resendMessage`, CRM fields |

### Tests
| File | Tests |
|------|-------|
| `src/modules/ai/utils/product-not-found-fallback.util.spec.ts` | 5 |
| `src/modules/message/inbox-crm-takeover.spec.ts` | 3 |
| `dashboard/src/lib/inbox-ai-takeover.spec.ts` | 3 (existing) |

**Result:** Backend Jest **8 passed**, dashboard Vitest **3 passed**, `npm run build:backend` ✅, `npm run dashboard:build` ✅

---

## Behavior reference

### Product not found fallback examples
- **MacBook:** “Kwa sasa sijapata MacBook kwenye catalog yangu Boss…” + budget question
- **Chaji:** “Unamaanisha charger ya iPhone, Android Type-C, au laptop Boss?”
- **Unknown:** “Kwa sasa sijapata hiyo bidhaa…” + notify/alternatives offer

### Takeover expiry
| Pause type | Auto-resume? | Trigger |
|------------|--------------|---------|
| `manual_takeover` | Yes, after `manualTakeoverMinutes` | Staff sends message in thread |
| `explicit` | No | Take Over button / admin pause |
| `opt_out` | No | Customer opt-out |
| Escalation / safety | No | Existing escalation rules |

### Failed send recovery
1. Message marked `failed` with reason in metadata
2. Inbox shows Retry / Edit & resend
3. AI messages auto-retry after 15s (if retryable, not QR/safety)
4. QR failures link to Channels page

---

## Manual QA checklist

- [ ] **1.** Empty catalog simulation: customer “Uko na macbook” → AI fallback reply + demand record in Product Demand
- [ ] **2.** Customer “Chaji” → charger type clarification (not silence)
- [ ] **3.** Staff sends “hi” → strip shows “AI paused by manual reply · resumes in X min”
- [ ] **4.** Wait 15 min (or set `manualTakeoverMinutes=1` for test) → customer “Hi” → AI replies
- [ ] **5.** Force send failure → failed bubble with Retry; retry succeeds when session healthy
- [ ] **6.** Customer “Upo online now” → “Ndiyo Boss niko online 😊” (not full Karibu greeting)
- [ ] **7.** Second “Hi” in active product thread → short “Nipo Boss 😊” not full greeting

---

## Deployment note

Per request: **desktop app was not rebuilt or rsynced**. After review:

```bash
npm run build:backend
npm run dashboard:build
# Then sync to Inauzwa CRM.app when ready
```

Run migration on production DB (automatic on backend start if TypeORM migrations enabled).

---

## Mchele-specific follow-up

1. **Reply now** to unanswered messages: “Nkitaka maembe”, “Yapoo?”, “Mbona kimyaa” (AI preview can answer; deploy fixes for automatic handling).
2. **Restart backend** to pick up learning-settings race fix if not already running new bundle.
3. Catalog is populated — MacBook/charger queries should now get product answers or structured fallback.
