import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiChatMocks } from './helpers/ai-chat-mocks';
import { seedTacticalTheme, TACTICAL_THEME_ID } from './helpers/theme-mocks';

test.describe('AI Chat — tactical overlay theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await installAiChatMocks(page);
    await seedTacticalTheme(page);
    await seedAdminSession(page);
  });

  test('renders studio shell under tactical theme', async ({ page }) => {
    await page.goto('/ai');
    await expect(page.locator(`html[data-theme-id="${TACTICAL_THEME_ID}"]`)).toBeAttached({
      timeout: 15_000,
    });
    await expect(page.getByTestId('ai-chat-studio')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.ai-chat-interakt')).toBeVisible();
  });

  test('search sheet uses dark tactical surface', async ({ page }) => {
    await page.goto('/ai');
    await expect(page.getByTestId('ai-chat-studio')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('ai-chat-search-btn').click();
    const sheet = page.getByTestId('ai-chat-search-sheet');
    await expect(sheet).toBeVisible();

    const backgroundColor = await sheet.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(backgroundColor).toBe('rgb(5, 11, 20)');
  });

  test('hero cards appear on new chat in tactical theme', async ({ page }) => {
    await page.goto('/ai');
    await expect(page.getByTestId('ai-chat-studio')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('ai-chat-new-btn').click();
    await expect(page.getByTestId('ai-chat-hero')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ai-chat-hero-card-campaign')).toBeVisible();
    await expect(page.getByTestId('ai-chat-hero-card-pricing')).toBeVisible();
    await expect(page.getByTestId('ai-chat-hero-card-leads')).toBeVisible();
  });
});
