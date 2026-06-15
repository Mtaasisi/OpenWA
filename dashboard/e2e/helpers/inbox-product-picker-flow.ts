import { expect, type Page } from '@playwright/test';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  E2E_INBOX_CHAT_ID,
  E2E_INBOX_READY_SESSION_ID,
  installInboxAfterConnectMocks,
} from './inbox-after-connect-mocks';
import { installProductsMocks } from './products-mocks';

export async function installInboxProductPickerMocks(page: Page): Promise<void> {
  const ready = buildReadyInboxSession();
  const conversation = buildInboxConversation(ready.id);
  await installProductsMocks(page);
  await installInboxAfterConnectMocks(page, {
    sessions: [ready],
    conversations: [conversation],
  });

  await page.route('**/api/whatsapp-consent/lookup**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        optInStatus: 'opted_in',
        canMarketing: true,
        canFollowup: true,
        within24h: true,
        requiresTemplate: false,
      }),
    });
  });

  await page.route('**/api/inbox/threads/crm**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessionId: E2E_INBOX_READY_SESSION_ID,
          chatId: E2E_INBOX_CHAT_ID,
          resolved: false,
          aiAutoReplyPaused: false,
          aiHandlingState: 'idle',
          aiOptOut: false,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/whatsapp-send-queue**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

export async function openInboxInventoryPicker(page: Page): Promise<void> {
  await page.goto(
    `/inbox?session=${E2E_INBOX_READY_SESSION_ID}&chat=${encodeURIComponent(E2E_INBOX_CHAT_ID)}`,
  );

  await expect(page.locator('.inbox-interakt-chat-header__name')).toHaveText('Alice Customer', {
    timeout: 20_000,
  });

  const productTrigger = page.getByTestId('inbox-product-picker-trigger');
  await expect(productTrigger).toBeVisible({ timeout: 20_000 });
  await productTrigger.evaluate((node) => {
    (node as HTMLButtonElement).click();
  });

  await expect(page.locator('#inbox-interakt-catalog-title')).toBeVisible({ timeout: 20_000 });
  await page.locator('.ws-product-card__name', { hasText: 'iPhone 13' }).click();
  await page.getByRole('button', { name: /Send product/i }).click();

  await expect(page.getByTestId('inbox-product-variant-picker')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /128GB Black/i }).click();
  await expect(page.getByTestId('inbox-product-inventory-picker')).toBeVisible({ timeout: 15_000 });
}
