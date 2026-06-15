import type { Page } from '@playwright/test';

export const DEFAULT_SAFETY_SETTINGS = {
  id: 'default',
  globalEnabled: true,
  warmupEnabled: true,
  maxOutboundPerHour: 20,
  maxOutboundPerDay: 100,
  maxAutoRepliesPerCustomerPerDay: 999,
  campaignsEnabled: false,
  followupAutoSendEnabled: false,
  aiAutoReplyEnabled: true,
  aiSafetyEnabled: true,
  groupsAutoReplyEnabled: false,
  groupManagementEnabled: false,
  productBulkSendEnabled: false,
  statusPostsEnabled: false,
  whatsappCloudSyncEnabled: false,
  whatsappCloudWabaId: null,
  outside24hRequiresTemplate: true,
  startupSafeModeEnabled: true,
  minDelayBetweenMessagesMs: 500,
  maxDelayBetweenMessagesMs: 25000,
  perContactCooldownMinutes: 0,
  minAiReplyDelayMs: 0,
  maxAiReplyDelayMs: 0,
};

export type WhatsAppSafetyMockOptions = {
  settings?: Partial<typeof DEFAULT_SAFETY_SETTINGS>;
  overview?: {
    safetyEnabled: boolean;
    pendingQueue: number;
    blockedToday: number;
    optedOutContacts: number;
    accountsInWarmup: number;
  };
  queue?: Array<{
    id: string;
    sessionId: string;
    status: string;
    chatId: string;
    source: string;
    riskLevel: string;
    scheduledAt?: string;
    phone?: string | null;
  }>;
  warmups?: Array<{
    id: string;
    sessionId: string;
    dayNumber: number;
    outboundSentToday: number;
    maxOutboundToday: number;
  }>;
};

export async function installWhatsAppSafetyMocks(
  page: Page,
  options: WhatsAppSafetyMockOptions = {},
): Promise<void> {
  const settings = { ...DEFAULT_SAFETY_SETTINGS, ...options.settings };
  const overview = options.overview ?? {
    safetyEnabled: true,
    pendingQueue: 3,
    blockedToday: 2,
    optedOutContacts: 1,
    accountsInWarmup: 1,
  };
  const queue = options.queue ?? [
    {
      id: 'q-approval-1',
      sessionId: 'sess-1',
      status: 'approval_required',
      chatId: '255712345678@c.us',
      source: 'ai',
      riskLevel: 'high',
      scheduledAt: new Date(Date.now() + 45_000).toISOString(),
      phone: '+255712345678',
    },
    {
      id: 'q-pending-1',
      sessionId: 'sess-1',
      status: 'pending',
      chatId: '255798765432@c.us',
      source: 'followup',
      riskLevel: 'low',
      scheduledAt: new Date(Date.now() + 20_000).toISOString(),
    },
  ];
  const warmups = options.warmups ?? [
    {
      id: 'w-1',
      sessionId: 'sess-1',
      dayNumber: 2,
      outboundSentToday: 12,
      maxOutboundToday: 50,
    },
  ];

  await page.route('**/api/whatsapp-safety/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(settings),
      });
      return;
    }
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as Record<string, unknown>;
      Object.assign(settings, patch);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(settings),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/whatsapp-safety/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overview),
    });
  });

  await page.route('**/api/whatsapp-send-queue/stats', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pending: 2, approval_required: 1, sent: 5 }),
    });
  });

  await page.route('**/api/whatsapp-send-queue**', async route => {
    const url = route.request().url();
    if (url.includes('/stats')) {
      await route.fallback();
      return;
    }
    if (url.includes('/approve')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'q-approval-1', status: 'pending' }),
      });
      return;
    }
    if (url.includes('/cancel')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    if (url.includes('/retry')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'q-failed', status: 'pending' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(queue),
    });
  });

  await page.route('**/api/whatsapp-warmup**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(warmups[0]) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(warmups),
    });
  });

  await page.route('**/api/whatsapp-consent**', async route => {
    const url = route.request().url();
    if (url.includes('marketing-gaps')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'c-2', phone: '+255798765432', canMarketing: false, canFollowup: true },
        ]),
      });
      return;
    }
    if (url.includes('/lookup')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          optInStatus: 'opted_in',
          canMarketing: false,
          canFollowup: true,
          within24h: false,
          requiresTemplate: true,
          lastCustomerMessageAt: null,
        }),
      });
      return;
    }
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'c-2', phone: '+255798765432', ...patch }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 'c-1', phone: '+255712345678', optOutReason: 'customer_message' }]),
    });
  });

  await page.route('**/api/whatsapp-safety/blocked-sends**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'b-1', decision: 'blocked', source: 'ai', reason: 'Customer opted out' },
      ]),
    });
  });

  await page.route('**/api/whatsapp-safety/audit-logs**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'a-1', decision: 'blocked', source: 'ai', reason: 'Customer opted out' },
        { id: 'a-2', decision: 'queued', source: 'followup', reason: 'Automated send queued' },
      ]),
    });
  });

  await page.route('**/api/whatsapp-safety/check-send', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ proceed: true, queued: false, blocked: false, reason: 'Manual staff send allowed' }),
    });
  });

  await page.route('**/api/whatsapp-safety/templates/sync-status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: false,
        configured: false,
        hasAccessToken: false,
        phoneNumberIdConfigured: false,
        cloudSendReady: false,
        wabaId: null,
        lastSyncAt: null,
        lastSyncSummary: null,
      }),
    });
  });

  await page.route('**/api/whatsapp-safety/cloud/send-template', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        blocked: false,
        queued: false,
        reason: 'Template sent via WhatsApp Cloud API',
        messageId: 'wamid.e2e-test',
      }),
    });
  });

  await page.route('**/api/whatsapp-safety/templates', async route => {
    if (route.request().url().includes('sync-from-cloud')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'tpl-1',
          name: 'Order update',
          whatsappTemplateName: 'order_update',
          whatsappTemplateStatus: 'approved',
          requiresWhatsappApproval: true,
          category: 'utility',
          isActive: true,
        },
      ]),
    });
  });

  await page.route('**/api/whatsapp-session-health**', async route => {
    const url = route.request().url();
    if (url.match(/\/whatsapp-session-health\/[^/?]+$/)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [],
          automationPaused: false,
          startupSafeMode: false,
          queuePending: 1,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'h-1',
          sessionId: 'sess-1',
          eventType: 'send_blocked',
          severity: 'info',
          message: 'Outside warm-up limits',
          createdAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/sessions**', async route => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'sess-1', name: 'Main WA', status: 'ready', phone: '+255700000000' },
      ]),
    });
  });

  await page.route('**/api/whatsapp-safety/opt-outs/**/restore', async route => {
    const patch = route.request().postDataJSON() as Record<string, unknown> | undefined;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'c-1',
        phone: '+255712345678',
        optInStatus: 'opted_in',
        canMarketing: patch?.canMarketing ?? false,
      }),
    });
  });
}
