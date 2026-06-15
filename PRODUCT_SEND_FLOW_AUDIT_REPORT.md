# Product Send Flow Audit Report

**Date:** 2026-06-08  
**Scope:** Inbox Product Picker → `POST /products/:id/send` → `productsService.sendToChat`

## Files changed

| File | Change |
|------|--------|
| `src/modules/message/message.service.ts` | Added `assertInboxSendAllowed()` — REST-friendly wrapper over `gateInboxSend` + engine check |
| `src/modules/products/products.controller.ts` | Pass full `apiKey` to `sendToChat` |
| `src/modules/products/products.service.ts` | Session/chat validation, product-specific checks, audit logging, `apiKey`-based actor |
| `src/modules/products/products.module.ts` | Import `AuditModule` |
| `src/modules/products/products.service.spec.ts` | **New** — 8 unit tests for send flow |
| `dashboard/src/components/InboxProductPicker.tsx` | Success UX, chat-type guard, errors, variant stock UI, query invalidation, send lock |
| `dashboard/src/pages/inbox-helpers.ts` | Added `getProductSendEligibility()` |
| `dashboard/src/i18n/locales/en.json` | New `products.inbox.*` error/label keys |
| `dashboard/src/i18n/locales/he.json` | Hebrew translations for new keys |

## Verified flow

```
InboxProductPicker
  → productsApi.previewMessage (optimistic bubble)
  → productsApi.send
  → POST /products/:id/send
  → productsService.sendToChat
      → messageService.assertInboxSendAllowed (API key, session READY, inbox chat, engine)
      → product/variant/image validation
      → optional INAUZWA refresh + reload product
      → messageService.sendText | sendImage | sendImageAlbum
      → auditService.logInfo(MESSAGE_SENT, source: product-send)
      → followupConversationService.recordStaffMessage + stage/productInterest update
  → frontend: remove optimistic, invalidate queries, success status 2.5s, onSent()
```

Existing WhatsApp inbox text/image sending paths are unchanged. Product picker structure and API response shapes are unchanged.

## Validation added

| Check | Layer | Error |
|-------|-------|-------|
| API key session allow-list | `assertInboxSendAllowed` | `403 Forbidden` — API key not authorized for this WhatsApp session |
| Non-inbox chat (status/broadcast/newsletter) | `assertInboxSendAllowed` | `400` — Cannot send to this chat type |
| Session not `READY` | `assertInboxSendAllowed` | `400` — not connected (status: …); QR hint when `qr_ready` |
| No active engine | `assertInboxSendAllowed` | `400` — no active WhatsApp engine |
| Chat not in session inbox | `assertInboxSendAllowed` | `400` — Chat not found in inbox for this session |
| Unknown/inactive variant | `sendToChat` | `400` — Variant not found or not active |
| Variant out of stock (in-stock-only) | `sendToChat` | `400` — Selected variant has no stock |
| No active variants with stock | `sendToChat` | `400` — No active variants with stock |
| Include image but no URLs | `sendToChat` | `400` — No product image available |
| Empty message body | `sendToChat` | `400` — Nothing to send (in-stock filter) |

## Frontend guards

| Chat type | Behavior |
|-----------|----------|
| Direct (`@c.us`, etc.) | Send enabled — label **Send Product** |
| Group (`@g.us`) | Send enabled — label **Product Post** |
| Blocked (status/broadcast/newsletter) | Send disabled — explanation banner |

Additional client checks: no image when **Send product image** is on; variant rows disabled when out of stock with in-stock-only; expanded API error mapping.

## Audit tracking

After every successful product send, `AuditAction.MESSAGE_SENT` is logged with metadata:

- `source: 'product-send'`
- `productId`, `variantId`, `includeImage`, `chatId`, `messageId`, `timestamp`
- `apiKeyId` via `AuditContext.apiKey`

Image/album sends do not extend `sendImage`/`sendImageAlbum` signatures; audit is centralized in `productsService.sendToChat`.

## Query invalidation (after successful send)

- `queryKeys.inboxMessages(sessionId, chatId)`
- `['inbox', 'crm', sessionId, chatId]`
- `['products', 'picker']`
- Parent `onSent()` → conversation list invalidation (unchanged)

## Tests added

`src/modules/products/products.service.spec.ts` — **8/8 passing**

1. Product send text only (+ audit + follow-up `productInterest`/`productId`)
2. Product send with image (single URL → `sendImage`)
3. Product send with multiple images (`sendImageAlbum`)
4. Variant send (`variantId` in message text)
5. In-stock-only empty variant error
6. Disconnected session blocks send
7. Unauthorized session blocks send
8. Follow-up stage/productInterest updates (`PRICE_SENT` / `PRODUCT_SUGGESTED`)

```bash
npm test -- --testPathPatterns=products.service.spec
```

## Build results

| Target | Result |
|--------|--------|
| Backend `npm run build` | **Pass** |
| Dashboard `npm run dashboard:build` | **Pass** (2026-06-08 re-verify) |
| `products.service.spec` | **11/11 pass** (2026-06-08 re-verify) |

## Remaining risks

1. **Interakt modal closes on success** — confirmation also shown via toolbar label flash (`sendSuccessUntil`, 2.5s) and thread refresh; embedded/tactical picker shows inline success status.
2. **Text product sends** may call `recordStaffMessage` twice (manual + `message:sent` hook) — left unchanged to avoid inbox regressions.
3. **New chats without DB messages** rely on engine `listChats()` (same as inbox gate).
4. **No E2E WhatsApp test** — unit tests mock `MessageService` and repositories.
5. **Hebrew strings** for new keys may need native review.
6. **`refreshStock` / INAUZWA** — picker only sends `refreshStock: true` when `canQuickSync()`; sync failure is best-effort before send.
7. **Imageless products** — text fallback when `includeImage` but no URLs (frontend + backend).
