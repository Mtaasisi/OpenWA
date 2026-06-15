import type { Page } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';

export const E2E_INBOX_READY_SESSION_ID = 'sess-inbox-ready';
export const E2E_INBOX_CONNECTING_SESSION_ID = 'sess-inbox-connecting';
export const E2E_INBOX_CHAT_ID = '255798765432@c.us';

export type InboxE2eSession = {
  id: string;
  name: string;
  status: string;
  phone?: string | null;
  backgroundSyncing?: boolean;
  requiresRelink?: boolean;
  engineAuthPresent?: boolean;
  aiAutoReplyEnabled?: boolean;
  followupAutopilotEnabled?: boolean;
  staffAiAllowedNumbers?: string[];
  engineType?: string | null;
  effectiveEngineType?: string;
  createdAt?: string;
  updatedAt?: string;
};

function sessionBase(overrides: Partial<InboxE2eSession>): InboxE2eSession {
  const now = new Date().toISOString();
  return {
    id: E2E_INBOX_READY_SESSION_ID,
    name: 'ready-wa',
    status: 'ready',
    phone: '255700000001',
    createdAt: now,
    updatedAt: now,
    aiAutoReplyEnabled: true,
    followupAutopilotEnabled: false,
    staffAiAllowedNumbers: [],
    engineType: null,
    effectiveEngineType: 'baileys',
    engineAuthPresent: true,
    requiresRelink: false,
    backgroundSyncing: false,
    ...overrides,
  };
}

export function buildReadyInboxSession(overrides: Partial<InboxE2eSession> = {}): InboxE2eSession {
  return sessionBase(overrides);
}

export function buildConnectingInboxSession(overrides: Partial<InboxE2eSession> = {}): InboxE2eSession {
  return sessionBase({
    id: E2E_INBOX_CONNECTING_SESSION_ID,
    name: 'linking-wa',
    status: 'authenticating',
    phone: '255700000002',
    ...overrides,
  });
}

export function buildInboxConversation(sessionId: string, displayName = 'Alice Customer') {
  return {
    sessionId,
    sessionName: sessionId === E2E_INBOX_READY_SESSION_ID ? 'ready-wa' : 'linking-wa',
    sessionStatus: 'ready',
    chatId: E2E_INBOX_CHAT_ID,
    displayName,
    customerName: displayName,
    lastMessageAt: new Date().toISOString(),
    lastPreview: 'Hello from Alice',
    lastDirection: 'incoming' as const,
    messageCount: 1,
    unreadCount: 1,
    hasUnread: true,
    resolved: false,
    hasFollowUp: false,
    customerPhone: '255798765432',
  };
}

export type InboxAfterConnectMockOptions = {
  sessions: InboxE2eSession[];
  conversations?: ReturnType<typeof buildInboxConversation>[];
};

/** Inbox E2E mocks (ready / syncing flows) — mirrors inbox-consent-mocks routing. */
export async function installInboxAfterConnectMocks(
  page: Page,
  options: InboxAfterConnectMockOptions,
): Promise<void> {
  await installDashboardMocks(page);

  const sessions = options.sessions;
  const conversations = options.conversations ?? [];

  await page.route('**/api/sessions/stats**', async route => {
    const ready = sessions.filter(s => s.status === 'ready').length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ready,
        disconnected: sessions.filter(s => s.status === 'disconnected').length,
        qr_ready: sessions.filter(s => s.status === 'qr_ready').length,
        total: sessions.length,
      }),
    });
  });

  await page.route('**/api/sessions/*/contacts/*/profile-picture/**', async route => {
    await route.fulfill({ status: 404, body: '' });
  });

  await page.route('**/api/sessions**', async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (
      url.includes('/messages') ||
      url.includes('/contacts/') ||
      url.includes('/health/') ||
      url.includes('/engine')
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessions),
    });
  });

  await page.route('**/api/inbox/conversations**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations,
        total: conversations.length,
        limit: 50,
        offset: 0,
      }),
    });
  });

  for (const session of sessions) {
    await page.route(`**/api/sessions/${session.id}/messages**`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [], total: 0 }),
      });
    });
  }
}
