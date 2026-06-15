import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';

test.describe('Campaigns — product demand outreach', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page);

    await page.route('**/api/product-demand/campaigns/metrics', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: 1,
          sent: 0,
          cancelled: 0,
          total: 1,
          sms: 1,
          whatsapp: 0,
          totalRecipients: 3,
        }),
      });
    });

    await page.route('**/api/product-demand/campaigns**', async route => {
      const url = route.request().url();
      if (url.includes('/metrics')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'camp-1',
            title: 'Restock iPhone 15',
            message: 'Habari! iPhone 15 is back in stock.',
            channel: 'sms',
            status: 'draft',
            recipientCount: 3,
            productNames: ['iPhone 15'],
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await seedAdminSession(page);
  });

  test('shows demand campaign metrics and outreach panel', async ({ page }) => {
    await page.goto('/campaigns');
    await expect(page.getByRole('heading', { name: 'Campaigns' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Product demand outreach' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Restock iPhone 15' })).toBeVisible();
    const draftCard = page.locator('.fu-glass-card').filter({ hasText: 'Draft' });
    await expect(draftCard.locator('.fu-glass-card__value')).toHaveText('1');
  });
});
