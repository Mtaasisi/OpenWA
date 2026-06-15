# AI Settings Operator / System Agent — Implementation Report

**Date:** 2026-06-13  
**Version:** `AGENT_ACTION_RULES_VERSION: 2026-06-agent-settings-operator-v1`

## Summary

Implemented a controlled **AI Settings Operator** so the existing Staff AI Assistant (`/ai`) can interpret Swahili/English settings commands, execute safe changes, require confirmation for risky actions, offer quick links when direct execution is unsafe, and audit every attempt.

The existing AI Assistant, auto-reply, inbox, settings UI, and status bar were **extended**, not replaced.

---

## Backend module

New Nest module: [`src/modules/agent-actions/`](src/modules/agent-actions/)

| File | Role |
|------|------|
| `agent-actions.module.ts` | Module wiring |
| `agent-action.types.ts` | Shared types |
| `agent-action-registry.data.ts` | 43 action definitions |
| `agent-action-registry.service.ts` | Registry lookup |
| `agent-action-matcher.service.ts` | Deterministic NL matcher (Swahili/English) |
| `agent-action-router.service.ts` | Match → permission → risk → execute/confirm/link |
| `agent-action-executor.service.ts` | Safe wrappers over domain services |
| `agent-action-permission.service.ts` | Role/permission mapping |
| `agent-action-risk.service.ts` | Safe/medium/high/blocked policy |
| `agent-action-confirmation.service.ts` | 5-minute confirmation TTL |
| `agent-action-audit.service.ts` | Dedicated audit table + platform audit |
| `agent-action-link.service.ts` | Settings route map (mirrors dashboard nav) |
| `agent-action-diagnostic.service.ts` | App health + AI not replying diagnosis |
| `agent-action-settings.service.ts` | Packaged defaults |
| `agent-action.controller.ts` | REST API |
| `dto/agent-action.dto.ts` | Request DTOs |

Registered in [`src/app.module.ts`](src/app.module.ts).

### API endpoints

- `POST /api/agent-actions/resolve`
- `POST /api/agent-actions/execute`
- `POST /api/agent-actions/confirm`
- `GET /api/agent-actions` (+ `?pending=true`)
- `GET /api/agent-actions/audit` (admin)

### AI chat integration

[`src/modules/ai/ai-chat.controller.ts`](src/modules/ai/ai-chat.controller.ts) runs `AgentActionRouterService.resolve()` **before** the LLM when the last user message matches an action (confidence ≥ 0.85). Response includes `agentAction` + `skippedLlm: true`. Persisted on `ai_chat_messages.agentActionJson`.

---

## Action registry (43 actions)

### Safe direct execution (examples)

- `ai.auto_reply.enable` / `ai.auto_reply.disable`
- `ai.reply_style.fast` / `balanced` / `careful`
- `ai.burst_reading.enable`, `ai.presence_replies.enable`, `ai.quoted_reply.*`
- `ai.suspicious_name_confirmation.enable`
- `ai.knowledge.reindex`
- `whatsapp.safety.enable`, `whatsapp.campaigns.pause`
- `followup.autopilot.disable`
- `branch.switch` (name resolution via AI branch profiles + INAUZWA prefs)
- `app.health.check`, `ai.reply.diagnose`

### Confirmation required

- `ai.burst_reading.disable` (medium)
- `whatsapp.session.reconnect`, `whatsapp.campaigns.resume` (medium)
- `followup.autopilot.enable` (medium)
- `queue.retry_failed`, `backup.create` (medium, admin)
- `ai.memory.clear`, `whatsapp.safety.disable`, `whatsapp.session.remove` (high, admin)
- `payment.details.update`, `user.role.change`, `data.export` (high — mostly quick-link only)

### Quick link only

- `whatsapp.qr.open`, `payment.settings.open`, `products.open`, `followup.rules.open`, `users.open`, `logs.open`, `webhooks.open`, `plugins.open`, `infrastructure.open`, `api_keys.open`, `ai.provider.change`, etc.

### Blocked

- `db.raw_query` — refused with safe alternative

---

## Permission rules

Mapped to existing `ApiKeyRole` (admin / operator / viewer):

| Permission | Admin | Operator | Viewer |
|------------|-------|----------|--------|
| Safe AI/WhatsApp toggles | ✓ | ✓ | ✗ (links/diagnose only) |
| Medium writes | ✓ confirm | ✓ confirm | ✗ |
| High / admin-only | ✓ confirm | ✗ | ✗ |
| Diagnostics | ✓ | ✓ | ✓ |

No direct database writes from user text — all mutations go through existing services.

---

## Database

Migration: [`src/database/migrations/1781040000000-AddAgentActionSystem.ts`](src/database/migrations/1781040000000-AddAgentActionSystem.ts)

- `agent_action_settings` (single-row defaults)
- `agent_action_confirmations`
- `agent_action_audit_logs`
- `ai_chat_messages.agentActionJson`

Audit enum extended in [`src/modules/audit/entities/audit-log.entity.ts`](src/modules/audit/entities/audit-log.entity.ts):

- `AGENT_ACTION_EXECUTED`, `AGENT_ACTION_DENIED`, `AGENT_ACTION_CONFIRMED`

---

## Frontend

| Change | Path |
|--------|------|
| Action cards in AI chat | [`dashboard/src/components/agent-actions/AgentActionCard.tsx`](dashboard/src/components/agent-actions/AgentActionCard.tsx) |
| AI chat wiring | [`dashboard/src/pages/AiChat.tsx`](dashboard/src/pages/AiChat.tsx) |
| API client | [`dashboard/src/services/api.ts`](dashboard/src/services/api.ts) — `agentActionsApi`, extended `AiChatResult` |
| Agent actions log panel | [`dashboard/src/components/settings/AgentActionsLogPanel.tsx`](dashboard/src/components/settings/AgentActionsLogPanel.tsx) |
| Settings nav | [`settings-nav-registry.ts`](dashboard/src/components/settings/settings-nav-registry.ts), [`settings-categories-registry.ts`](dashboard/src/components/settings/settings-categories-registry.ts) |
| AI hub example prompts | [`AiCategoryHub.tsx`](dashboard/src/components/settings/shell/AiCategoryHub.tsx) |
| Status bar More popover | [`AppBottomStatusBar.tsx`](dashboard/src/components/status-bar/AppBottomStatusBar.tsx) |

Card styling: white cards, `#E5EDE5` border, success `#008069`, warning `#B26A00`, error `#EA0038`.

---

## Seed / knowledge

- [`seed/ai-knowledge/AGENT_ACTION_RULES.md`](seed/ai-knowledge/AGENT_ACTION_RULES.md)
- Bundled via [`BUNDLED_KNOWLEDGE_FILES`](src/modules/ai/ai-knowledge.service.ts)

Default settings (DB seed via migration): `agentActionsEnabled: true`, confirmations on for medium/high, audit enabled.

---

## Tests & build

| Check | Result |
|-------|--------|
| Backend `npm run build` | ✓ Pass |
| Dashboard `npm run build` | ✓ Pass |
| `agent-action-matcher.service.spec.ts` (8 tests) | ✓ Pass |
| `agent-action-permission.service.spec.ts` (6 tests) | ✓ Pass |
| `agent-action-router.service.spec.ts` (6 tests) | ✓ Pass |
| `agent-action-llm-matcher.service.spec.ts` (3 tests) | ✓ Pass |
| E2E mocks + `ai-chat-studio.spec.ts` agent-action cases | ✓ Added |
| E2E `settings-ask-ai.spec.ts` (7 tests) | ✓ Pass |

---

## Follow-up pass (confirm flow + settings deep links)

- **`POST /agent-actions/confirm`** accepts optional `conversationId`; when set, persists an assistant message with `agentActionJson` via `AiChatConversationsService`.
- **`AiChat.tsx`** passes `activeConvId` on confirm and invalidates message query.
- **`SettingsAskAiButton`** wired into `AiIntegrationPanel` header (prefills operator prompts to `/ai?prompt=...`).
- **`ai-app-tools.ts`**: staff tools (`resolve_agent_action`, `confirm_agent_action`, `diagnose_ai_reply`) + `ApiKeyRole` import fix for build.

---

## Manual QA checklist

1. Ask AI: **"Zima AI auto reply"** → disables + success card  
2. Ask AI: **"Washa AI auto reply"** → enables + success card  
3. Ask AI: **"Fanya AI ijibu faster"** → fast reply style  
4. Ask AI: **"Reindex AI knowledge"** → reindex result  
5. Ask AI: **"Onyesha QR ya WhatsApp"** → quick link to channels  
6. Ask AI: **"Zima safety guard"** → confirmation card (not silent disable)  
7. As non-admin: **"Change user role"** → permission denied + link  
8. Ask AI: **"Badilisha payment details"** → quick link (no unsafe write)  
9. Settings → System → **Agent Actions Log** → recent entries  
10. Status bar **More** → Agent Actions On, pending count, log link  

---

## Follow-up pass (LLM fallback + Ask AI on settings panels)

- **`AgentActionLlmMatcherService`**: when deterministic matcher confidence is 0.55–0.84, a lightweight LLM classifier (`AiChatService.completeStructuredPrompt`) can raise confidence to ≥ 0.85 before execution.
- **`SettingsIntegrationShell`**: optional `askAiPanelId` prepends **Ask AI to change this** using `SETTINGS_ASK_AI_PROMPTS`.
- Wired on all major settings panels including Users, Webhooks, Plugins, Infrastructure, API Keys.
- Full `settings.agentActions.*` strings in `en.json` and `he.json`.
- **Follow-up Autopilot** (`/automations?tab=autopilot`): inline Ask AI button in `FollowupAutopilotSettingsPanel`.
- E2E: `dashboard/e2e/settings-ask-ai.spec.ts` + `helpers/settings-ask-ai-mocks.ts`.

---

## Remaining limitations

- Follow-up create for customer is a guided hint (opens inbox flow), not full auto-schedule without template/time params.
- LLM fallback only runs when deterministic matcher already finds a candidate (0.55–0.84); no LLM pass for zero-match phrases.
- Payment detail updates always route to settings — no structured field parsing yet.
- Memory clear wipes file contents and reindexes — no selective per-file clear via NL.
- Staff AI tools exist in `ai-app-tools.ts` for LLM tool-calling path; **pre-route in `/ai/chat` remains the primary fast path** for matched phrases.

---

## Files changed (high level)

**Backend:** `src/modules/agent-actions/**`, `src/app.module.ts`, `src/modules/ai/ai-chat.controller.ts`, `ai-chat-conversations.service.ts`, `ai.module.ts`, `ai.dto.ts`, `ai-chat-message.entity.ts`, `ai-app-tools.ts`, `ai-knowledge.service.ts`, `ai-settings.service.ts` (duplicate key fix), `audit-log.entity.ts`, migration `1781040000000-*`

**Frontend:** `AgentActionCard*`, `AiChat.tsx`, `api.ts`, `AgentActionsLogPanel.tsx`, settings registries, `SettingsPanelsRouter.tsx`, `AiCategoryHub.tsx`, `AppBottomStatusBar.tsx`

**Seed:** `seed/ai-knowledge/AGENT_ACTION_RULES.md`
