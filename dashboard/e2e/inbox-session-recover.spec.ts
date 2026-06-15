import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  E2E_ENGINE_SESSION_ID,
  installSessionEngineMocks,
} from './helpers/session-engine-mocks';
import { seedDefaultTheme } from './helpers/theme-mocks';

test.describe('Inbox — linked session auto-recover', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedDefaultTheme(page);
    await page.addInitScript(({ sessionId }) => {
      localStorage.setItem('openwa_user_preferences', JSON.stringify({
        inboxDefaultView: 'one',
        inboxConversationFilter: 'all',
        inboxDefaultSessionId: sessionId,
      }));
    }, { sessionId: E2E_ENGINE_SESSION_ID });
    await installSessionEngineMocks(page, {
      sessions: [
        {
          id: E2E_ENGINE_SESSION_ID,
          name: 'main-wa',
          status: 'disconnected',
          phone: '255700000000',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          aiAutoReplyEnabled: true,
          followupAutopilotEnabled: false,
          staffAiAllowedNumbers: [],
          engineType: null,
          effectiveEngineType: 'whatsapp-web.js',
          engineAuthPresent: true,
          requiresRelink: false,
        },
      ],
    });
  });

  test('shows Reconnecting and auto-starts linked session from inbox', async ({ page }) => {
    const startRequests: { linkingMode?: boolean }[] = [];
    await page.route(`**/api/sessions/${E2E_ENGINE_SESSION_ID}/start`, async route => {
      const body = route.request().postDataJSON() as { linkingMode?: boolean };
      startRequests.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: E2E_ENGINE_SESSION_ID,
          name: 'main-wa',
          status: 'initializing',
          phone: '255700000000',
          requiresRelink: false,
        }),
      });
    });

    await seedAdminSession(page);
    await page.goto('/inbox');
    await expect(page.locator('.inbox-send-account--recovering').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect.poll(() => startRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(startRequests.some(r => r.linkingMode === false)).toBe(true);
    await expect(page.getByRole('button', { name: 'Start session' })).not.toBeVisible();
  });
});
