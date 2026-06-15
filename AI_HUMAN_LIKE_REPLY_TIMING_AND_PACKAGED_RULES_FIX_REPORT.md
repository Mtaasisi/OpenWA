# AI Human-Like Reply Timing and Packaged Rules Fix Report

**Date:** 2026-06-12  
**Version:** `2026-06-human-timing-presence-v1`

## Summary

AI auto-reply now behaves like a real human customer-care agent: presence questions get correct fast replies, greetings do not repeat unnecessarily, burst messages are aggregated into one reply, typing is realistic and only shown before send, suspicious names require confirmation, and all rules/defaults are bundled for new installations.

---

## Files Changed

### Core backend
| File | Change |
|------|--------|
| `src/modules/ai/ai-inbox-auto-reply.service.ts` | Burst aggregation, human timing, presence/greeting rules, realistic typing, quoted reply |
| `src/modules/ai/services/ai-human-timing.service.ts` | **New** timing engine |
| `src/modules/ai/utils/ai-intent-detector.util.ts` | Presence intent detection (priority over greeting) |
| `src/modules/ai/utils/ai-behavior.util.ts` | Presence/greeting helpers, cooldown logic |
| `src/modules/ai/utils/customer-name-detector.util.ts` | Suspicious name detection + confirmation flow |
| `src/modules/ai/customer-profile-enrichment.service.ts` | `AWAITING_NAME_CONFIRMATION` flow |
| `src/modules/ai/customer-profile.enums.ts` | New conversation flow enum value |
| `src/modules/ai/ai-inbox-reply-rules.ts` | Presence + no-repeat greeting prompt rules |
| `src/modules/ai/ai-signal.enums.ts` | `PRESENCE` intent |
| `src/modules/ai/entities/ai-config.entity.ts` | Human behavior default columns |
| `src/modules/ai/ai-settings.service.ts` | Settings get/upsert/ensure defaults |
| `src/modules/ai/dto/ai.dto.ts` | DTO fields for human behavior |
| `src/modules/ai/ai-knowledge.service.ts` | Versioned seed sync with backup |
| `src/modules/ai/ai.module.ts` | Register `AiHumanTimingService` |
| `src/modules/message/message.service.ts` | Quoted reply accepts outbound AI context |
| `src/database/migrations/1780930000000-AddAiHumanBehaviorSettings.ts` | **New** migration |

### Seed / knowledge
| File | Change |
|------|--------|
| `seed/ai-knowledge/AI_REPLY_RULES.md` | Presence, greeting, timing, burst, typing, name rules |
| `seed/ai-knowledge/FAQ.md` | Presence + suspicious name Q&A |
| `seed/ai-knowledge/AI_REPLY_EXAMPLES.md` | **New** good/bad examples |
| `seed/ai-knowledge/README_AI_TRAINING_SETUP.md` | **New** bundled rules setup note |

### Dashboard
| File | Change |
|------|--------|
| `dashboard/src/components/settings/AiIntegrationPanel.tsx` | AI Human Behavior settings section |
| `dashboard/src/services/api.ts` | Config type fields |
| `dashboard/src/i18n/locales/en.json` | i18n strings |

### Tests
| File | Change |
|------|--------|
| `src/modules/ai/utils/ai-intent-detector.util.spec.ts` | **New** |
| `src/modules/ai/services/ai-human-timing.service.spec.ts` | **New** |
| `src/modules/ai/utils/ai-behavior.util.spec.ts` | Presence + greeting cooldown |
| `src/modules/ai/utils/customer-name-detector.util.spec.ts` | Suspicious name cases |

---

## Presence Intent Fix

- **Before:** `Upo online now` could get `Mambo vipi Boss 😊 Karibu Inauzwa.`
- **After:** Deterministic reply `Ndiyo Boss niko online 😊` (or `Ndiyo Boss niko hapo 😊` / delayed ack when appropriate)
- Presence patterns checked **before** greeting and **before** LLM agent
- `Hi` / `Hello` alone remain greetings; `Hi?` / `Hello?` are presence pings

---

## Greeting Repeat Fix

- Full welcome only when: greeting-only message + no recent greeting + conversation not active
- Default cooldown: **240 minutes** (`greetingRepeatCooldownMinutes`)
- Repeated greeting → `Nipo Boss 😊` or `Karibu Boss, nikuangalizie nini?`

---

## Human Timing Engine

`AiHumanTimingService` decides:
- `waitBeforeProcessingMs` by conversation state (active / warm / cold / burst)
- `typingDurationMs` by reply length/complexity
- No WhatsApp typing during debounce/wait (`noTypingDuringDebounce` default true)

Default wait ranges:
| State | Wait (ms) |
|-------|-----------|
| Active | 1500–4000 |
| Warm | 3500–7000 |
| Cold | 7000–12000 |
| Burst pause | 5000–9000 (max 30000) |

Reply styles: **Fast** / **Balanced** / **Careful** (multipliers on wait/typing)

---

## Realistic Typing

- Typing starts only when final reply is ready to send
- Duration scales with message length (1200–14000ms cap)
- Extra time for product/payment/location lookups
- Typing cleared immediately after send/fail/skip

---

## Burst Message Aggregation

Per `sessionId:chatId` burst collects:
- `firstMessageAt`, `lastMessageAt`, `messages[]`, `incomingTexts[]`
- Timer resets on each new message; processes after pause or max burst window
- Combined prompt: `Customer sent multiple messages: 1. … 2. …`
- Agent instruction to answer all burst messages in one reply

---

## Suspicious Name Confirmation

- Words like `mchele`, `simu`, `iphone`, `boss`, locations, etc. → ask `Nikutambue kama {name} Boss?`
- Save only after customer confirms (`ndiyo` / `yes` / `sawa`)
- Normal names still auto-save with `Sawa {name}, ngoja nisave namba yako 😊`
- Name correction still replies `Ahaa basi powa nimekupata.`

---

## Quoted Reply Support

- When `autoReplyUseQuotedReply` is enabled (default true), AI quotes latest burst message
- Falls back to normal `sendText` if quoted reply fails
- Metadata: `repliedToWaMessageId`, `burstMessageIds`, `burstWaMessageIds`

---

## Seed AI Knowledge Files

Updated/created in `seed/ai-knowledge/` with version marker:
```
AI_RULES_VERSION: 2026-06-human-timing-presence-v1
```

---

## Runtime Sync Behavior

`AiKnowledgeService` on boot:
- Copies bundled rule files when missing
- Updates seed-managed files when version is older (with `.bak-{timestamp}` backup)
- Skips overwrite when file appears user-edited (no version marker + substantial content)
- Desktop runtime path: `~/Library/Application Support/Inauzwa CRM/ai-knowledge/` (via `AI_KNOWLEDGE_PATH`)

---

## Default Settings / Migration

Migration `1780930000000-AddAiHumanBehaviorSettings` adds defaults to `ai_config`:
- `humanTimingEnabled: true`
- All wait/typing/burst/cooldown defaults per spec
- `presenceIntentEnabled: true`
- `suspiciousNameConfirmationEnabled: true`
- `autoReplyUseQuotedReply: true`
- `noTypingDuringDebounce: true`
- `humanReplyStyle: balanced`

Applied on fresh DB, Docker boot migration, and desktop first-run migration.

---

## Desktop / Docker Support

- Docker image includes updated `seed/ai-knowledge/`
- Desktop `config-manager.ts` already provisions `ai-knowledge` subdir; server boot seeds via `AiKnowledgeService`
- Desktop `setup/seed` continues to seed branch profiles; AI knowledge seeds on module init

---

## UI Settings

**Automations → AI auto-reply → AI Human Behavior:**
- Human-like timing toggle
- Reply style (Fast / Balanced / Careful)
- Greeting repeat cooldown
- Presence replies toggle
- Suspicious name confirmation toggle
- Hide typing during wait toggle

---

## Tests Added / Passed

```
npm test -- --testPathPatterns="ai-intent-detector|ai-human-timing|ai-behavior.util|customer-name-detector"
→ 4 suites, 24 tests passed
```

Coverage includes:
- Presence intent detection
- Greeting vs presence separation
- Active/cold wait ranges
- Typing scales with length
- Burst text combination
- Suspicious name `mchele` confirmation
- Greeting cooldown / repeat ack

---

## Build Result

| Target | Result |
|--------|--------|
| Backend `npm run build` | ✅ Pass |
| Dashboard `npm run build` | ✅ Pass |

---

## Manual QA Checklist

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Customer: `Upo online now` | `Ndiyo Boss niko online 😊` |
| 2 | `Hello` after AI already greeted | No full welcome repeat |
| 3 | Many quick messages | One complete reply |
| 4 | During debounce/wait | No typing indicator |
| 5 | Before send | Realistic typing appears |
| 6 | Long vs short reply | Longer typing for long reply |
| 7 | `Jina langu ni mchele` | Confirmation question, no auto-save |
| 8 | Normal name `Naitwa Asha` | Saves correctly |
| 9 | Fresh install | Rules + defaults from package seed |
| 10 | Reindex knowledge | Presence examples findable |
| 11 | Existing user seed update | `.bak-*` backup created |
| 12 | Build | Passes |

---

## Notes

- Existing AI features (learning, product search, profiling, safety, inbox) preserved
- No separate feature flag required — enabled by default for new installs
- Existing installs receive new columns via migration with safe defaults
