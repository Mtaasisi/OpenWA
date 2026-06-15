import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installSessionEngineMocks, E2E_ENGINE_SESSION_ID } from './helpers/session-engine-mocks';
import { installLinkSafetyMocks } from './helpers/link-safety-mocks';
import { seedDefaultTheme } from './helpers/theme-mocks';

test.describe('WhatsApp link safety preflight', () => {
  test.beforeEach(async ({ page }) => {
    await seedDefaultTheme(page);
    await installSessionEngineMocks(page);
    await installLinkSafetyMocks(page, { globalEnabled: false, engineType: 'baileys', sessionProxy: true });
    await seedAdminSession(page);
  });

  test('Scan QR opens checklist and blocks proceed until automated checks pass', async ({ page }) => {
    await page.goto('/channels?channel=whatsapp');
    await expect(page.locator(`#session-card-${E2E_ENGINE_SESSION_ID}`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Scan QR' }).first().click();

    await expect(page.getByRole('heading', { name: 'Safety check before linking' })).toBeVisible();
    const proceed = page.getByRole('button', { name: 'Proceed to QR scan' });
    await expect(proceed).toBeDisabled();

    await page.locator('.wa-link-safety-modal__body').evaluate(el => {
      el.scrollTop = 0;
    });
    await page.locator('input[aria-label="WhatsApp safety guard is enabled"]').evaluate(el => {
      const input = el as HTMLInputElement;
      if (!input.checked) input.click();
    });
    await expect(page.getByText('I understand the recommended warnings')).toBeVisible();
    await page.locator('.wa-link-safety__ack input').check({ force: true });
    await expect(proceed).toBeEnabled({ timeout: 10_000 });

    await proceed.click();
    await expect(page.getByRole('heading', { name: 'Scan QR Code' })).toBeVisible({ timeout: 15_000 });
  });
});
