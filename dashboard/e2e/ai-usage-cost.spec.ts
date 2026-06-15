import { test, expect } from '@playwright/test';
import { seedAdminSession, seedOperatorSession } from './helpers/auth';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { installAiUsageMocks } from './helpers/ai-usage-mocks';

test.describe('AI Usage & Cost panel', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
  });

  test('admin sees usage summary, charts, and manage actions', async ({ page }) => {
    await installAiUsageMocks(page, {
      permissions: ['ai.cost.view', 'ai.cost.manage'],
    });
    await seedAdminSession(page);

    await page.goto('/settings?category=ai&panel=ai-usage');

    await expect(page.locator('.ai-usage-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.ai-usage-card').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Budget remaining/i })).toBeVisible();
    await expect(page.locator('.ai-usage-card--budget').first()).toContainText('$0.96');
    await expect(page.getByRole('button', { name: /Pause auto-reply/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Budget settings/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cost by model/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Cost optimization/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prompt contributors/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Message buffer activity/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Cost by model/i }).locator('..').getByText('gpt-4o-mini'),
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'whatsapp_auto_reply' }).first()).toBeVisible();
  });

  test('view-only operator sees dashboard without manage controls', async ({ page }) => {
    await installAiUsageMocks(page, { permissions: ['ai.cost.view'] });
    await seedOperatorSession(page);

    await page.goto('/settings?category=ai&panel=ai-usage');

    await expect(page.locator('.ai-usage-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Pause auto-reply/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Resume auto-reply/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Budget settings/i })).toHaveCount(0);
  });

  test('operator with manage permission can resume paused auto-reply', async ({ page }) => {
    await installAiUsageMocks(page, {
      permissions: ['ai.cost.view', 'ai.cost.manage'],
      autoReplyPaused: true,
    });
    await seedOperatorSession(page);

    await page.goto('/settings?category=ai&panel=ai-usage');

    await expect(page.getByRole('button', { name: /Resume auto-reply/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /Pause auto-reply/i })).toHaveCount(0);
  });

  test('recent calls filters and masked buffer conversation IDs', async ({ page }) => {
    await installAiUsageMocks(page, {
      permissions: ['ai.cost.view', 'ai.cost.manage'],
    });
    await seedAdminSession(page);

    await page.goto('/settings?category=ai&panel=ai-usage');
    await expect(page.getByRole('heading', { name: /Recent AI calls/i })).toBeVisible({
      timeout: 20_000,
    });

    const periodSelect = page.locator('.ai-usage-recent-filters select').first();
    await periodSelect.selectOption('today');
    await periodSelect.selectOption('mtd');

    const statusSelect = page.locator('.ai-usage-recent-filters select').nth(1);
    await statusSelect.selectOption('cache_hit');

    await expect(page.getByRole('heading', { name: /Message buffer activity/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /ses…00@c\.us/ })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'sess-1:255700@c.us' })).toHaveCount(0);
  });
});
