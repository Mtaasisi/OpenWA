import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiSettingsMocks } from './helpers/ai-settings-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';

test.describe('Settings WhatsApp-style navigation', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installAiSettingsMocks(page);
    await seedAdminSession(page);
  });

  test('defaults to profile category hub', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/category=profile/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Account preferences/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit profile' })).toBeVisible();
  });

  test('left nav shows seven categories with profile active', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: /Profile & Account/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Chats & Channels/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /AI Assistant/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Business Tools/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Notifications & Safety/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /System & Advanced/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Help/ }).first()).toBeVisible();
  });

  test('category click opens hub without auto-selecting item', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /AI Assistant/ }).first().click();
    await expect(page).toHaveURL(/category=ai/);
    await expect(page.url()).not.toMatch(/item=/);
    await expect(page.url()).not.toMatch(/panel=/);
    await expect(page.getByText('AI inbox setup')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open AI Chat' })).toBeVisible();
    await expect(page.getByRole('button', { name: /AI replies/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Provider/i })).toBeVisible();
  });

  test('clicking AI category from panel returns to hub', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await expect(page.getByText('Human-like reply delays')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /AI Assistant/ }).first().click();
    await expect(page).toHaveURL(/category=ai/);
    await expect(page.url()).not.toMatch(/panel=/);
    await expect(page.getByRole('button', { name: /AI replies/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Provider/i })).toBeVisible();
  });

  test('header nav search shows empty state when nothing matches', async ({ page }) => {
    await page.goto('/settings');
    await page.getByPlaceholder('Search settings…').fill('zzznomatchquery');
    await expect(page.getByText('No settings match your search.')).toBeVisible();
  });

  test('header search finds human behavior from typing keyword', async ({ page }) => {
    await page.goto('/settings');
    await page.getByPlaceholder('Search settings…').fill('typing');
    await expect(page.getByRole('button', { name: /AI replies/i })).toBeVisible();
  });

  test('legacy panel url canonicalizes to new category', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await expect(page).toHaveURL(/category=safety/);
    await expect(page).toHaveURL(/panel=whatsapp-safety/);
  });

  test('legacy human behavior url opens unified AI replies panel', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-human-behavior');
    await expect(page).toHaveURL(/panel=ai-auto-reply/);
    await expect(page.getByText('Human-like reply delays')).toBeVisible({ timeout: 20_000 });
  });

  test('chats category hub shows channel connectivity summary', async ({ page }) => {
    await page.goto('/settings?category=chats');
    await expect(page.getByText('Channels & Connectivity')).toBeVisible();
    await expect(page.getByText('WhatsApp sessions')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Inbox' })).toBeVisible();
    await expect(page.getByRole('button', { name: /WhatsApp accounts/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Inbox preferences/i })).toBeVisible();
  });

  test('Chats category includes WhatsApp accounts sub-item', async ({ page }) => {
    await page.goto('/settings?category=chats&item=whatsapp-accounts');
    await expect(page.getByRole('heading', { name: 'WhatsApp accounts' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('Business tools opens products panel', async ({ page }) => {
    await page.goto('/settings?category=business&panel=products');
    await expect(page).toHaveURL(/category=business/);
    await expect(page).toHaveURL(/panel=products/);
  });

  test('legacy ai-learning deep link keeps panel accessible', async ({ page }) => {
    await page.goto('/settings?section=ai&panel=ai-learning');
    await expect(page).toHaveURL(/panel=ai-learning/);
    await expect(page).toHaveURL(/category=ai/);
  });

  test('safety category hub shows safety overview summary', async ({ page }) => {
    await page.goto('/settings?category=safety');
    await expect(page.getByText('Safety overview')).toBeVisible();
    await expect(page.locator('.settings-hub__stat-title').filter({ hasText: 'WhatsApp Safety' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open WhatsApp Safety' })).toBeVisible();
    await expect(page.getByRole('button', { name: /WhatsApp safety/i })).toBeVisible();
    await expect(page.getByText('Browser and server notification preferences')).toBeVisible();
  });

  test('notifications inline settings render in safety category', async ({ page }) => {
    await page.goto('/settings?category=safety&item=notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('System notifications')).toBeVisible();
    await expect(page.getByText('Show notifications')).toBeVisible();
  });

  test('detail back returns to category hub from item detail', async ({ page }) => {
    await page.goto('/settings?category=profile&item=edit-profile');
    await expect(page.getByRole('heading', { name: 'Edit profile' })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'Back to category' }).click();

    await expect(page).toHaveURL(/category=profile/);
    await expect(page.url()).not.toMatch(/item=/);
    await expect(page.getByRole('button', { name: /Account preferences/i })).toBeVisible();
  });

  test('detail back returns to hub from AI panel on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await expect(page.getByText('Human-like reply delays')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Back to category' }).click();
    await expect(page.url()).not.toMatch(/panel=/);
    await expect(page.getByRole('button', { name: /AI replies/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Provider/i })).toBeVisible();
  });
});
