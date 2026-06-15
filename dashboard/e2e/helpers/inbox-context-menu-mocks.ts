import type { Page } from '@playwright/test';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  E2E_INBOX_CHAT_ID,
  E2E_INBOX_READY_SESSION_ID,
  installInboxAfterConnectMocks,
} from './inbox-after-connect-mocks';

export function buildInboxTestMessage() {
  const now = new Date().toISOString();
  return {
    id: 'msg-in-1',
    waMessageId: 'wa-msg-in-1',
    sessionId: E2E_INBOX_READY_SESSION_ID,
    chatId: E2E_INBOX_CHAT_ID,
    direction: 'incoming' as const,
    type: 'text',
    body: 'Hello from Alice',
    createdAt: now,
    from: E2E_INBOX_CHAT_ID,
    to: E2E_INBOX_READY_SESSION_ID,
    status: 'received',
  };
}

export async function installInboxContextMenuMocks(page: Page): Promise<void> {
  const ready = buildReadyInboxSession();
  const conversation = buildInboxConversation(ready.id);

  await installInboxAfterConnectMocks(page, {
    sessions: [ready],
    conversations: [conversation],
  });

  await page.route(`**/api/sessions/${ready.id}/messages**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [buildInboxTestMessage()], total: 1 }),
    });
  });

  await page.route('**/api/inbox/threads/crm**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: ready.id,
        chatId: E2E_INBOX_CHAT_ID,
        resolved: false,
        resolvedAt: null,
        internalNote: null,
        followUpAt: null,
        customerName: 'Alice Customer',
        customerPhone: '255798765432',
        linkedExternalId: null,
        aiAutoReplyPaused: false,
        aiHandlingState: 'idle',
        aiEscalatedAt: null,
        aiOptOut: false,
        resolvedReason: null,
        resolvedNote: null,
        outcome: null,
      }),
    });
  });
}
