import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { seedInteraktTheme } from './helpers/inbox-ai-takeover-mocks';
import {
  installInboxProductPickerMocks,
  openInboxInventoryPicker,
} from './helpers/inbox-product-picker-flow';

test.describe('Inbox — product IMEI picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInteraktTheme(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        'openwa_user_preferences',
        JSON.stringify({
          inboxConversationFilter: 'all',
          inboxDefaultView: 'one',
          inboxMyStaffId: null,
          inboxChatTypeFilter: 'all',
          productInStockOnly: false,
          productIncludeDevices: false,
          productIncludeImage: false,
          productRefreshBeforeSend: false,
        }),
      );
    });
  });

  test('tracked variant opens IMEI device picker from inbox catalog', async ({ page }) => {
    await installInboxProductPickerMocks(page);
    await seedAdminSession(page);
    await openInboxInventoryPicker(page);

    const inventoryPicker = page.getByTestId('inbox-product-inventory-picker');
    await expect(inventoryPicker.getByRole('button', { name: /352901234567890/ })).toBeVisible();
    await expect(inventoryPicker.getByRole('button', { name: /352901234567891/ })).toBeVisible();
    await expect(
      inventoryPicker.getByRole('button', { name: /Send variant \(no specific device\)/i }),
    ).toBeVisible();
  });

  test('reserved and sold IMEIs are excluded from inbox device picker', async ({ page }) => {
    await installInboxProductPickerMocks(page);
    await seedAdminSession(page);
    await openInboxInventoryPicker(page);

    const inventoryPicker = page.getByTestId('inbox-product-inventory-picker');
    await expect(inventoryPicker.getByRole('button', { name: /352901234567890/ })).toBeVisible();
    await expect(inventoryPicker.getByRole('button', { name: /352901234567891/ })).toBeVisible();
    await expect(inventoryPicker.getByRole('button', { name: /352901234567892/ })).not.toBeVisible();
    await expect(inventoryPicker.getByRole('button', { name: /352901234567893/ })).not.toBeVisible();
  });
});
