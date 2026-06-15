# AI Reply Behavior Audit and Fix Report

**Date:** 2026-06-12  
**Scope:** Full audit of human-like AI auto-reply implementation (18 phases)

## Executive summary

The human-like auto-reply system was largely implemented in a prior pass. This audit found **gaps in seed packaging, stale-generation safety during typing, metadata persistence, presence pattern coverage, and timing telemetry**. All identified gaps were fixed without removing existing AI features.

## Files scanned (primary)

| Area | Files |
|------|-------|
| Auto-reply orchestration | `src/modules/ai/ai-inbox-auto-reply.service.ts` |
| Human timing | `src/modules/ai/services/ai-human-timing.service.ts` |
| Intent / behavior | `src/modules/ai/utils/ai-intent-detector.util.ts`, `ai-behavior.util.ts` |
| Name detection | `src/modules/ai/utils/customer-name-detector.util.ts`, `customer-profile-enrichment.service.ts` |
| Outbound send | `src/modules/message/message.service.ts` |
| Settings / migration | `ai-config.entity.ts`, `ai-settings.service.ts`, `1780930000000-AddAiHumanBehaviorSettings.ts` |
| Knowledge seed/sync | `seed/ai-knowledge/*`, `ai-knowledge.service.ts` |
| Dashboard UI | `dashboard/src/components/settings/AiIntegrationPanel.tsx` |
| Safety delay | `src/modules/whatsapp-safety/utils/ai-reply-delay.util.ts` |
| Tests | `ai-intent-detector.util.spec.ts`, `ai-behavior.util.spec.ts`, `ai-human-timing.service.spec.ts`, `customer-name-detector.util.spec.ts` |

## Issues found vs status

| # | Issue | Status |
|---|-------|--------|
| 1 | `Upo online now` could be treated as greeting via safety delay classifier | **Fixed** — presence excluded from greeting delay bucket |
| 2 | Stale generation could still send after typing sleep | **Fixed** — stale checks before typing, after typing, before send |
| 3 | Typing not cleared when new inbound message arrives | **Fixed** — `scheduleAutoReply` stops typing on generation bump |
| 4 | Presence fast path limited to active conversations only | **Fixed** — warm/cold single-message presence also fast-path |
| 5 | `PRESENCE_RE` missing `unanijibu` / `unajibu` | **Fixed** |
| 6 | `replyToBurstLatestMessage` config unused | **Fixed** — `pickBurstQuotedMessageId` wired |
| 7 | Quoted/burst metadata not persisted on outbound messages | **Fixed** — `buildOutboundMetadata` in `message.service.ts` |
| 8 | Timing logs missing | **Fixed** — burst wait, generation, typing, send, total logged |
| 9 | Seed files missing human-behavior rules | **Fixed** — `AI_REPLY_RULES.md`, `FAQ.md`, `AI_REPLY_EXAMPLES.md` updated |
| 10 | `AI_RULES_VERSION` mismatch | **Fixed** — `2026-06-human-timing-presence-v1` |
| 11 | Settings UI missing quoted-reply toggles | **Fixed** |
| 12 | Manual QA checklist missing | **Fixed** — `AI_REPLY_MANUAL_QA_CHECKLIST.md` |

## Behavior verification

### Presence intent
- Dedicated `isPresenceIntent()` with priority before greeting in `processAutoReply`
- Fast deterministic path: `Ndiyo Boss niko online 😊`
- Seed FAQ and examples document correct behavior

### Greeting repeat prevention
- `greetingRepeatCooldownMinutes` default 240
- `shouldSendFullGreeting` + `pickRepeatedGreetingReply` used on greeting path
- Seed rules document no-repeat policy

### Human-like timing
- `AiHumanTimingService` classifies active/warm/cold/burst states
- Defaults match spec (active 1.5–4s, warm 3.5–7s, cold 7–12s, burst 5–9s, max 30s)
- Presence single-message fast path across conversation states

### Typing indicator
- No typing during debounce/wait (`noTypingDuringDebounce` default true)
- Typing starts only in `sendCustomerAiReply` after reply is prepared
- Duration scales with reply length/complexity
- Cleared on send/fail/skip and on new inbound message

### Burst aggregation
- `PendingAutoReply` stores `messages[]`, `incomingTexts[]`, timestamps, generation
- Timer resets per message; one combined reply via `buildBurstCombinedText` + prompt instruction

### Stale generation
- Generation bumped on each inbound message
- Stale checks at process start, before typing, after typing, before agent send
- Typing cleared when superseded

### Suspicious name confirmation
- `SUSPICIOUS_NAME_WORDS` + `AWAITING_NAME_CONFIRMATION` flow
- `mchele` asks confirmation; `Juma` saves normally

### Quoted reply
- Uses `messageService.reply` when `waMessageId` exists and setting enabled
- Fallback to `sendText` on failure
- Metadata: `repliedToWaMessageId`, `burstMessageIds`, `burstWaMessageIds`

### Seed / runtime sync
- Bundled files updated with presence, timing, burst, typing, name rules
- Version marker `AI_RULES_VERSION: 2026-06-human-timing-presence-v1` applied on sync
- User-edited files without version marker are not overwritten (backup on update)

### Default settings / migration
- Migration `1780930000000-AddAiHumanBehaviorSettings` present
- `ai-settings.service.ts` ensures defaults for new and existing configs

### Settings UI
- AI Human Behavior section includes timing, style, cooldown, presence, suspicious name, no typing during debounce, quoted reply toggles

## Tests added/updated

- `ai-intent-detector.util.spec.ts` — `unanijibu`, `unajibu`, presence vs greeting priority
- `ai-behavior.util.spec.ts` — `pickBurstQuotedMessageId`
- Existing: presence, greeting cooldown, human timing, suspicious name tests retained

## Build and test results

| Command | Result |
|---------|--------|
| `npm run build` (backend) | **Pass** |
| `cd dashboard && npm run build` | **Pass** |
| `npm test -- --testPathPatterns="ai-intent-detector\|ai-behavior\|ai-human-timing\|customer-name-detector"` | **26/26 passed** |

## Follow-up: runtime knowledge migration (2026-06-12)

Legacy bundled files in `data/ai-knowledge/` without `AI_RULES_VERSION` were incorrectly treated as user-edited and skipped. **Fixed** in `ai-knowledge.service.ts`: bundled files missing a version marker now migrate with backup when seed has a version. After backend restart, `AI_REPLY_RULES.md` and `FAQ.md` received presence/timing rules.

## Remaining risks / manual checks

1. **Live WhatsApp quoted reply** — depends on engine `replyToMessage` and valid `waMessageId`; verify on real session.
2. **Provider latency** — human timing adds intentional delay; logs help separate model latency from timing rules.
3. **Custom knowledge files** (not in bundled list, or edited in Settings without version marker) are still preserved and not overwritten.
4. **Broader AI module tests** — 6 smoke suites fail on pre-existing Baileys ESM import; 12 human-behavior-related suites pass (58 tests).

## Manual QA

See `AI_REPLY_MANUAL_QA_CHECKLIST.md` for step-by-step live inbox verification.
