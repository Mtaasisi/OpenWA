import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  E2E_INBOX_CHAT_ID,
  E2E_INBOX_READY_SESSION_ID,
} from './helpers/inbox-after-connect-mocks';
import { installInboxContextMenuMocks } from './helpers/inbox-context-menu-mocks';

async function seedInboxPrefs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'openwa_user_preferences',
      JSON.stringify({
        inboxConversationFilter: 'all',
        inboxDefaultView: 'all',
        inboxMyStaffId: null,
        inboxChatTypeFilter: 'all',
      }),
    );
  });
}

function inboxDeepLink() {
  return `/inbox?session=${E2E_INBOX_READY_SESSION_ID}&chat=${encodeURIComponent(E2E_INBOX_CHAT_ID)}`;
}

async function waitForThreadMessages(page: import('@playwright/test').Page) {
  await page.waitForResponse(
    response =>
      response.url().includes(`/api/sessions/${E2E_INBOX_READY_SESSION_ID}/messages`) &&
      response.status() === 200,
    { timeout: 25_000 },
  );
}

test.describe('Inbox context menus', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInboxPrefs(page);
    await seedAdminSession(page);
    await installInboxContextMenuMocks(page);
  });

  test('R shortcut starts quote-reply to last inbound message', async ({ page }) => {
    await page.goto(inboxDeepLink());
    await waitForThreadMessages(page);
    await expect(page.getByLabel('Messages').getByText('Hello from Alice', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator('.inbox-chat-panel, .inbox-thread, section.inbox-main').first().click();
    await page.keyboard.press('r');
    await expect(page.getByText('Replying to')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.inbox-quote-reply-bar__preview')).toContainText('Hello from Alice');
  });
});
