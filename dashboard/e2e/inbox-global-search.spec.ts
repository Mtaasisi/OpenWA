import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';

test.describe('Inbox — global header search', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test('shows categorized search results and opens a chat on click', async ({ page }) => {
    const ready = buildReadyInboxSession();
    const conv = buildInboxConversation(ready.id, 'Dayana');
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [conv],
    });

    await page.route('**/api/inbox/conversations**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [conv],
          total: 1,
          limit: 6,
          offset: 0,
        }),
      });
    });

    await page.route('**/api/inbox/messages/search**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matches: [
            {
              id: 'msg-1',
              sessionId: ready.id,
              sessionName: ready.name,
              chatId: conv.chatId,
              chatName: 'Dayana',
              isGroup: false,
              direction: 'inbound',
              type: 'chat',
              body: 'Naomba uniwekee kwenye mfumo',
              bodyPreview: 'Naomba uniwekee kwenye mfumo',
              timestamp: Date.now(),
              createdAt: new Date().toISOString(),
            },
          ],
          total: 1,
          returned: 1,
          offset: 0,
          truncated: false,
        }),
      });
    });

    await seedAdminSession(page);
    await page.goto('/inbox');

    await expect(page.locator('.wa-app-header')).toBeVisible({ timeout: 20_000 });
    const search = page.locator('.inbox-header-search__input');
    await expect(search).toBeVisible({ timeout: 20_000 });

    await search.fill('day');
    const panel = page.locator('.inbox-header-search__panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Chats' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await expect(panel.getByText('Naomba uniwekee kwenye mfumo')).toBeVisible();

    await panel.locator('.inbox-header-search__chat-row').first().click();
    await expect(page.locator('.inbox-header-search__panel')).toBeHidden();
    await expect(page).toHaveURL(/session=.*&chat=/);
    await expect(page.locator('.inbox-interakt-conversation-item.active, .inbox-conversation-item.active')).toBeVisible();
  });
});
