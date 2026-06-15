import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { waitForProductsPage } from './helpers/products-page';
import { installProductsMocks } from './helpers/products-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';

test.describe('Products — CSV import wizard', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installProductsMocks(page);
    await seedAdminSession(page);
  });

  test('previews and executes import from CSV file', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await page.getByTestId('products-import-btn').click();
    await expect(page.getByTestId('product-import-wizard')).toBeVisible();

    const wizard = page.getByTestId('product-import-wizard');
    await wizard.locator('input[type="file"]').setInputFiles({
      name: 'catalog.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('product name,sku,price\nGalaxy A55,GA55,450000'),
    });

    await wizard.getByRole('button', { name: 'Preview & validate' }).click();
    await expect(wizard.getByText('Valid: 1')).toBeVisible({ timeout: 15_000 });

    await wizard.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(wizard.getByText('Created: 1')).toBeVisible({ timeout: 15_000 });
    await expect(wizard.getByText('batch-mock-1')).toBeVisible();
  });
});
