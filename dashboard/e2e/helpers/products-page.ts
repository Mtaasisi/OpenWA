import { expect, type Page } from '@playwright/test';

export async function waitForProductsPage(page: Page, title = 'Products'): Promise<void> {
  await page.waitForResponse((res) => res.url().includes('/api/auth/me') && res.ok(), { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('products-import-btn')).toBeVisible({ timeout: 20_000 });
}

export async function openProductEditor(page: Page, productId = 'prod-1'): Promise<void> {
  const openBtn = page.getByTestId(`products-open-${productId}`);
  await openBtn.scrollIntoViewIfNeeded();
  await openBtn.evaluate((node) => {
    (node as HTMLButtonElement).click();
  });
  await expect(page.getByTestId('product-editor')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('product-editor-tab-overview')).toBeVisible({ timeout: 20_000 });
}
