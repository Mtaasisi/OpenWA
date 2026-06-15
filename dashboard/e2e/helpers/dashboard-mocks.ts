import type { Page } from '@playwright/test';
import { MOCK_INAUZWA_STATUS } from './inauzwa-status-mock';
import { mockAuthRoutes } from './auth';
import { installInboxApiStubs } from './inbox-api-mocks';

const EMPTY_OVERVIEW = {
  sessions: { active: 1, total: 1, byStatus: { ready: 1 } },
  messages: {
    sent: 0,
    received: 0,
    failed: 0,
    failedBySession: {},
    today: { sent: 0, received: 0, total: 0 },
    last24h: { sent: 0, received: 0, total: 0 },
  },
  apiActivity24h: 0,
};

const EMPTY_INBOX = { conversations: [], total: 0, limit: 200, offset: 0 };

const EMPTY_PIPELINE_COUNTS = {
  new_leads: 0,
  hot_leads: 0,
  waiting_reply: 0,
  followup_needed: 0,
  payment_pending: 0,
  won_leads: 0,
  lost_leads: 0,
};

const EMPTY_PIPELINE_DASHBOARD = {
  leadsByStage: {},
  leadsByStaff: {},
  paymentPending: 0,
};

const EMPTY_AUTOPILOT = {
  enabled: false,
  mode: 'off',
  autoSentToday: 0,
  needsApproval: 0,
  failed: 0,
  pausedAccounts: [],
};

const EMPTY_AI_STATUS = {
  enabled: false,
  apiKeySet: false,
  testStatus: 'unknown',
};

const EMPTY_AUTO_REPLY_HEALTH = {
  masterEnabled: false,
  ready: true,
  checks: [],
  sessions: [],
  stats: {
    aiReplies24h: 0,
    openEscalations: 0,
    knowledgeChunks: 0,
    knowledgeFiles: 0,
  },
};

const EMPTY_AI_SIGNALS = {
  discountRequests: 0,
  installmentRequests: 0,
  paymentConfirmations: 0,
  openEscalations: 0,
  stockingReminders: 0,
  recentEscalations: [],
  openStockingReminders: [],
};

const EMPTY_AUDIT = { data: [], total: 0, limit: 100, offset: 0 };

const EMPTY_CONVERSION = { byStaff: {} };

const APP_STATUS = {
  overall: 'success',
  updatedAt: new Date().toISOString(),
  workSummary: { pending: 0, efficiency: 100 },
  ai: {
    status: 'success',
    label: 'AI ready',
    autoReply: 'on',
    provider: 'OPENAI',
    model: 'gpt-4o',
    knowledgeIndexed: true,
    pendingLearning: 0,
    lastError: null,
  },
  whatsapp: {
    status: 'success',
    label: 'Connected',
    activeSessions: 1,
    qrNeeded: 0,
    disconnected: 0,
    sessions: [],
  },
  queue: { status: 'neutral', pending: 0, delayed: 0, failed: 0 },
  database: {
    status: 'success',
    label: 'Online',
    latencyMs: 4,
    lastPingAt: new Date().toISOString(),
  },
  sync: {
    status: 'success',
    label: 'Synced',
    unsynced: 0,
    failed: 0,
    lastSyncAt: new Date().toISOString(),
  },
  branch: {
    id: 'arusha',
    name: 'Arusha',
    status: 'success',
    paymentProfileConfigured: true,
  },
  user: { id: 'e2e-admin', name: 'E2E Admin', role: 'admin' },
  warnings: [],
};

type DashboardMockOptions = {
  learningAlerts?: Record<string, unknown>;
  aiSignals?: Record<string, unknown>;
  pipelineHotLeads?: unknown[];
  pipelineCounts?: Partial<typeof EMPTY_PIPELINE_COUNTS>;
};

export async function installDashboardMocks(
  page: Page,
  options: DashboardMockOptions = {},
): Promise<void> {
  await installInboxApiStubs(page);

  const learningAlerts =
    options.learningAlerts ??
    ({
      learning: {
        pendingCount: 0,
        unknownToday: 0,
        repeatedUnknownCount: 0,
        staffCorrectionsWaiting: 0,
        urgentWaitingCustomers: 0,
        aiPausedChats: 0,
        topPending: [],
      },
      demand: {
        outOfStockDemand: 0,
        installmentDemand: 0,
        missingProducts: 0,
        mostAskedProduct: null,
        draftCampaignsCount: 0,
        topDraftCampaigns: [],
      },
      profile: {
        nameReview: 0,
        learningReview: 0,
        lostWaiting: 0,
        openLostDemand: 0,
      },
    } satisfies Record<string, unknown>);

  const aiSignals = { ...EMPTY_AI_SIGNALS, ...(options.aiSignals ?? {}) };
  const pipelineHotLeads = options.pipelineHotLeads ?? [];
  const pipelineCounts = { ...EMPTY_PIPELINE_COUNTS, ...(options.pipelineCounts ?? {}) };

  await page.route('**/api/dashboard/whatsapp-safety-alerts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        blockedToday: 0,
        pendingQueue: 0,
        warmups: [],
        approvalRequired: [],
        criticalAlerts: [],
      }),
    });
  });

  await page.route('**/api/dashboard/ai-learning-demand-alerts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(learningAlerts),
    });
  });

  await page.route('**/api/**', async route => {
    const url = route.request().url();

    if (
      url.includes('/api/auth/') ||
      url.includes('/api/dashboard/ai-learning-demand-alerts') ||
      url.includes('/api/dashboard/whatsapp-safety-alerts') ||
      url.includes('/api/whatsapp-safety') ||
      url.includes('/api/whatsapp-send-queue') ||
      url.includes('/api/whatsapp-warmup') ||
      url.includes('/api/whatsapp-consent') ||
      url.includes('/api/whatsapp-session-health')
    ) {
      await route.fallback();
      return;
    }

    if (url.includes('/api/app/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(APP_STATUS),
      });
      return;
    }
    if (url.includes('/api/whatsapp-safety/link-preflight/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notReadyCount: 0, sessions: [] }),
      });
      return;
    }
    if (url.includes('/api/stats/overview')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_OVERVIEW) });
      return;
    }
    if (url.includes('/api/inbox/conversations')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_INBOX) });
      return;
    }
    if (url.includes('/api/inbox/pins') || url.includes('/api/inbox/saved-views') || url.includes('/api/inbox/threads/events')) {
      await route.fallback();
      return;
    }
    if (url.includes('/api/sessions/stats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ready: 1, disconnected: 0, qr_ready: 0, total: 1 }),
      });
      return;
    }
    if (url.includes('/api/sessions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'sess-1', name: 'Main WA', status: 'ready' }]),
      });
      return;
    }
    if (url.includes('/api/followup/autopilot/dashboard')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_AUTOPILOT) });
      return;
    }
    if (url.includes('/api/followup/pipeline/counts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pipelineCounts) });
      return;
    }
    if (url.includes('/api/followup/pipeline/dashboard')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_PIPELINE_DASHBOARD) });
      return;
    }
    if (url.includes('/api/followup/pipeline/reports/conversion')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_CONVERSION) });
      return;
    }
    if (url.includes('/api/followup/pipeline?') || url.endsWith('/api/followup/pipeline')) {
      const bucket = new URL(url).searchParams.get('bucket');
      const body = bucket === 'hot_leads' ? pipelineHotLeads : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      return;
    }
    if (url.includes('/api/followup/queue/counts')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return;
    }
    if (url.includes('/api/followup/queue?')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/api/followup/reports') || url.includes('/api/followup/staff')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/api/lost-demand-followups')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/api/audit')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_AUDIT) });
      return;
    }
    if (url.includes('/api/quotes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/api/ai/signals/dashboard')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aiSignals) });
      return;
    }
    if (url.includes('/api/settings/ai/status')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY_AI_STATUS) });
      return;
    }
    if (url.includes('/api/settings/ai/auto-reply/health')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(EMPTY_AUTO_REPLY_HEALTH),
      });
      return;
    }
    if (url.includes('/api/products/sync/inauzwa/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_INAUZWA_STATUS),
      });
      return;
    }
    if (url.includes('/api/sms/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false, connected: false, status: 'not_configured', isEnabled: false }),
      });
      return;
    }
    if (url.includes('/api/storage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ warnings: [] }),
      });
      return;
    }
    if (
      url.includes('/api/products') ||
      url.includes('/api/inbox/threads/crm') ||
      url.includes('/api/settings/')
    ) {
      await route.fallback();
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Register last so auth wins over the catch-all (avoids proxy to offline backend).
  await mockAuthRoutes(page);
}
