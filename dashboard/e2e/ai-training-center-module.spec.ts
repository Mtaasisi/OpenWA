import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';
import { installAiLearningCacheMocks } from './helpers/ai-learning-cache-mocks';

test.describe('AI Training Center module', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await installDashboardMocks(page);
    await installAiLearningCacheMocks(page);
  });

  test('dashboard loads with KPIs and sub-nav', async ({ page }) => {
    await page.goto('/ai-training-center/dashboard');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('aitc-dashboard-title')).toHaveText('AI Training Center');
    await expect(page.getByRole('link', { name: 'Learned Intents' })).toBeVisible();
    await expect(page.locator('.aitc-kpi-card').filter({ hasText: 'Cache Hit Rate' })).toBeVisible();
  });

  test('learned intents table shows mocked row', async ({ page }) => {
    await page.goto('/ai-training-center/learned-intents');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    const table = page.getByRole('table');
    await expect(table.locator('strong', { hasText: 'mambo' })).toBeVisible();
    await expect(table.getByText('greeting', { exact: true })).toBeVisible();
  });

  test('unknown messages shows pending rows and review', async ({ page }) => {
    await page.goto('/ai-training-center/unknown-messages');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    const table = page.getByRole('table');
    await expect(table.getByText('Bei ya kioo cha iPhone 11?')).toBeVisible();
    await table.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByRole('heading', { name: 'Review Unknown Message' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('settings page loads tabbed form', async ({ page }) => {
    await page.goto('/ai-training-center/settings');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('AI Training Settings')).toBeVisible();
    await expect(page.getByText('Enable AI Training Center')).toBeVisible();
  });

  test('sidebar shows unknown badge count', async ({ page }) => {
    await page.goto('/');
    const navLink = page.getByRole('link', { name: /AI Training Center/i });
    await expect(navLink).toBeVisible({ timeout: 15_000 });
    await expect(navLink.locator('.nav-item__badge, .wa-sidebar-stitch__badge, .wa-sidebar-v2__badge')).toHaveText('2');
  });

  test('analytics page loads KPIs', async ({ page }) => {
    await page.goto('/ai-training-center/analytics');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Training Analytics' })).toBeVisible();
    await expect(page.locator('.aitc-kpi-card').filter({ hasText: 'Cache Hit Rate' })).toBeVisible();
  });

  test('import training data from dashboard', async ({ page }) => {
    await page.goto('/ai-training-center/dashboard');
    await expect(page.getByTestId('ai-training-center-module')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Add Training' }).click();
    await page.getByRole('button', { name: 'Import Training Data' }).click();
    await expect(page.locator('.aitc-modal-overlay[aria-label="Import Training Data"]')).toBeVisible();
    await page.getByRole('button', { name: 'Load sample format' }).click();
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await expect(page.locator('.aitc-modal-overlay[aria-label="Import Training Data"]')).not.toBeVisible({
      timeout: 10_000,
    });
  });
});
