import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installProductsMocks } from './helpers/products-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { openProductEditor, waitForProductsPage } from './helpers/products-page';

test.describe('Products management', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installProductsMocks(page);
    await seedAdminSession(page);
  });

  test('products page renders management header and table', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await expect(page.getByText(/Manage your stock catalog/i)).toBeVisible();
    await expect(page.getByText('iPhone 13')).toBeVisible();
  });

  test('import wizard opens from products page', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await page.getByTestId('products-import-btn').click();
    await expect(page.getByTestId('product-import-wizard')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import products' })).toBeVisible();
  });

  test('import history panel lists batches', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await page.getByTestId('products-import-history-btn').click();
    await expect(page.getByTestId('product-import-history')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible();
    await expect(page.getByText('catalog.csv')).toBeVisible();
  });

  test('product editor inventory tab lists IMEI items', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    await expect(page.getByTestId('product-inventory-panel')).toBeVisible();
    await expect(page.getByText('352901234567890')).toBeVisible();
    await expect(page.getByText('352901234567891')).toBeVisible();
  });

  test('product editor pricing tab shows variant prices', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-pricing').click();
    const pricingPanel = page.getByTestId('product-pricing-panel');
    await expect(pricingPanel).toBeVisible();
    await expect(pricingPanel.getByRole('cell', { name: '128GB Black' })).toBeVisible();
    await expect(pricingPanel.getByRole('cell', { name: '850,000' })).toBeVisible();
  });

  test('product editor variant matrix generator opens and previews', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-variants').click();
    await expect(page.getByTestId('product-variants-panel')).toBeVisible();
    await page.getByTestId('product-generate-matrix-btn').evaluate((node) => {
      (node as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('product-variant-matrix-modal')).toBeVisible();
    await page.getByRole('button', { name: /Preview & create/i }).evaluate((node) => {
      (node as HTMLButtonElement).click();
    });
    await expect(page.getByText('IPH13-128GB-WHITE')).toBeVisible();
    await expect(page.getByText('IPH13-256GB-BLACK')).toBeVisible();
  });
});
