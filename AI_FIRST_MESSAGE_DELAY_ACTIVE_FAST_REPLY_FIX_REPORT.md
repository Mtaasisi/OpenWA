# AI First Message Delay + Active Fast Reply Fix Report

**Date:** 2026-06-11  
**Scope:** AI auto-reply timing only — no AI feature removal, no desktop repack.

## Summary

AI auto-reply now behaves like an online customer-care agent:
- **Cold / first message:** natural 7–12s wait, no typing during wait, burst collection
- **Active chat (within 5 min):** fast 0.8–2.5s wait + realistic typing before send
- **Warm / cold / burst:** separate timing paths with active vs cold burst pauses
- **Presence in active chat:** fast path with deterministic “Ndiyo Boss niko online 😊”
- **Greeting in active chat:** short “Nipo Boss 😊”, not full welcome

## Files changed

| File | Change |
|------|--------|
| `src/modules/ai/services/ai-human-timing.service.ts` | Rewrote activity detection, burst pauses, presets, typing |
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Pending reply metadata, timing logs, always pass burst |
| `src/modules/ai/utils/ai-behavior.util.ts` | Active-chat hello → short greeting via presence path |
| `src/modules/ai/entities/ai-config.entity.ts` | Balanced default column values |
| `src/modules/ai/ai-settings.service.ts` | Balanced defaults, preset apply on style change |
| `src/database/migrations/1780990000000-UpdateAiHumanTimingBalancedDefaults.ts` | Safe data migration for legacy balanced rows |
| `src/modules/ai/services/ai-human-timing.service.spec.ts` | 7 required scenarios + extras |
| `src/modules/ai/utils/ai-behavior.util.spec.ts` | Active hello / presence tests |
| `seed/ai-knowledge/AI_REPLY_RULES.md` | First message delay + active chat rules |
| `dashboard/src/components/settings/AiIntegrationPanel.tsx` | Preset timing hints in Human Behavior panel |
| `dashboard/src/i18n/locales/en.json` | Timing hint strings |
| `dashboard/src/i18n/locales/he.json` | Timing hint strings (Hebrew) |

## Timing service

**`AiHumanTimingService`** (updated) exports:
- `detectConversationActivity()` — excludes current burst inbound; cold when no prior outbound
- `detectBaseConversationState()` — active / warm / cold from prior exchange
- `computeBurstWaitMs()` — active burst 3.5–7s, cold burst 6–9s, max 30s
- `computeWaitBeforeProcessingMs()` — state-based wait; presence fast only in active chat
- `computeTypingDurationMs()` — short 1.2–2.2s, medium 2.5–5s, long 5–9s, max 14s
- `humanTimingPresetForStyle()` — Fast / Balanced / Careful explicit ranges
- `AI_RULES_VERSION` → `2026-06-first-message-delay-active-fast-v2`

## Behavior

### First message delay (cold)
- No prior outbound → `cold_conversation`
- Wait 7000–12000ms (balanced preset)
- No typing during wait (`stopTypingIndicator` on each new inbound)
- Extra customer messages reset timer; one combined reply

### Active fast reply
- Outbound AI/staff or exchange within 5 minutes → `active_conversation`
- Wait 800–2500ms, then generate + typing + send

### Burst
- Timer resets on each inbound
- Active chat burst: 3500–7000ms after last message
- Cold chat burst: 6000–9000ms after last message
- Max total burst wait: 30000ms

### Typing
- Never during debounce/wait
- Starts in `sendCustomerAiReply()` after reply text is ready
- Stops on send, fail, skip, or superseded generation

### Presence / greeting fast paths
- Active presence → `Ndiyo Boss niko online 😊` (not full welcome)
- Active hello → `Nipo Boss 😊`
- Full welcome only for cold first greeting-only message

## Settings / defaults

| Setting | Balanced default |
|---------|------------------|
| First message (cold) | 7–12 sec |
| Active reply | 0.8–2.5 sec |
| Warm reply | 2.5–6 sec |
| Cold reply | 7–12 sec |
| Burst active | 3.5–7 sec |
| Burst cold | 6–9 sec |
| Active window | 5 min |
| Warm window | 30 min |
| Default preset | Balanced |

Packaged via: entity defaults, `ensureConfig()`, migration for legacy balanced rows, bundled `AI_REPLY_RULES.md`, `AI_RULES_VERSION` bump for knowledge sync on restart.

## Tests

```
npx jest --testPathPatterns="ai-human-timing|ai-behavior.util"
```

| # | Scenario | Result |
|---|----------|--------|
| 1 | Cold first message 7000–12000ms | PASS |
| 2 | Active follow-up 800–2500ms | PASS |
| 3 | Presence active fast + reply text | PASS |
| 4 | Greeting active → Nipo Boss | PASS |
| 5 | Burst active pause | PASS |
| 6 | Burst cold pause | PASS |
| 7 | Typing bounds by length | PASS |

**Total:** 21 tests passed.

## Build result

- **Unit tests:** PASS (21/21 timing + behavior)
- **Full `npm run build`:** FAIL — 3 pre-existing TypeScript errors in `ai-status.service.ts` and `app-status.service.ts` (unrelated to this timing change). No errors in modified timing files.

## Logging

Safe timing logs added (phone masked in chat key):
- `conversationState`, `waitBeforeProcessingMs`, `burstMessageCount`
- `typingDurationMs`, `totalReplyTimeMs`, `timingReason`

Example:
```
AI timing schedule sess:***67: wait=9240ms burst=1 reason=cold_conversation
AI reply timing sess:***67: state=active_conversation wait=1200ms burst=1 typing=1850ms total=4100ms reason=active_conversation
```

## Manual QA steps

1. **New cold chat:** Customer: “Uko na iPhone?” → wait ~7–12s, no typing during wait, then typing + reply.
2. **After AI reply:** Customer: “Bei gani?” → fast reply ~1–3s total including typing.
3. **Presence:** Customer: “Upo online now” (active) → “Ndiyo Boss niko online 😊”.
4. **Burst:** Send “Uko na iPhone?” + “Bei gani?” + “Warranty?” quickly → one combined reply.

## Not changed

- AI safety, circuit breaker, opt-out, staff pause
- Burst reading, quoted reply, product search, knowledge RAG, profiling
- Desktop app bundle (per request)
