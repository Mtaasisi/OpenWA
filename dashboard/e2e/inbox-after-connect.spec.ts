import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  buildConnectingInboxSession,
  buildInboxConversation,
  buildReadyInboxSession,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';

async function seedInboxPrefs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('openwa_user_preferences', JSON.stringify({
      inboxConversationFilter: 'all',
      inboxDefaultView: 'one',
      inboxMyStaffId: null,
      inboxChatTypeFilter: 'all',
    }));
  });
}

test.describe('Inbox — after session connect', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInboxPrefs(page);
  });

  test('fetches conversations when the session is ready', async ({ page }) => {
    const ready = buildReadyInboxSession();
    let conversationsRequested = 0;
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [buildInboxConversation(ready.id)],
    });
    await page.route('**/api/inbox/conversations**', async route => {
      conversationsRequested += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [buildInboxConversation(ready.id)],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      });
    });
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect.poll(() => conversationsRequested, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText('No stored conversations for this account yet.')).not.toBeVisible();
  });

  test('fetches conversations while another session is still connecting', async ({ page }) => {
    const ready = buildReadyInboxSession();
    const connecting = buildConnectingInboxSession();
    let conversationsRequested = 0;
    await installInboxAfterConnectMocks(page, {
      sessions: [connecting, ready],
      conversations: [buildInboxConversation(ready.id)],
    });
    await page.route('**/api/inbox/conversations**', async route => {
      conversationsRequested += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [buildInboxConversation(ready.id)],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      });
    });
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect.poll(() => conversationsRequested, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText('No stored conversations for this account yet.')).not.toBeVisible();
  });

  test('shows syncing empty state while background sync runs', async ({ page }) => {
    const ready = buildReadyInboxSession({ backgroundSyncing: true });
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [],
    });
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect(
      page.getByText('Connected — loading your chats and contacts.'),
    ).toBeVisible({ timeout: 15_000 });
  });
});
