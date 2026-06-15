import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiSettingsMocks } from './helpers/ai-settings-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';

test.describe('AI settings — Human Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installAiSettingsMocks(page);
    await seedAdminSession(page);
  });

  test('renders human behavior in unified AI replies settings panel', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await expect(page.getByText('Human-like reply delays')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('button', { name: 'Expert reply options' }).click();
    await expect(page.getByText('Presence replies enabled')).toBeVisible();
    await page.getByRole('button', { name: 'Advanced timing' }).click();
    await expect(page.getByText('Active chat wait')).toBeVisible();
    await expect(page.getByLabel('Active chat wait Min (ms)')).toHaveValue('500');
  });

  test('renders human behavior section on automations auto-reply tab', async ({ page }) => {
    await page.goto('/automations?tab=autoReply');
    await expect(page.getByRole('tab', { name: 'AI Auto-reply' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Advanced Auto-Reply')).toBeVisible({ timeout: 20_000 });
    const card = page.getByRole('heading', { name: 'AI human behavior' }).locator('..').locator('..');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByText('Human-like reply delays')).toBeVisible();
    await card.getByRole('button', { name: 'Expert reply options' }).click();
    await expect(card.getByText('Presence replies enabled')).toBeVisible();
    await expect(card.getByText('Suspicious name confirmation')).toBeVisible();
    await expect(card.getByText('Quoted replies enabled')).toBeVisible();
    await expect(card.getByText('Quote latest burst message')).toBeVisible();
    await expect(card.locator('select')).toHaveValue('fast');
    await expect(card.locator('input[type="number"]')).toHaveValue('240');
  });

  test('can change reply style to fast', async ({ page }) => {
    await page.goto('/automations?tab=autoReply');
    await expect(page.getByText('Advanced Auto-Reply')).toBeVisible({ timeout: 20_000 });
    const card = page.getByRole('heading', { name: 'AI human behavior' }).locator('..').locator('..');
    await expect(card).toBeVisible({ timeout: 20_000 });
    await card.locator('select').selectOption('fast');
    await expect(card.locator('select')).toHaveValue('fast');
  });

  test('shows unrestricted auto-reply enabled by default', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await expect(page.getByText('Unrestricted auto-reply (fast, no escalations)')).toBeVisible({
      timeout: 20_000,
    });
    const toggle = page.getByLabel('Unrestricted auto-reply (fast, no escalations)');
    await expect(toggle).toBeChecked();
    await expect(page.getByText('Human-like reply delays')).toBeVisible();
    const humanToggle = page.getByLabel('Human-like reply delays');
    await expect(humanToggle).not.toBeChecked();
  });
});
