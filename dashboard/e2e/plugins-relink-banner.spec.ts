import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installSessionEngineMocks } from './helpers/session-engine-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { seedDefaultTheme } from './helpers/theme-mocks';

test.describe('Plugins — engine relink banner', () => {
  test.beforeEach(async ({ page }) => {
    await seedDefaultTheme(page);
    await installSettingsShellMocks(page);
    await installSessionEngineMocks(page);
    await seedAdminSession(page);
  });

  test('shows relink summary and links to WhatsApp channels', async ({ page }) => {
    await page.goto('/settings?category=system&panel=plugins');
    await expect(page.getByText('1 session(s) need QR for Baileys')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('main-wa')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Review in WhatsApp Safety' })).toBeVisible();
    const channelsLink = page.getByRole('link', { name: 'Open WhatsApp channels' });
    await expect(channelsLink).toBeVisible();
    await expect(channelsLink).toHaveAttribute('href', /\/channels\?channel=whatsapp/);
  });
});
