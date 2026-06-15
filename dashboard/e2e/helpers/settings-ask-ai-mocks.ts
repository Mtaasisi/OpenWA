import type { Page } from '@playwright/test';
import { SETTINGS_ASK_AI_PROMPTS } from '../../src/lib/settings-ask-ai-prompts';
import { MOCK_INAUZWA_STATUS } from './inauzwa-status-mock';

export { SETTINGS_ASK_AI_PROMPTS as SETTINGS_ASK_AI_PROMPT_FIXTURES } from '../../src/lib/settings-ask-ai-prompts';

const AUTOPILOT_SETTINGS = {
  id: 'default',
  enabled: false,
  autopilotMode: 'suggest_only',
  businessHoursOnly: true,
  quietHoursStart: '21:00',
  quietHoursEnd: '08:00',
  timezone: 'Africa/Dar_es_Salaam',
  maxFollowupsPerCustomerPerDay: 2,
  maxFollowupsPerLead: 5,
  requireApprovalForMediumRisk: true,
  requireApprovalForHighRisk: true,
  allowSmsFallback: false,
  allowWhatsAppSmsBoth: false,
  allowGroupAutopilot: false,
  pauseOnHighFailureRate: true,
  pauseOnCustomerComplaint: true,
  staffTakeoverPauseMinutes: 120,
};

const AUTOPILOT_DASHBOARD = {
  autoSentToday: 0,
  needsApproval: 0,
  failed: 0,
  pausedAccounts: [] as string[],
  enabled: false,
};

const KNOWLEDGE_FILES = {
  files: [
    { path: 'SHOP.md', size: 1200, updatedAt: '2026-06-12T10:00:00.000Z' },
    { path: 'FAQ.md', size: 800, updatedAt: '2026-06-11T08:00:00.000Z' },
  ],
};

/** Settings URLs for panels that expose the Ask AI operator button. */
export const SETTINGS_ASK_AI_PANEL_ROUTES: Record<keyof typeof SETTINGS_ASK_AI_PROMPTS, string> = {
  'ai-auto-reply': '/settings?category=ai&panel=ai-auto-reply',
  'ai-knowledge': '/settings?category=ai&panel=ai-knowledge',
  'whatsapp-safety': '/settings?category=safety&panel=whatsapp-safety',
  'ai-branch-profile': '/settings?category=ai&panel=ai-branch-profile',
  products: '/settings?category=business&panel=products',
  'ai-memory': '/settings?category=ai&panel=ai-memory',
  'storage-backup': '/settings?category=system&panel=storage-backup',
  'followup-autopilot': '/automations?tab=autopilot',
  logs: '/settings?category=system&panel=logs',
  'agent-actions-log': '/settings?category=system&panel=agent-actions-log',
  users: '/settings?category=system&panel=users',
  webhooks: '/settings?category=system&panel=webhooks',
  plugins: '/settings?category=system&panel=plugins',
  infrastructure: '/settings?category=system&panel=infrastructure',
  'api-keys': '/settings?category=system&panel=api-keys',
};

/** Panels covered by the parametrized Ask AI link test (excludes special-case specs below). */
export const SETTINGS_ASK_AI_SHELL_PANELS = [
  'ai-branch-profile',
  'products',
  'ai-memory',
  'storage-backup',
  'logs',
  'agent-actions-log',
  'users',
  'webhooks',
  'plugins',
  'infrastructure',
  'api-keys',
] as const satisfies ReadonlyArray<keyof typeof SETTINGS_ASK_AI_PROMPTS>;

/** Mocks for settings panels that expose the Ask AI operator button. */
export async function installSettingsAskAiMocks(page: Page): Promise<void> {
  await page.route('**/api/ai/memory**', async route => {
    const url = route.request().url();
    if (url.includes('/index-status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ chunks: 12 }),
      });
      return;
    }
    if (route.request().method() === 'GET' && url.endsWith('/api/ai/memory')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          files: [{ path: 'MEMORY.md', size: 420, updatedAt: '2026-06-12T10:00:00.000Z' }],
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/ai/profile/**', async route => {
    const url = route.request().url();
    if (url.includes('/branches')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ branchId: 'arusha', branchName: 'Arusha', paymentAccounts: [] }]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        branchId: 'arusha',
        branchName: 'Arusha',
        shopName: 'OpenWA Arusha',
        paymentAccounts: [],
      }),
    });
  });

  await page.route('**/api/auth/users**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'e2e-admin',
          email: 'admin@openwa.test',
          name: 'E2E Admin',
          role: 'admin',
          staffId: 'staff-e2e',
          isActive: true,
        },
      ]),
    });
  });

  await page.route('**/api/auth/api-keys**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/infra/storage/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ usedBytes: 0, quotaBytes: 1_000_000_000, warnings: [] }),
    });
  });

  await page.route('**/api/backup/**', async route => {
    const url = route.request().url();
    if (url.includes('/history')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, schedule: 'daily', retentionDays: 7 }),
    });
  });

  await page.route('**/api/products/sync/inauzwa/status**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_INAUZWA_STATUS),
    });
  });

  await page.route('**/api/products/sync/inauzwa/branches**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/audit**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ logs: [], total: 0 }),
    });
  });

  await page.route('**/api/followup/autopilot/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AUTOPILOT_SETTINGS),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...AUTOPILOT_SETTINGS, ...(route.request().postDataJSON() as object) }),
    });
  });

  await page.route('**/api/followup/autopilot/dashboard', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AUTOPILOT_DASHBOARD),
    });
  });

  await page.route('**/api/ai/knowledge/index-status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ chunks: 42 }),
    });
  });

  await page.route('**/api/ai/knowledge/read**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ path: 'SHOP.md', content: '# Shop\n\nMock knowledge file.' }),
    });
  });

  await page.route('**/api/ai/knowledge/search**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.route('**/api/ai/knowledge**', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(KNOWLEDGE_FILES),
      });
      return;
    }
    if (method === 'POST' && route.request().url().includes('/reindex')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ files: 2, chunks: 42 }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/agent-actions/audit**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'audit-1',
          actionId: 'ai.auto_reply.disable',
          actionTitle: 'Disable AI auto reply',
          status: 'success',
          risk: 'safe',
          createdAt: '2026-06-12T12:00:00.000Z',
        },
      ]),
    });
  });

  await page.route('**/api/agent-actions**', async route => {
    const url = route.request().url();
    if (url.includes('/audit')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        settings: { agentActionsEnabled: true },
        pendingCount: 0,
        pending: [],
      }),
    });
  });
}
