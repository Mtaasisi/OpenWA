import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiSettingsMocks } from './helpers/ai-settings-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';

test.describe('AI auto-reply — local inventory catalog health', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installAiSettingsMocks(page);
    await seedAdminSession(page);
  });

  test('automations health panel shows linked local inventory check', async ({ page }) => {
    await page.goto('/automations?tab=autoReply');
    await expect(page.getByRole('tab', { name: 'AI Auto-reply' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText('Auto-reply health')).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByText('Local inventory linked for AI product search'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('8 in-stock of 10 products')).toBeVisible();
  });

  test('empty catalog check links to Products page', async ({ page }) => {
    await page.route('**/api/settings/ai/auto-reply/health**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          masterEnabled: true,
          ready: true,
          checks: [
            { id: 'providerReady', ok: true, fixTarget: 'ai' },
            {
              id: 'localCatalog',
              ok: false,
              detail: 'No active products in local inventory',
              fixTarget: 'products',
            },
          ],
          sessions: [],
          stats: {
            aiReplies24h: 0,
            openEscalations: 0,
            knowledgeChunks: 12,
            knowledgeFiles: 4,
          },
        }),
      });
    });

    await page.goto('/automations?tab=autoReply');
    await expect(page.getByText('No active products in local inventory')).toBeVisible({
      timeout: 20_000,
    });
    const catalogRow = page.locator('.auto-reply-health__check.is-fail').filter({
      hasText: 'Local inventory linked for AI product search',
    });
    await expect(catalogRow.getByRole('link', { name: 'Fix' })).toHaveAttribute('href', '/products');
  });
});
