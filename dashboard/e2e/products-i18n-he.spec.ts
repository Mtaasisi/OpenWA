import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installProductsMocks } from './helpers/products-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { waitForProductsPage } from './helpers/products-page';

test.describe('Products — Hebrew locale', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installProductsMocks(page);
  });

  test('products page renders Hebrew strings when locale is he', async ({ page }) => {
    await seedAdminSession(page, 'he');
    await page.goto('/products');
    await waitForProductsPage(page, 'מוצרים');
    await expect(page.getByTestId('products-import-btn')).toHaveText(/ייבוא/i);
    await expect(page.getByRole('button', { name: /הוסף מוצר/i })).toBeVisible();
  });
});
