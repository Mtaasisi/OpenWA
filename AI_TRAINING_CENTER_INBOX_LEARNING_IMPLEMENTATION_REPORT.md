# AI Training Center — Inbox Learning Implementation Report

## Summary

Implemented a full **AI Training Center** inside the AI Assistant (`/ai?tab=training`) by extending the existing AI learning stack rather than rebuilding it. Admins can scan inbox/system events, review training items with multiple-choice suggestions, approve with custom instructions, and safely apply learning to knowledge files, AI memory, and the `ai_learning_knowledge` DB — with backups, PII masking, reindex control, and audit logs.

## Files scanned (existing architecture)

| Area | Key paths |
|------|-----------|
| AI learning queue | `src/modules/ai/entities/ai-learning-item.entity.ts`, `ai-learning-items.service.ts` |
| Inbox hooks | `src/modules/ai/ai-learning-inbox.service.ts` |
| Knowledge/RAG | `src/modules/ai/ai-knowledge.service.ts`, `ai-knowledge-index.service.ts` |
| Memory | `src/modules/ai/ai-memory.service.ts`, `data/ai-memory/MEMORY.md` |
| Seed knowledge | `seed/ai-knowledge/*.md` (15 files incl. `AI_REPLY_RULES.md`, `FAQ.md`, `PRODUCT_QA.md`, etc.) |
| Settings learning UI | `dashboard/src/components/settings/ai-learning/` |
| AI Assistant | `dashboard/src/pages/AiChat.tsx` |
| Agent actions | `src/modules/agent-actions/` |

## New backend module

**`src/modules/ai-training/`**

| File | Role |
|------|------|
| `ai-training.module.ts` | Nest module registered in `AiModule` |
| `ai-training.types.ts` | Enums + DTO types |
| `ai-training.controller.ts` | REST `/api/ai-training/*` |
| `ai-training.service.ts` | Overview, list, settings |
| `ai-training-scan.service.ts` | Manual/scheduled/system scan; real-time item creation |
| `ai-training-question-generator.service.ts` | Admin-friendly training questions |
| `ai-training-suggestion.service.ts` | 3–6 MCQ options per item |
| `ai-training-approval.service.ts` | Preview, approve, apply with permissions |
| `ai-training-knowledge-writer.service.ts` | Backup + structured markdown sections + dedupe |
| `ai-training-memory-writer.service.ts` | Append to staff `MEMORY.md` |
| `ai-training-router.service.ts` | Intent → target file / tool rule |
| `ai-training-audit.service.ts` | Audit log writes |
| `ai-training-reindex.service.ts` | Stale flag + auto/manual reindex |
| `utils/ai-training-sanitize.util.ts` | PII mask, payment detection, custom instruction parse |

## Database

**Migrations:** `1781080000000-AddAiTrainingCenter.ts`, `1781090000000-AddAiTrainingScanSchedule.ts`, `1781100000000-AddTrainingKnowledgeMatchThreshold.ts`

- Extended **`ai_learning_items`**: `issueType`, `sourceType`, `messageId`, `productId`, `metadata`, `appliedAt`, etc.
- Extended **`ai_learning_settings`**: Training Center toggles, `knowledgeIndexStale`, `trainingKnowledgeMatchThreshold` (default 0.65)
- New tables: **`ai_training_suggestions`**, **`ai_training_approvals`**, **`ai_training_audit_logs`**
- Extended status enum: `applied`, `needs_more_info`

## Training Center UI

- **`AiAssistantShell`** — tabs: Chat | Diagnose | Training | Knowledge | Actions | Logs
- **`AiTrainingCenterPanel`** — KPI cards, inner tabs (Pending/Suggested/Approved/Applied/Ignored/History), scan/reindex/manual actions
- **`AiTrainingReviewPanel`** (embedded) — MCQ options A–G pattern, custom answer/instruction, target file selector, approve & apply
- WhatsApp-style tokens: `#F7F8F6`, `#00A884`, `#E5EDE5`, 18–24px radius
- Settings learning panel **unchanged** at `/settings?section=ai&panel=ai-learning`

## Inbox scan engine

`AiTrainingScanService` detects:

- Low confidence / escalated replies (via extended `AiLearningInboxService.handleLowConfidence`)
- Human takeover / staff corrections (`handleStaffCorrection` + `createFromHumanReply`)
- Manual scan of `ai_reply_events` + `WAITING_HUMAN` threads
- Daily interval scan (24h timer)
- System scan: repeated questions clustering, installment demand patterns

## Question generation & MCQ suggestions

- Swahili/English templates for customer care, installment, warranty, payment, delivery
- Each suggestion includes `actionType`, `targetFile`, `confidence`, `risks`, `isRecommended`
- Stored in `ai_training_suggestions`

## Custom instruction handling

- `parseCustomInstruction()` → intent, trigger phrases, rule body
- Preview via `buildPreview()` (no file write until apply)
- Structured markdown sections with `AI_RULE_ID`, approver, date

## Knowledge / memory writer

- Backup to `data/ai-knowledge/backups/{file}.{timestamp}.bak`
- Dedupe by `AI_RULE_ID`
- Blocks raw payment numbers in markdown when DB tools should be used
- Memory writer rejects customer-specific global writes

## Routing

| Intent | Target |
|--------|--------|
| Customer care | `AI_REPLY_RULES.md` + branch tool instruction |
| Installment | `INSTALLMENT_PRODUCT_RULES.md` |
| Warranty | `WARRANTY_RULES.md` |
| Discount | `DISCOUNT_ESCALATION_RULES.md` |
| Payment | `BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md` (tool rule) |
| Product Q | `PRODUCT_QA.md` |
| General FAQ | `FAQ.md` |

## Reindex behavior

- Sets `knowledgeIndexStale` when auto-reindex skipped
- `autoReindexAfterApproval` + `autoReindexSmallUpdatesOnly` settings
- One-click reindex from Training Center header

## Runtime use of approved training

- Existing `AiLearningInboxService.decideBeforeAgent` continues to match `ai_learning_knowledge` first
- Apply flow writes DB knowledge + optional markdown; next inbox reply uses high-confidence match

## Permissions & safety

- `requireAdminApproval` enforced; high-risk targets (payment/discount/warranty/agent) need admin for apply
- PII masking when `maskPrivateDataInExports` enabled
- All applies logged in `ai_training_audit_logs`

## Integrations

- **Status bar More popover**: pending count, high priority, needs reindex, link to `/ai?tab=training`
- **Agent actions**: `ai.training.open`, `ai.training.teach` (link to Training Center)
- **API client**: `aiTrainingApi` in `dashboard/src/services/api.ts`

## Follow-up batches (post-initial delivery)

| Batch | Highlights |
|-------|------------|
| Polish 1 | Inbox “Teach AI” strip, settings modal in Training Center, preview diff, deep link `?item=`, learning alert invalidation |
| Polish 2 | Fixed daily scan time (`dailyScanTime`), LLM MCQ suggestions with heuristic fallback, bulk ignore UI |
| Polish 3 | Bulk approve API/UI, admin-only badges, shared risk helpers, approval service tests (17 total) |
| Polish 4 | Knowledge writer backup tests, memory writer safety tests, apply→backup integration test, Settings → Training Center banner |
| Polish 5 | Audit timeline in review + Logs tab filters, approve/preview E2E stubs, audit invalidation on apply |
| Polish 6 | API e2e tests, auto-select recommended MCQ on review, bulk skip feedback panel |
| Polish 7 | Bulk-approve HTTP e2e with API key injection, auto-select + skip-notes + operator role Playwright tests |
| Polish 8 | Bulk approve draft/override priority, training knowledge retrieval + decideBeforeAgent tests, inbox behavior spec fix |
| Polish 9 | Bulk approve confirm modal with draft overrides UI, live apply→backup integration test, bulk helper vitest |
| Polish 10 | Apply→inbox retrieval integration test, reindex service tests, applied badge + approve E2E |
| Polish 11 | Training paraphrase matching threshold, Applied tab + inbox learn-strip Playwright |
| Polish 12 | Configurable `trainingKnowledgeMatchThreshold` setting + UI, settings threshold E2E |
| Polish 13 | Alternative question phrases on apply, reindex pending toast, settings summary, status bar E2E |
| Polish 14 | findBestMatch minScore alignment, reindex toast E2E, inbox WS item deep link, legacy settings threshold |
| Polish 15 | `?item=` deep link auto-opens review + correct tab, focused card highlight, lowered threshold integration + E2E |
| Polish 16 | Clear/sync `?item=` on review close & approve, scroll focused card into view, shareable review URLs |
| Polish 17 | Invalid `?item=` toast + param cleanup, inbox learn strip → Training Center review journey E2E |
| Polish 18 | Review → filtered logs deep link, operator deep-link admin gate for high-risk items |

## Tests & build (updated)

| Check | Result |
|-------|--------|
| `npm run build` (backend) | Pass |
| `npm run build` (dashboard) | Pass |
| `jest src/modules/ai-training` | 41 pass |
| `jest ai-learning-inbox.behavior` | 12 pass |
| `jest ai-learning-confidence.util` | 6 pass |
| `dashboard vitest ai-training-bulk.spec` | 3 pass |
| `npm run test:ai-learning-api` | includes `ai-training-api.e2e-spec` (5 tests) |
| `playwright e2e/ai-training-center.spec.ts` | 21/21 pass |
| `playwright e2e/inbox-ai-training-learn.spec.ts` | 4/4 pass |
| `playwright e2e/ai-learning-panel.spec.ts` | 6/6 pass |

## Remaining risks

- **`trainingKnowledgeMatchThreshold`** (default 0.65) controls auto-reply bar for training-applied knowledge; legacy knowledge still uses `highConfidenceThreshold`
- LLM suggestions depend on AI provider configuration; fallback templates still apply when LLM fails
- Operator role can bulk-approve safe FAQ items; high-risk items show **Admin only** badge and are skipped
- Settings learning panel (`/settings?panel=ai-learning`) links to Training Center via banner for MCQ/backup flow

## API endpoints

- `GET /api/ai-training/overview`
- `GET /api/ai-training/items`
- `GET /api/ai-training/items/:id`
- `POST /api/ai-training/items` (manual)
- `POST /api/ai-training/scan/inbox`
- `POST /api/ai-training/scan/system`
- `POST /api/ai-training/items/:id/generate-suggestions`
- `POST /api/ai-training/items/:id/preview-approval`
- `POST /api/ai-training/items/:id/approve`
- `POST /api/ai-training/items/:id/reject|ignore`
- `POST /api/ai-training/items/bulk-ignore`
- `POST /api/ai-training/items/bulk-approve`
- `POST /api/ai-training/reindex`
- `GET /api/ai-training/audit`
- `GET|PATCH /api/ai-training/settings`

## Manual QA checklist

1. Customer asks “Naomba namba ya customer care.”
2. AI low confidence or admin manual answer.
3. Training item appears in **AI Assistant → Training**.
4. Admin opens Review.
5. Multiple-choice options appear.
6. Admin selects branch customer care / ask branch option.
7. Admin approves and applies.
8. System writes rule with backup to `AI_REPLY_RULES.md`.
9. Knowledge reindexes (or shows needs reindex badge).
10. Next customer asks same question — AI uses approved knowledge match.
11. If branch known, branch tool path; if unknown, ask Dar/Arusha (via rule text).
12. Audit log shows applied action.
13. Non-admin blocked from high-risk global apply.
14. Settings learning panel still works.
15. Status bar More shows pending training count.
16. Settings → AI Learning shows **Open Training Center** banner.
17. Approve & apply creates a `.bak` file under `data/ai-knowledge/backups/`.
