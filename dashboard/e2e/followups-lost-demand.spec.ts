import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';
import { seedDefaultTheme } from './helpers/theme-mocks';

test.describe('Follow-ups — lost demand panel', () => {
  test.beforeEach(async ({ page }) => {
    await seedDefaultTheme(page);
    await installDashboardMocks(page);

    await page.route('**/api/lost-demand-followups**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ld-1',
            sessionId: 'sess-1',
            chatId: '255700000000@c.us',
            wantedProduct: 'iPhone 15 Pro',
            wantedVariant: '256GB',
            status: 'open',
            notifyWhenAvailable: true,
            customerNameAtTime: 'Asha',
            createdAt: new Date().toISOString(),
          },
        ]),
      });
    });

    await seedAdminSession(page);
  });

  test('renders open lost-demand follow-ups', async ({ page }) => {
    await page.goto('/followups');
    await expect(page.getByRole('heading', { name: 'Follow-ups' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Waiting stock / lost demand')).toBeVisible();
    await expect(page.getByText('iPhone 15 Pro')).toBeVisible();
    await expect(page.getByText(/notify when available/i)).toBeVisible();
  });
});
