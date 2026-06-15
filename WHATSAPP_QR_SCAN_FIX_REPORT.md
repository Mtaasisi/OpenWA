# WhatsApp QR Scan Fix Report

Scope: **QR scan reliability, large-account connect stability, and throttled background sync** (Puppeteer bulk tuning and inbox cache were not included).

## Problem

Large or slow WhatsApp logins made the QR flow feel broken:
- Modal showed QR stack after phone already linked
- Heavy post-connect work (`getChats()`, media backfill, inbox polling) competed with wwjs sync → browser crash → `disconnected_before_ready`
- Auth failures looked like generic disconnects
- No progress during long chat store load

## What was fixed

### Connect protection (auth → ready)
- Pause inbox / layout polling while any session is connecting
- Gate live `listChats()` enrichment on `session.status === READY`
- Lighter inbound message handler during sync window (`WA_SYNC_WINDOW_MS`, default 5 min) — skips `getChat()` / `getContact()` for bulk history
- `loading_screen` progress forwarded to dashboard via WebSocket `statusMessage`
- Transient disconnect during connect → **connect-phase reconnect** (`SESSION_CONNECT_RECONNECT_ATTEMPTS`, default 20); terminal reasons (`LOGOUT`, `CONFLICT`, etc.) still mark **Failed**
- `WA_SESSION_READY_TIMEOUT_MS=0` remains default (no auto-fail while loading)
- Puppeteer args from `.env` wired into plugin engine path

### Background slow sync (after ready)
- `BackgroundSyncService` defers enrichment until `WA_BACKGROUND_SYNC_DELAY_MS` (default 60s)
- Throttled media backfill (`WA_MEDIA_BACKFILL_DELAY_MS`, default 500ms between items)
- Batched chat/profile enrichment (`WA_BACKGROUND_CHAT_BATCH_SIZE`, `WA_BACKGROUND_CHAT_BATCH_DELAY_MS`)
- `backgroundSyncing` flag + progress on WebSocket and session list API
- Inbox uses DB data immediately; live enrichment fills in slowly

### Dashboard UX
- Hide QR image after `authenticated` / `loading_chats`; show syncing copy + optional **Continue in background**
- Sessions card: spinner (not QR icon) after scan; **Syncing in background…** badge
- `getQRCode` returns live engine status (not stale DB row)

## Files changed

| Area | Files |
|------|--------|
| Backend | `background-sync.service.ts`, `session.service.ts`, `session.module.ts`, `message.service.ts`, `whatsapp-web-js.adapter.ts`, `engine.factory.ts`, `plugins/engines/whatsapp-web-js/index.ts`, `configuration.ts`, `session-response.dto.ts`, `session.controller.ts` |
| Dashboard | `SessionQrModal.tsx`, `useSessionStartFlow.ts`, `useWebSocket.ts`, `useInboxController.ts`, `Layout.tsx`, `Sessions.tsx`, `Inbox.tsx`, `api.ts`, `en.json`, `he.json` |
| Tests | `session.service.spec.ts`, `background-sync.service.spec.ts` |
| Config | `.env.example` |

## Env vars

```env
WA_SESSION_READY_TIMEOUT_MS=0
WA_SLOW_CONNECT_NOTICE_MS=60000
WA_BACKGROUND_SYNC_DELAY_MS=60000
WA_BACKGROUND_CHAT_BATCH_SIZE=20
WA_BACKGROUND_CHAT_BATCH_DELAY_MS=30000
WA_BACKGROUND_PROFILE_DELAY_MS=2000
WA_MEDIA_BACKFILL_DELAY_MS=500
WA_SYNC_WINDOW_MS=300000
SESSION_CONNECT_RECONNECT_ATTEMPTS=20
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu
```

## Ops notes for large accounts

- Use **4 GB+ RAM** per large WhatsApp session
- Link from **Sessions** page first; avoid opening Inbox during initial connect
- Remove stale linked devices on phone if re-linked many times
- After scan, wait for **Phone linked, syncing…** — not QR
