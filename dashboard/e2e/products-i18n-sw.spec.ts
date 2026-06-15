import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installProductsMocks } from './helpers/products-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { waitForProductsPage } from './helpers/products-page';

test.describe('Products — Swahili locale', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installProductsMocks(page);
  });

  test('products page renders Swahili strings when locale is sw', async ({ page }) => {
    await seedAdminSession(page, 'sw');
    await page.goto('/products');
    await waitForProductsPage(page, 'Bidhaa');
    await expect(page.getByTestId('products-import-btn')).toHaveText(/Ingiza/i);
    await expect(page.getByRole('button', { name: /Ongeza bidhaa/i })).toBeVisible();
  });

  test('settings language picker switches products page to Swahili', async ({ page }) => {
    await seedAdminSession(page, 'en');
    await page.goto('/settings?category=profile&item=account-preferences');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({ timeout: 20_000 });

    const languageSelect = page.locator('select').filter({ has: page.locator('option[value="sw"]') }).first();
    await languageSelect.selectOption('sw');
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('openwa_language')))
      .toBe('sw');

    await page.goto('/products');
    await waitForProductsPage(page, 'Bidhaa');
    await expect(page.getByTestId('products-import-btn')).toHaveText(/Ingiza/i);
  });
});
