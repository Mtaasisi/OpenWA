import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { installAiUsageMocks } from './helpers/ai-usage-mocks';
import { installAiLearningCacheMocks } from './helpers/ai-learning-cache-mocks';

test.describe('AI Learning Cache panel', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
  });

  test('admin sees learned intents, unknown queue, and cache stats', async ({ page }) => {
    await installAiUsageMocks(page, {
      permissions: ['ai.cost.view', 'ai.cost.manage', 'ai.learning.view', 'ai.learning.manage'],
    });
    await installAiLearningCacheMocks(page);
    await seedAdminSession(page);

    await page.goto('/settings?category=ai&panel=ai-learning-cache');

    await expect(page.getByRole('tab', { name: /Learned Intents/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('mambo')).toBeVisible();
    await expect(page.locator('.ai-learning-center__id')).toContainText('li-1');
    await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import CSV/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Merge duplicate intents/i })).toBeVisible();
  });

  test('admin can create learned intent from form', async ({ page }) => {
    await installAiUsageMocks(page, {
      permissions: ['ai.cost.view', 'ai.learning.view', 'ai.learning.manage'],
    });
    await installAiLearningCacheMocks(page);
    await seedAdminSession(page);

    await page.goto('/settings?category=ai&panel=ai-learning-cache');
    await expect(page.getByRole('heading', { name: /Add learned intent/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel(/Customer phrase/i).fill('habari');
    await page.getByLabel(/Suggested reply/i).fill('Habari Boss');
    await page.getByRole('button', { name: /Save intent/i }).click();
    await expect(page.getByText(/Learned intent saved/i)).toBeVisible({ timeout: 10_000 });
  });
});
