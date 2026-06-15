# Settings UI WhatsApp-Style Reorganization Report

## Summary

Reorganized the OpenWA dashboard Settings into **7 WhatsApp/Mac-style categories** with a two-level navigation shell (category list + in-card sub-menu + content panel). All existing panel IDs, APIs, and deep links remain supported via canonical URL normalization.

## Files Changed

### New files
- `dashboard/src/components/settings/settings-types.ts`
- `dashboard/src/components/settings/settings-categories-registry.ts`
- `dashboard/src/components/settings/settings-categories-registry.spec.ts`
- `dashboard/src/components/settings/settings-routing.ts`
- `dashboard/src/components/settings/settings-whatsapp.css`
- `dashboard/src/components/settings/settings-page-context.tsx`
- `dashboard/src/components/settings/inline/SettingsInlinePanel.tsx`
- `dashboard/src/components/settings/shell/SettingsHome.tsx`
- `dashboard/src/components/settings/shell/SettingsSubNav.tsx`
- `dashboard/src/components/settings/shell/SettingsRow.tsx`
- `dashboard/src/components/settings/shell/SettingsPanelHeader.tsx`
- `dashboard/src/components/settings/shell/SettingsBreadcrumb.tsx`

### Major updates
- `dashboard/src/components/settings/SettingsShell.tsx` — WhatsApp-style layout
- `dashboard/src/pages/Settings.tsx` — category routing orchestration
- `dashboard/src/components/settings/settings-nav-registry.ts` — new panel IDs, routing re-exports
- `dashboard/src/components/settings/SettingsPanelsRouter.tsx` — `ai-auto-reply`, `ai-human-behavior`
- `dashboard/src/components/settings/AiIntegrationPanel.tsx` — scopes: `autoReplyCore`, `humanBehavior`
- `dashboard/src/i18n/locales/en.json` — category/item i18n keys
- `dashboard/e2e/settings-nav.spec.ts` — updated for new UI
- `dashboard/e2e/ai-human-behavior-settings.spec.ts` — settings panel path added

## Old Settings Structure

- **10 section hubs:** account, appearance, inbox, ai, crm, integrations, system, notifications, data, about
- **7 sidebar groups:** general, channels, ai, crm, integrations, system, privacy
- **19 panel IDs** under flat Interakt sidebar (~320px)
- Human behavior only on `/automations?tab=autoReply`

## New Settings Structure (7 categories)

| Category | Sub-items (high level) |
|----------|------------------------|
| **Profile & Account** | Edit profile, business profile, branches, password, appearance, sessions, about, logout |
| **Chats & Channels** | Inbox preferences, WhatsApp accounts, SMS, quick replies, chat export, default filters |
| **AI Assistant** | Overview, auto reply, human behavior, knowledge, learning, memory, branch/payment, AI tools, provider |
| **Business Tools** | Products, product send rules, lead sources, follow-up rules/templates/autopilot, payment/installment |
| **Notifications & Safety** | Notifications, WhatsApp safety, opt-out, send queue, campaign safety, approval, blocked |
| **System & Advanced** | Users, API keys, webhooks, plugins, infrastructure, logs, storage, database, desktop, dev tools |
| **Help** | Help center, support, version, diagnostics, debug export |

## Panel Migration Map

| Panel ID | Old location | New category |
|----------|--------------|--------------|
| `ai` | AI section | AI Assistant → Provider |
| `ai-auto-reply` | Automations only | AI Assistant → Auto reply |
| `ai-human-behavior` | Automations embed | AI Assistant → Human behavior |
| `ai-tools` | AI section | AI Assistant → AI tools |
| `ai-knowledge` | AI section | AI Assistant → Knowledge |
| `ai-learning` | AI section | AI Assistant → Learning |
| `ai-memory` | AI section | AI Assistant → Memory |
| `ai-branch-profile` | AI section | AI Assistant / Business (payment) |
| `quick-replies` | Inbox/channels | Chats & Channels |
| `products` | Integrations | Business Tools |
| `lead-sources` | CRM | Business Tools |
| `followup-*` | CRM / Automations | Business Tools (rules/autopilot → automations redirect) |
| `whatsapp-safety` | Integrations | Notifications & Safety |
| `webhooks`, `plugins`, `infrastructure` | Integrations | System & Advanced |
| `users`, `api-keys`, `logs` | System | System & Advanced |
| `storage-backup` | Data | System & Advanced |
| `desktop-app` | About | System & Advanced |

## Search Behavior

- Registry-driven index in `settings-categories-registry.ts` (`buildSettingsSearchIndex`, `searchSettingsIndex`)
- Top-left search matches category titles, item titles, keywords, and legacy aliases
- Examples: `typing` → Human behavior; `webhook` → Webhooks; `whatsapp` → WhatsApp accounts + WhatsApp safety

## Route / Backward Compatibility

- Canonical URL: `/settings?category=<id>&item=<id>&panel=<panelId>`
- Legacy `?section=` URLs redirect to `?category=` via `canonicalizeSettingsSearchParams`
- Legacy `?integration=` / `?tool=` / `panel=ai-config` / `panel=inauzwa` still normalize
- `settingsPanelHref()` now emits `category` + `panel` (panel IDs unchanged)
- App.tsx legacy redirects (`/webhooks`, `/api-keys`, etc.) unchanged

## Permissions

- Uses existing `panelAllowsAccess`, `itemAllowsAccess`, `categoryAllowsAccess`
- System category: admin-only at category level
- Business: admin + template/quick-reply permissions for specific items
- Non-admin users: Profile, Chats (partial), Help visible; runtime not blocked beyond existing gates

## Mobile Behavior

- Drill-down: categories → sub-nav → content
- `settings-wa--mobile-hide-main/sub` classes hide prior level on small screens
- 48px min touch targets on category rows

## Tests & Build

| Check | Result |
|-------|--------|
| `npm run build` | Pass |
| `npm test -- settings-categories-registry.spec.ts` | 9/9 pass |
| E2E | Updated specs; run `npx playwright test settings-nav ai-human-behavior-settings` locally |

## Remaining Risks

1. ~~**Hebrew i18n**~~ — category/item keys added to `he.json` (2026-06-12 follow-up).
2. ~~**Advanced timing UI**~~ — collapsible ms fields for active/warm/cold/burst/typing in Human behavior panel (2026-06-12 follow-up).
3. **Password self-service** — stub info panel only (no backend API).
4. **Embedded panels** (WhatsApp/SMS/Sessions) — mobile overflow CSS added; may need further tuning on very narrow viewports.
5. **Automations** still hosts full auto-reply + human behavior for backward compatibility; settings splits auto-reply core vs human behavior.
6. **Old flat-nav helpers** (`settings-flat-nav.ts`, hub search keys) remain in codebase for other references but are no longer primary settings navigation.

## Design Tokens

WhatsApp green system applied via `settings-whatsapp.css`:
- Background `#F7F8F6`, card `#FFFFFF`, primary `#00A884`, active `#E7F8EF` / `#075E54`, danger `#EA0038`
