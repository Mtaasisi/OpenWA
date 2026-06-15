import type { Page } from '@playwright/test';

const SERVER_SETTINGS = {
  general: { autoReconnect: true, debugMode: false },
  api: { rateLimit: 100, rateLimitWindow: 60_000 },
  notifications: {
    webhookAlerts: true,
    emailEnabled: false,
    notificationEmail: 'alerts@openwa.test',
  },
};

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

export async function installSettingsShellMocks(page: Page): Promise<void> {
  await page.route('**/api/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SERVER_SETTINGS),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SERVER_SETTINGS, ...(route.request().postDataJSON() as object) }),
    });
  });

  await page.route('**/api/health', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.route('**/api/app/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(APP_STATUS),
    });
  });

  await page.route('**/api/whatsapp-safety/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        safetyEnabled: true,
        pendingQueue: 2,
        blockedToday: 0,
        optedOutContacts: 1,
        accountsInWarmup: 1,
      }),
    });
  });

  await page.route('**/api/sms/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        connected: false,
        status: 'not_connected',
        isEnabled: false,
        configured: false,
        lowBalance: false,
        lastBalance: null,
        lastError: null,
      }),
    });
  });
}
