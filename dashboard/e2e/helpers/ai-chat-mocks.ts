import type { Page } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';
import { installSettingsShellMocks } from './settings-shell-mocks';

const AI_CONFIG = {
  enabled: true,
  apiKeySet: true,
  provider: 'ANTHROPIC',
  model: 'claude-opus-4-6',
  toolCallingEnabled: true,
};

export const AI_CONVERSATIONS = [
  {
    id: 'conv-1',
    title: 'Campaign health check',
    createdAt: '2026-06-12T10:00:00.000Z',
    updatedAt: '2026-06-12T10:05:00.000Z',
  },
];

export const AI_MESSAGES = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'How are my campaigns doing?',
    toolCallsJson: null,
    provider: null,
    model: null,
    latencyMs: null,
    createdAt: '2026-06-12T10:00:01.000Z',
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'You have 2 draft demand campaigns ready for review.',
    toolCallsJson: null,
    provider: 'ANTHROPIC',
    model: 'claude-opus-4-6',
    latencyMs: 1200,
    createdAt: '2026-06-12T10:00:05.000Z',
  },
];

export async function installAiChatMocks(page: Page): Promise<void> {
  await installDashboardMocks(page);
  await installSettingsShellMocks(page);

  let conversations = [...AI_CONVERSATIONS];
  let messagesByConv: Record<string, typeof AI_MESSAGES> = {
    'conv-1': [...AI_MESSAGES],
  };
  let nextConv = 2;
  let nextMsg = 3;

  await page.route('**/api/ai/training/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pendingReview: 0, approvedToday: 0, rejectedToday: 0 }),
    });
  });

  await page.route('**/api/settings/ai', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AI_CONFIG),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(AI_CONFIG) });
  });

  await page.route('**/api/ai/conversations**', async route => {
    const method = route.request().method();
    const pathname = new URL(route.request().url()).pathname;

    if (method === 'GET' && pathname.endsWith('/ai/conversations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversations),
      });
      return;
    }

    if (method === 'POST' && pathname.endsWith('/ai/conversations')) {
      const conv = {
        id: `conv-${nextConv++}`,
        title: 'New chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      conversations = [conv, ...conversations];
      messagesByConv[conv.id] = [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conv),
      });
      return;
    }

    const deleteMatch = pathname.match(/\/ai\/conversations\/([^/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const id = deleteMatch[1];
      conversations = conversations.filter(c => c.id !== id);
      delete messagesByConv[id];
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }

    const messagesMatch = pathname.match(/\/ai\/conversations\/([^/]+)\/messages$/);
    if (method === 'GET' && messagesMatch) {
      const id = messagesMatch[1];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(messagesByConv[id] ?? []),
      });
      return;
    }

    await route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not found"}' });
  });

  await page.route('**/api/ai/chat', async route => {
    const body = route.request().postDataJSON() as {
      conversationId?: string;
      messages?: Array<{ role: string; content: string }>;
    };
    const convId = body.conversationId ?? 'conv-1';
    const userMsg = body.messages?.filter(m => m.role === 'user').at(-1);
    const userContent = userMsg?.content ?? 'Hello';
    const normalized = userContent.toLowerCase().trim();

    const userRow = {
      id: `msg-${nextMsg++}`,
      conversationId: convId,
      role: 'user',
      content: userContent,
      toolCallsJson: null,
      agentActionJson: null,
      provider: null,
      model: null,
      latencyMs: null,
      createdAt: new Date().toISOString(),
    };

    let agentAction: Record<string, unknown> | undefined;
    let assistantContent = `Mock reply for: ${userContent.slice(0, 80)}`;
    let provider = 'ANTHROPIC';
    let model = 'claude-opus-4-6';
    let latencyMs = 900;

    if (normalized.includes('zima ai auto reply')) {
      agentAction = {
        actionId: 'ai.auto_reply.disable',
        status: 'success',
        message: 'AI auto reply imezimwa.',
        risk: 'safe',
        data: { oldValue: true, newValue: false },
      };
      assistantContent = String(agentAction.message);
      provider = 'agent-action';
      model = 'ai.auto_reply.disable';
      latencyMs = 0;
    } else if (normalized.includes('zima burst')) {
      agentAction = {
        actionId: 'ai.burst_reading.disable',
        status: 'confirmation_required',
        message: 'Hii inaweza kufanya AI ijibu kila ujumbe tofauti.',
        risk: 'medium',
        confirmationId: 'conf-mock-1',
      };
      assistantContent = String(agentAction.message);
      provider = 'agent-action';
      model = 'ai.burst_reading.disable';
      latencyMs = 0;
    }

    const assistantRow = {
      id: `msg-${nextMsg++}`,
      conversationId: convId,
      role: 'assistant',
      content: assistantContent,
      toolCallsJson: null,
      agentActionJson: agentAction ? JSON.stringify(agentAction) : null,
      provider,
      model,
      latencyMs,
      createdAt: new Date().toISOString(),
    };

    messagesByConv[convId] = [...(messagesByConv[convId] ?? []), userRow, assistantRow];
    conversations = conversations.map(c =>
      c.id === convId ? { ...c, title: userContent.slice(0, 48), updatedAt: new Date().toISOString() } : c,
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: assistantRow.content,
        actions: [],
        provider,
        model,
        latencyMs,
        ...(agentAction ? { agentAction, skippedLlm: true } : {}),
      }),
    });
  });

  await page.route('**/api/agent-actions/confirm', async route => {
    const body = route.request().postDataJSON() as { confirmationId?: string; conversationId?: string };
    const result = {
      actionId: 'ai.burst_reading.disable',
      status: 'success',
      message: 'Burst reading imezimwa.',
      risk: 'medium',
      data: { oldValue: true, newValue: false },
    };

    if (body.conversationId) {
      messagesByConv[body.conversationId] = [
        ...(messagesByConv[body.conversationId] ?? []),
        {
          id: `msg-${nextMsg++}`,
          conversationId: body.conversationId,
          role: 'assistant',
          content: result.message,
          toolCallsJson: null,
          agentActionJson: JSON.stringify(result),
          provider: 'agent-action',
          model: result.actionId,
          latencyMs: 0,
          createdAt: new Date().toISOString(),
        },
      ];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
}
