import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installProductsMocks } from './helpers/products-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { openProductEditor, waitForProductsPage } from './helpers/products-page';

test.describe('Products — manual QA checklist (automated)', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installProductsMocks(page);
    await seedAdminSession(page);
  });

  test('management table shows health badge for catalog row', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await expect(page.locator('.product-health-badge').first()).toBeVisible();
    await expect(page.locator('.product-health-badge').first()).toContainText(/missing image|OK|\d/i);
  });

  test('import history rollback calls rollback API', async ({ page }) => {
    let rollbackCalls = 0;
    await page.route('**/api/products/import/batch-mock-1/rollback', async (route) => {
      rollbackCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ rolledBack: 3, warnings: ['Skipped 1 sold item'] }),
      });
    });

    await page.goto('/products');
    await waitForProductsPage(page);
    await page.getByTestId('products-import-history-btn').click();
    const history = page.getByTestId('product-import-history');
    await expect(history).toBeVisible();
    await history.getByRole('button', { name: /rollback/i }).click();
    await expect.poll(() => rollbackCalls).toBe(1);
  });

  test('history tab lists audit events', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-history').click();
    await expect(page.getByText('inventory item created')).toBeVisible();
    await expect(page.getByText('product updated')).toBeVisible();
  });

  test('WhatsApp tab previews variant message', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-whatsapp').click();
    await page.getByRole('button', { name: /Preview WhatsApp message/i }).click();
    await expect(page.locator('.product-editor__wa-preview')).toContainText('iPhone 13');
    await expect(page.locator('.product-editor__wa-preview')).toContainText('128GB Black');
  });

  test('inventory bulk paste submits IMEI list', async ({ page }) => {
    let bulkPasteCalls = 0;
    await page.route(/\/api\/products\/prod-1\/inventory-items\/bulk-paste$/, async (route) => {
      bulkPasteCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: 3, skipped: 0, preview: [] }),
      });
    });

    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    const panel = page.getByTestId('product-inventory-panel');
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: /bulk paste/i }).click();
    await panel.locator('textarea').fill('352909999999991\n352909999999992\n352909999999993');
    await panel.getByRole('button', { name: 'Import list', exact: true }).click();
    await expect.poll(() => bulkPasteCalls).toBe(1);
  });

  test('inventory search finds row by IMEI', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    const panel = page.getByTestId('product-inventory-panel');
    await panel.getByPlaceholder(/Search IMEI/i).fill('352901234567890');
    await expect(panel.getByText('352901234567890')).toBeVisible();
    await expect(panel.getByText('352901234567891')).not.toBeVisible();
  });

  test('reserve action moves item to reserved status', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    const panel = page.getByTestId('product-inventory-panel');
    const row = panel.locator('tr', { hasText: '352901234567890' });
    await row.getByRole('button', { name: /reserve/i }).click();
    await expect(row.locator('.status-pill--reserved')).toBeVisible();
    await expect(row.getByRole('button', { name: /reserve/i })).not.toBeVisible();
    await expect(row.getByRole('button', { name: /release/i })).toBeVisible();
  });

  test('duplicate SKU attempt shows variant error', async ({ page }) => {
    await page.route(/\/api\/products\/prod-1\/variants$/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Duplicate SKU: IPH13-128-BLK already exists' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-variants').click();
    await page.getByRole('button', { name: 'Add variant', exact: true }).click();
    const addCard = page.locator('.product-editor__add-variant-card');
    await expect(addCard).toBeVisible();
    await addCard.locator('input:not([type="checkbox"])').nth(0).fill('Duplicate Variant');
    await addCard.locator('input:not([type="checkbox"])').nth(1).fill('IPH13-128-BLK');
    await addCard.locator('.product-editor__variant-edit-actions .btn-primary').click();
    await expect(page.locator('.product-editor__variant-error')).toContainText(/duplicate sku/i);
  });

  test('duplicate IMEI attempt shows inventory error', async ({ page }) => {
    await page.route(/\/api\/products\/prod-1\/inventory-items$/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Duplicate IMEI: 352901234567890 already exists in this branch' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    const panel = page.getByTestId('product-inventory-panel');
    await panel.getByPlaceholder(/^IMEI$/i).fill('352901234567890');
    await panel.getByRole('button', { name: /add item/i }).click();
    await expect(panel.locator('.product-editor__variant-error')).toContainText(/duplicate imei/i);
  });

  test('health badge surfaces duplicate SKU warning on catalog row', async ({ page }) => {
    await page.route('**/api/products**', async (route) => {
      const url = route.request().url();
      const pathname = new URL(url).pathname;
      if (route.request().method() === 'GET' && /^\/api\/products\/?$/.test(pathname)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'prod-dup',
              name: 'Duplicate SKU Phone',
              sku: 'DUP-SKU',
              category: 'Phones',
              brand: 'Test',
              isActive: true,
              totalStock: 50,
              variantCount: 1,
              sellingPrice: 100000,
              currency: 'TZS',
              imageUrl: 'https://example.com/phone.jpg',
              sku: 'DUP-SKU-UNIQUE',
              health: {
                productId: 'prod-dup',
                score: 55,
                issues: ['duplicate_sku'],
                warnings: [],
              },
              createdAt: '2026-06-01T10:00:00.000Z',
              updatedAt: '2026-06-12T10:00:00.000Z',
            },
          ]),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/products');
    await waitForProductsPage(page);
    await expect(page.locator('.product-health-badge').first()).toHaveAttribute('title', /duplicate sku/i);
  });

  test('mark sold action updates item status', async ({ page }) => {
    await page.goto('/products');
    await waitForProductsPage(page);
    await openProductEditor(page);
    await page.getByTestId('product-editor-tab-inventory').click();
    const panel = page.getByTestId('product-inventory-panel');
    const row = panel.locator('tr', { hasText: '352901234567891' });
    await row.getByRole('button', { name: /mark sold/i }).click();
    await expect(row.locator('.status-pill--sold')).toBeVisible();
    await expect(row.getByRole('button', { name: /mark sold/i })).not.toBeVisible();
  });
});
