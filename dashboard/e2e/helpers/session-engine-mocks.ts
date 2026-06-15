import type { Page, Route } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';

export const E2E_ENGINE_SESSION_ID = 'sess-engine-e2e';

const ENGINES = [
  { id: 'whatsapp-web.js', name: 'WhatsApp Web.js', enabled: true, features: ['text-messages'] },
  { id: 'baileys', name: 'Baileys', enabled: true, features: ['text-messages'] },
];

const PLUGIN_LIST = [
  {
    id: 'whatsapp-web.js',
    name: 'WhatsApp Web.js Engine',
    version: '1.0.0',
    type: 'engine',
    status: 'enabled',
    builtIn: true,
    provides: ['whatsapp-engine'],
    description: 'Browser-based engine',
  },
  {
    id: 'baileys',
    name: 'Baileys Engine',
    version: '1.0.0',
    type: 'engine',
    status: 'enabled',
    builtIn: true,
    provides: ['whatsapp-engine'],
    description: 'WebSocket engine',
  },
];

const INFRA_STATUS = {
  api: { baseUrl: 'http://localhost:2785/api' },
  engine: {
    type: 'baileys',
    headless: true,
    sessionDataPath: './data/sessions',
    browserArgs: '--no-sandbox',
  },
};

export type MockSession = {
  id: string;
  name: string;
  status: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  aiAutoReplyEnabled: boolean;
  followupAutopilotEnabled: boolean;
  staffAiAllowedNumbers: string[];
  engineType: string | null;
  effectiveEngineType: string;
  engineAuthPresent: boolean;
  requiresRelink: boolean;
  backgroundSyncing?: boolean;
};

function baseSession(overrides: Partial<MockSession> = {}): MockSession {
  const now = new Date().toISOString();
  return {
    id: E2E_ENGINE_SESSION_ID,
    name: 'main-wa',
    status: 'disconnected',
    phone: '255700000000',
    createdAt: now,
    updatedAt: now,
    aiAutoReplyEnabled: true,
    followupAutopilotEnabled: false,
    staffAiAllowedNumbers: [],
    engineType: null,
    effectiveEngineType: 'baileys',
    engineAuthPresent: false,
    requiresRelink: true,
    ...overrides,
  };
}

export type SessionEngineMockOptions = {
  sessions?: MockSession[];
};

export async function installSessionEngineMocks(
  page: Page,
  options: SessionEngineMockOptions = {},
): Promise<{ sessions: MockSession[] }> {
  await installDashboardMocks(page);

  const sessions = options.sessions ?? [baseSession()];

  const fulfillSessions = async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessions),
    });
  };

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

  await page.route('**/api/infra/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(INFRA_STATUS),
    });
  });

  await page.route('**/api/plugins**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLUGIN_LIST),
    });
  });

  await page.route('**/api/infra/engines/current', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ engineType: 'baileys' }),
    });
  });

  await page.route('**/api/infra/engines', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ENGINES),
    });
  });

  await page.route('**/api/sessions/health/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        sessions.map(s => ({
          sessionId: s.id,
          name: s.name,
          dbStatus: s.status,
          liveStatus: s.status,
          enginePresent: false,
          pendingReconnect: false,
          manuallyStopped: false,
          linkingMode: false,
          backgroundSyncing: s.backgroundSyncing ?? false,
          requiresRelink: s.requiresRelink,
        })),
      ),
    });
  });

  await page.route(`**/api/sessions/${E2E_ENGINE_SESSION_ID}/engine`, async route => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as { engineType?: string | null };
    const session = sessions.find(s => s.id === E2E_ENGINE_SESSION_ID);
    if (session) {
      session.engineType = body.engineType ?? null;
      session.effectiveEngineType = body.engineType ?? 'baileys';
      session.updatedAt = new Date().toISOString();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session ?? {}),
    });
  });

  await page.route('**/api/sessions**', async route => {
    const url = route.request().url();
    if (url.includes('/health/overview') || url.endsWith('/engine')) {
      await route.fallback();
      return;
    }
    if (route.request().method() === 'GET') {
      if (
        url.includes('/messages') ||
        url.includes('/contacts/') ||
        url.includes('/health/') ||
        url.match(/\/api\/sessions\/[^/]+\/(start|restart|stop|logout)/)
      ) {
        await route.fallback();
        return;
      }
      await fulfillSessions(route);
      return;
    }
    const startMatch = url.match(/\/api\/sessions\/([^/?]+)\/start$/);
    if (route.request().method() === 'POST' && startMatch) {
      const session = sessions.find(s => s.id === startMatch[1]);
      if (session) {
        session.status = 'initializing';
        session.engineAuthPresent = true;
        session.updatedAt = new Date().toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session ?? {}),
      });
      return;
    }
    const restartMatch = url.match(/\/api\/sessions\/([^/?]+)\/restart$/);
    if (route.request().method() === 'POST' && restartMatch) {
      const session = sessions.find(s => s.id === restartMatch[1]);
      if (session) {
        session.status = 'initializing';
        session.updatedAt = new Date().toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(session ?? {}),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/health', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  await page.route('**/api/whatsapp-safety/link-preflight**', async route => {
    const url = route.request().url();
    if (url.includes('/summary')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          notReadyCount: 0,
          sessions: [
            {
              sessionId: E2E_ENGINE_SESSION_ID,
              sessionName: 'main-wa',
              ready: true,
              blockingOk: true,
              issueCount: 0,
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: E2E_ENGINE_SESSION_ID,
        sessionName: 'main-wa',
        ready: true,
        blockingOk: true,
        recommendedOk: true,
        completed: 10,
        total: 10,
        engineType: 'baileys',
        items: [],
      }),
    });
  });

  await page.route('**/api/sms/status**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: false,
        connected: false,
        status: 'not_connected',
        isEnabled: false,
        lowBalance: false,
        lastBalance: null,
        lastError: null,
      }),
    });
  });

  return { sessions };
}
