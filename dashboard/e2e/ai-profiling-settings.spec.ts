import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiSettingsMocks } from './helpers/ai-settings-mocks';

test.describe('AI settings — Smart Progressive Profiling', () => {
  test.beforeEach(async ({ page }) => {
    await installAiSettingsMocks(page);
    await seedAdminSession(page);
  });

  test('renders profiling card with master toggle and sub-settings', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await page.getByRole('button', { name: 'More options' }).click();
    const card = page.locator('.ai-settings-profiling-hero');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText('Auto-save high-confidence names')).toBeVisible();
    await expect(card.getByText('Create notify-when-available follow-ups')).toBeVisible();
    await expect(card.locator('textarea').first()).toHaveValue('Sawa {name}, ngoja nisave namba yako 😊');
  });

  test('can disable profiling master toggle', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await page.getByRole('button', { name: 'More options' }).click();
    const card = page.locator('.ai-settings-profiling-hero');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.getByRole('switch').first().click();
    await expect(card.locator('textarea').first()).toBeDisabled();
    await expect(card.locator('input[type="checkbox"]').first()).toBeDisabled();
  });
});
