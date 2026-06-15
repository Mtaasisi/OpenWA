import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installSessionEngineMocks, E2E_ENGINE_SESSION_ID } from './helpers/session-engine-mocks';
import { seedDefaultTheme } from './helpers/theme-mocks';

test.describe('Session engine', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await seedDefaultTheme(page);
    await installSessionEngineMocks(page);
    await seedAdminSession(page);
  });

  test('channels page shows relink banner and scan QR action', async ({ page }) => {
    await page.goto('/channels?channel=whatsapp');
    await expect(page.locator(`#session-card-${E2E_ENGINE_SESSION_ID}`)).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('This session was linked with another engine — scan QR again for the active engine.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scan QR' }).first()).toBeVisible();
  });

  test('plugins page switches active engine from installed cards', async ({ page }) => {
    let currentEngine = 'baileys';

    await page.route('**/api/infra/engines/current', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ engineType: currentEngine }),
      });
    });

    await page.route('**/api/plugins/whatsapp-web.js/enable', async route => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      currentEngine = 'whatsapp-web.js';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Engine switched to whatsapp-web.js. Restart the API to apply, then re-link sessions with QR.',
          restartRequired: true,
        }),
      });
    });

    page.once('dialog', dialog => dialog.accept());

    await page.goto('/settings?section=integrations&panel=plugins');
    await expect(page.getByText('Baileys Engine')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('radio', { name: /WhatsApp Web.js Engine/i }).click();

    await expect(page.getByText('Engine switched', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Active').first()).toBeVisible();
  });
});
