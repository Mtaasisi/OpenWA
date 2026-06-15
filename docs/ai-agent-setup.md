# AI agent setup (OpenWA)

This guide covers the WhatsApp customer agent, staff dashboard assistant, knowledge base, and memory.

## Prerequisites

1. **API key** — Settings → Integrations → AI: choose a provider (OpenAI, Gemini, Anthropic, etc.), paste your key, pick a model, enable AI.
2. **Tool calling** — Leave **Allow AI to query live app data** enabled for staff chat and customer tools.
3. **Restart the API** after changing AI modules or migrations.

## Customer inbox auto-reply

| Setting | Recommendation |
|--------|------------------|
| Enable AI auto-reply | On |
| Private chats only | On (default) |
| Cooldown minutes | **0** so every customer message gets a reply after the debounce |
| Per-session toggle | Sessions → account → AI auto-reply |
| Per-chat toggle | Inbox CRM panel → AI auto-reply / opt-out |
| Auto opt-out | Customer messages like “stop”, “human”, “no bot” disable AI for that chat |
| Opt-out reply | One short acknowledgment (customizable in AI settings) is sent automatically |

Use the inbox filter **Needs human** for chats in `waiting_human` or `human_handling`. Use **AI opt-out** for chats where the customer asked to stop AI (badge counts show on filter chips).

`GET /settings/ai/status` returns config plus memory/knowledge chunk counts and whether pgvector semantic search is active.

**Flow:** Inbound message → 4s debounce → customer agent (`search_products`, `search_shop_knowledge`, `update_lead`, `escalate_to_human`) → one WhatsApp reply.

**Product replies:** When a customer says “MacBook”, “iPhone”, etc. without “battery/charger”, the agent lists **devices first** (name, price, variant — stock counts are hidden from customers), then one optional line about related accessories. `search_products` returns variant rows for accurate quotes. Hardcoded rules live in `src/modules/ai/ai-inbox-reply-rules.ts`; extended behavior rules are in `data/ai-knowledge/` (`AI_REPLY_RULES.md`, `DISCOUNT_ESCALATION_RULES.md`, etc.).

**States:** `ai_handling` → `waiting_human` after escalation → staff **Take over** sets `human_handling`. **Resume AI** clears pause.

**Circuit breaker:** After repeated failures per session, auto-reply stops and the chat is escalated.

## Shop knowledge (customer + staff)

Settings → Integrations → **Shop knowledge** (or **Automations → AI Auto-reply** for auto-reply toggles)

### Bundled Inauzwa training (default forever)

On every API boot, files in `seed/ai-knowledge/` sync into `./data/ai-knowledge/` (or `AI_KNOWLEDGE_PATH`). All installs get the same Inauzwa training by default:

| File | Purpose |
|------|---------|
| `AI_REPLY_RULES.md` | Core WhatsApp reply behavior |
| `AI_REPLY_EXAMPLES.md` | Example customer/staff phrasing |
| `SHOP.md` | Shop overview, categories, tone |
| `FAQ.md` | Customer FAQs |
| `BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md` | Branch + payment guidance |
| `PAYMENT_RULES.md` | When/how to share lipa namba |
| `DELIVERY_RULES.md` | Pickup, delivery, shipping |
| `WARRANTY_RULES.md` | Warranty and returns |
| `INSTALLMENT_PRODUCT_RULES.md` | Installment eligibility |
| `DISCOUNT_ESCALATION_RULES.md` | Discount defense + escalation |
| `POLICIES.md` | General shop policies |
| `PRODUCT_QA.md` | Product Q&A patterns |
| `FAQ_KNOWLEDGE.md` | FAQ index for RAG |
| `README_AI_TRAINING_SETUP.md` | Setup notes for operators |

**Version sync:** Each bundled file gets an `AI_RULES_VERSION` marker. When the app updates and the version bumps, existing installs receive new training on restart (previous file backed up as `.bak-*`). Files you edited in Settings without a version marker are not overwritten.

**Auto-reply linkage:** Customer agent (`AiInboxAgentService`) injects knowledge via `buildContextualPromptExcerpt()` (RAG, default ON) and the `search_shop_knowledge` tool. Hardcoded rules also live in `src/modules/ai/ai-inbox-reply-rules.ts`.

- **Reindex knowledge** runs automatically on boot when `AI_KNOWLEDGE_AUTO_INDEX` is not `false`.
- **Branch AI profile** (Settings → Integrations) supplies live location/payment via `get_branch_location` and `get_payment_details`.
- **Product catalog** with prices/stock still required for `search_products` — markdown alone cannot replace live DB data.

## Long-term memory (staff only)

Settings → Integrations → **AI memory**

- Default staff memory seeds from `seed/ai-memory/MEMORY.md` with the same version-sync behavior as knowledge.
- Runtime files live under `./data/ai-memory` (or `AI_MEMORY_PATH`).
- Staff assistant tools: `memory_search`, `memory_get`, `memory_write`, `memory_list_files`.
- **Reindex memory** — chunks files and stores embeddings (requires **PostgreSQL** + **OpenAI or Gemini** API key for vector search).
- **Memory dream** (admin): promotes chunks recalled ≥3 times into `MEMORY.md`.
- **Scheduled dream**: set `AI_MEMORY_DREAM_INTERVAL_HOURS=24` (0 = off).

| Env | Purpose |
|-----|---------|
| `AI_MEMORY_PATH` | Memory files directory |
| `AI_MEMORY_AUTO_INDEX` | `false` to skip reindex on API boot |
| `AI_MEMORY_DREAM_INTERVAL_HOURS` | Auto-run dream (e.g. `24`) |

On **SQLite**, search uses keyword chunks only (no pgvector). On **Postgres**, hybrid search blends vector similarity (70%) + keywords (30%).

Viewer API keys do not get memory or admin-only tools.

## Staff AI chat

- Route: **AI Assistant** in the sidebar.
- Image attachments require a vision model (e.g. `gpt-4o`, `gemini-1.5`, `claude-3`).
- Tools are filtered by API key role: viewer (read/search), operator (+ pipeline/follow-ups), admin (+ infra/audit/settings).

## Staff AI via WhatsApp

Sessions → session details → **Staff AI allowed numbers** (E.164). Those numbers get CRM AI replies on WhatsApp (separate from customer auto-reply).

## Migrations

Run on your data database:

- `178050`–`178058` — auto-reply, handling state, message AI metadata, `aiOptOut`, opt-out ack message, memory/knowledge index (+ pgvector on Postgres).

## Troubleshooting

| Symptom | Check |
|--------|--------|
| No reply to second message | Cooldown = 0; chat not paused/opt-out |
| AI keeps saying Hi | Cooldown/history; preset/tone in AI settings |
| Empty staff chat | API key, model, tool calling enabled |
| Images ignored | Vision-capable model in settings/fallbacks |
| Escalation stuck | Inbox → Resume AI or take over manually |
