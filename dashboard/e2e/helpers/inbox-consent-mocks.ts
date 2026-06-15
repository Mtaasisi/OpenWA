import type { Page } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';
import { mockAuthRoutes } from './auth';

export const INBOX_CONSENT_SESSION_ID = 'sess-1';
export const INBOX_CONSENT_CHAT_ID = '255712345678@c.us';

export type InboxConsentLookupMock = {
  optInStatus: string;
  canMarketing: boolean;
  canFollowup: boolean;
  within24h: boolean;
  requiresTemplate: boolean;
  lastCustomerMessageAt: string | null;
};

const DEFAULT_CRM = {
  sessionId: INBOX_CONSENT_SESSION_ID,
  chatId: INBOX_CONSENT_CHAT_ID,
  resolved: false,
  resolvedAt: null,
  internalNote: null,
  followUpAt: null,
  customerName: 'Test Customer',
  customerPhone: '255712345678',
  linkedExternalId: null,
  aiAutoReplyPaused: false,
  aiHandlingState: 'idle',
  aiEscalatedAt: null,
  aiOptOut: false,
  resolvedReason: null,
  resolvedNote: null,
  outcome: null,
};

function buildConversation() {
  return {
    sessionId: INBOX_CONSENT_SESSION_ID,
    sessionName: 'Main WA',
    sessionStatus: 'ready',
    chatId: INBOX_CONSENT_CHAT_ID,
    displayName: 'Test Customer',
    lastMessageAt: new Date().toISOString(),
    lastPreview: 'Hello',
    lastDirection: 'incoming' as const,
    messageCount: 1,
    unreadCount: 0,
    hasUnread: false,
    resolved: false,
    hasFollowUp: false,
    customerPhone: '255712345678',
  };
}

export async function installInboxConsentMocks(
  page: Page,
  options: { consentLookup?: InboxConsentLookupMock } = {},
): Promise<void> {
  const consentLookup = options.consentLookup ?? {
    optInStatus: 'opted_out',
    canMarketing: false,
    canFollowup: false,
    within24h: false,
    requiresTemplate: true,
    lastCustomerMessageAt: null,
  };

  await installDashboardMocks(page);

  await page.route('**/api/whatsapp-consent/lookup**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(consentLookup),
    });
  });

  await page.route('**/api/inbox/conversations**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations: [buildConversation()],
        total: 1,
        limit: 200,
        offset: 0,
      }),
    });
  });

  await page.route(`**/api/sessions/${INBOX_CONSENT_SESSION_ID}/messages**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [], total: 0 }),
    });
  });

  await page.route('**/api/inbox/threads/crm**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_CRM),
    });
  });

  await mockAuthRoutes(page);
}
