import type { Page } from '@playwright/test';

export type LinkPreflightMockOptions = {
  globalEnabled?: boolean;
  engineType?: string;
  sessionProxy?: boolean;
};

function buildPreflight(sessionId: string, opts: LinkPreflightMockOptions) {
  const globalEnabled = opts.globalEnabled ?? true;
  const engineType = opts.engineType ?? 'whatsapp-web.js';
  const hasProxy = opts.sessionProxy ?? true;

  const items = [
    { id: 'safetyGuard', ok: globalEnabled, severity: 'required', fixTarget: 'whatsapp-safety', fixField: 'globalEnabled' },
    { id: 'warmup', ok: true, severity: 'required', fixTarget: 'whatsapp-safety', fixField: 'warmupEnabled' },
    { id: 'startupSafeMode', ok: true, severity: 'required', fixTarget: 'whatsapp-safety', fixField: 'startupSafeModeEnabled' },
    { id: 'aiSafety', ok: true, severity: 'required' },
    { id: 'campaignsOff', ok: true, severity: 'recommended' },
    { id: 'followupAutoOff', ok: true, severity: 'recommended' },
    { id: 'outside24hTemplate', ok: true, severity: 'recommended' },
    { id: 'groupsAutoReplyOff', ok: true, severity: 'recommended' },
    {
      id: 'enginePreference',
      ok: engineType !== 'baileys',
      severity: 'recommended',
      detail: engineType,
      fixTarget: engineType === 'baileys' ? 'plugins' : null,
    },
    { id: 'dailySendLimit', ok: true, severity: 'recommended', detail: '100/day' },
    { id: 'messageDelay', ok: true, severity: 'recommended', detail: '8000ms min' },
    { id: 'reconnectStability', ok: true, severity: 'recommended' },
    { id: 'sessionProxy', ok: hasProxy, severity: 'recommended', fixTarget: hasProxy ? null : 'session-proxy' },
    { id: 'lightStartupSync', ok: true, severity: 'recommended' },
  ];

  const autoItems = items.filter(i => i.severity !== 'manual');
  const blockingOk = items.filter(i => i.severity === 'required').every(i => i.ok);
  const recommendedOk = items.filter(i => i.severity === 'recommended').every(i => i.ok);

  return {
    sessionId,
    sessionName: 'main-wa',
    ready: blockingOk && recommendedOk,
    blockingOk,
    recommendedOk,
    completed: autoItems.filter(i => i.ok).length,
    total: autoItems.length,
    engineType,
    items,
  };
}

export async function installLinkSafetyMocks(
  page: Page,
  options: LinkPreflightMockOptions = {},
): Promise<{ setGlobalEnabled: (enabled: boolean) => void }> {
  let globalEnabled = options.globalEnabled ?? true;
  const sessionId = 'sess-engine-e2e';

  const fulfillPreflight = async () => {
    await page.route('**/api/whatsapp-safety/link-preflight**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      if (url.includes('/summary')) {
        const pf = buildPreflight(sessionId, {
          ...options,
          globalEnabled,
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notReadyCount: pf.ready ? 0 : 1,
            sessions: [
              {
                sessionId,
                sessionName: pf.sessionName,
                ready: pf.ready,
                blockingOk: pf.blockingOk,
                issueCount: Math.max(0, pf.total - pf.completed),
              },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildPreflight(sessionId, {
            ...options,
            globalEnabled,
          }),
        ),
      });
    });
  };

  await fulfillPreflight();

  await page.route('**/api/whatsapp-safety/settings', async route => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { globalEnabled?: boolean };
      if (body.globalEnabled !== undefined) globalEnabled = body.globalEnabled;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ globalEnabled, warmupEnabled: true, startupSafeModeEnabled: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ globalEnabled, warmupEnabled: true, startupSafeModeEnabled: true }),
    });
  });

  await page.route(`**/api/sessions/${sessionId}/start**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: sessionId, status: 'qr_ready' }),
    });
  });

  await page.route(`**/api/sessions/${sessionId}/qr**`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'qr_ready',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      }),
    });
  });

  return {
    setGlobalEnabled: (enabled: boolean) => {
      globalEnabled = enabled;
    },
  };
}
