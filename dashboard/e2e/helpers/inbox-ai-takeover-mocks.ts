import type { Page } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';
import { mockAuthRoutes } from './auth';

export const AI_TAKEOVER_SESSION_ID = 'sess-ai-takeover';
export const AI_TAKEOVER_CHAT_ELIGIBLE = '255711111111@c.us';
export const AI_TAKEOVER_CHAT_BLOCKED = '255722222222@c.us';

export type InboxAiTakeoverMockOptions = {
  crm?: {
    aiAutoReplyPaused?: boolean;
    aiHandlingState?: string;
    aiOptOut?: boolean;
    autopilotPauseReason?: string | null;
    manualTakeoverUntil?: string | null;
  };
  conversations?: Array<ReturnType<typeof buildEligibleConversation> | ReturnType<typeof buildBlockedConversation>>;
  messages?: Array<Record<string, unknown>>;
};

function buildConversationBase(chatId: string, displayName: string) {
  return {
    sessionId: AI_TAKEOVER_SESSION_ID,
    sessionName: 'Main WA',
    sessionStatus: 'ready',
    chatId,
    displayName,
    customerName: displayName,
    lastMessageAt: new Date().toISOString(),
    lastPreview: 'Hello',
    lastDirection: 'incoming' as const,
    messageCount: 1,
    unreadCount: 0,
    hasUnread: false,
    resolved: false,
    hasFollowUp: false,
    customerPhone: chatId.replace('@c.us', ''),
  };
}

export function buildEligibleConversation() {
  return {
    ...buildConversationBase(AI_TAKEOVER_CHAT_ELIGIBLE, 'AI Ready Customer'),
    aiAutoReplyPaused: false,
    aiHandlingState: 'idle',
    aiOptOut: false,
  };
}

export function buildBlockedConversation() {
  return {
    ...buildConversationBase(AI_TAKEOVER_CHAT_BLOCKED, 'Blocked Customer'),
    aiAutoReplyPaused: true,
    aiHandlingState: 'human_handling',
    aiOptOut: false,
  };
}

function buildDefaultCrm(overrides: InboxAiTakeoverMockOptions['crm'] = {}) {
  return {
    sessionId: AI_TAKEOVER_SESSION_ID,
    chatId: AI_TAKEOVER_CHAT_ELIGIBLE,
    resolved: false,
    resolvedAt: null,
    internalNote: null,
    followUpAt: null,
    customerName: 'AI Ready Customer',
    customerPhone: '255711111111',
    linkedExternalId: null,
    aiAutoReplyPaused: false,
    aiHandlingState: 'idle',
    aiEscalatedAt: null,
    aiOptOut: false,
    autopilotPauseReason: null,
    manualTakeoverUntil: null,
    resolvedReason: null,
    resolvedNote: null,
    outcome: null,
    ...overrides,
  };
}

export function buildManualTakeoverCrm(minutesRemaining = 12) {
  return {
    aiAutoReplyPaused: true,
    aiHandlingState: 'idle',
    autopilotPauseReason: 'manual_takeover',
    manualTakeoverUntil: new Date(Date.now() + minutesRemaining * 60_000).toISOString(),
  };
}

export function buildFailedOutgoingMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-failed-e2e',
    sessionId: AI_TAKEOVER_SESSION_ID,
    chatId: AI_TAKEOVER_CHAT_ELIGIBLE,
    from: '255700000001',
    to: AI_TAKEOVER_CHAT_ELIGIBLE,
    body: 'Nipo Boss — failed to send',
    type: 'chat',
    direction: 'outgoing',
    timestamp: Date.now(),
    status: 'failed',
    metadata: {
      source: 'ai',
      sendFailureReason: 'Network timeout',
      retryable: true,
      retryCount: 0,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Inbox mocks for AI takeover confirm + blocked status strip flows. */
export async function installInboxAiTakeoverMocks(
  page: Page,
  options: InboxAiTakeoverMockOptions = {},
): Promise<void> {
  const conversations = options.conversations ?? [buildEligibleConversation()];
  const crm = buildDefaultCrm(options.crm);
  const messages = options.messages ?? [];

  await installDashboardMocks(page);

  await page.route('**/api/whatsapp-consent/lookup**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        optInStatus: 'opted_in',
        canMarketing: true,
        canFollowup: true,
        within24h: true,
        requiresTemplate: false,
        lastCustomerMessageAt: new Date().toISOString(),
      }),
    });
  });

  await page.route('**/api/sessions**', async route => {
    const url = route.request().url();
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (url.includes('/messages') || url.includes('/contacts/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: AI_TAKEOVER_SESSION_ID,
          name: 'Main WA',
          status: 'ready',
          phone: '255700000001',
          aiAutoReplyEnabled: true,
        },
      ]),
    });
  });

  await page.route('**/api/inbox/conversations**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        conversations,
        total: conversations.length,
        limit: 200,
        offset: 0,
      }),
    });
  });

  await page.route(`**/api/sessions/${AI_TAKEOVER_SESSION_ID}/messages**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages, total: messages.length }),
    });
  });

  await page.route('**/api/inbox/threads/crm**', async route => {
    const url = route.request().url();
    if (route.request().method() === 'GET') {
      const chatId = new URL(url).searchParams.get('chatId') ?? crm.chatId;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...crm, chatId }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/inbox/threads/crm/ai-resume**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...crm,
        aiAutoReplyPaused: false,
        aiHandlingState: 'idle',
      }),
    });
  });

  await page.route('**/api/inbox/send-text**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'msg-e2e-1', timestamp: Date.now() }),
    });
  });

  await page.route('**/api/inbox/messages/*/retry**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messageId: 'msg-retried-e2e', timestamp: Date.now() }),
    });
  });

  await mockAuthRoutes(page);
}

export async function seedInteraktTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openwa_active_theme_id', 'interakt-inbox');
  });
}
