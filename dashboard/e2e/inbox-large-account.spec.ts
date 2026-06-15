import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  buildReadyInboxSession,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';

async function seedInboxPrefs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'openwa_user_preferences',
      JSON.stringify({
        inboxConversationFilter: 'all',
        inboxDefaultView: 'one',
        inboxMyStaffId: null,
        inboxChatTypeFilter: 'all',
      }),
    );
  });
}

test.describe('Large inbox loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInboxPrefs(page);
    const ready = buildReadyInboxSession({ id: 'sess-1', name: 'Shop' });
    await installInboxAfterConnectMocks(page, { sessions: [ready], conversations: [] });
    await seedAdminSession(page);
  });

  test('first page loads quickly with cursor pagination for large accounts', async ({ page }) => {
    let listRequestCount = 0;
    let firstIncludeCounts: string | null = null;

    await page.route('**/api/inbox/conversations**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('queue-counts')) {
        await route.fallback();
        return;
      }
      listRequestCount += 1;
      if (listRequestCount === 1) {
        firstIncludeCounts = url.searchParams.get('includeCounts');
      }
      const cursor = url.searchParams.get('cursor');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [
            {
              sessionId: 'sess-1',
              sessionName: 'Shop',
              sessionStatus: 'ready',
              chatId: cursor ? '255700000002@c.us' : '255700000001@c.us',
              displayName: cursor ? 'Customer Two' : 'Customer One',
              lastMessageAt: new Date().toISOString(),
              lastPreview: cursor ? 'Second page' : 'Hello',
              lastDirection: 'incoming',
              messageCount: 1,
              unreadCount: 1,
              hasUnread: true,
              resolved: false,
              hasFollowUp: false,
            },
          ],
          total: 12000,
          limit: 50,
          offset: 0,
          nextCursor: cursor ? null : '2024-06-01T12:00:00.000Z|sess-1|255700000001@c.us',
          hasMore: !cursor,
          largeAccountMode: true,
          totalApproximate: true,
          threadTotal: 12000,
        }),
      });
    });

    await page.route('**/api/inbox/conversations/queue-counts**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          counts: { needs_reply: 3, unassigned: 1 },
          cached: false,
          largeAccountMode: true,
        }),
      });
    });

    await page.goto('/inbox');
    await expect(page.getByText('Hello')).toBeVisible({ timeout: 20_000 });
    expect(listRequestCount).toBeGreaterThanOrEqual(1);
    expect(firstIncludeCounts).not.toBe('true');

    await expect.poll(() => listRequestCount, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
    await expect(page.getByText('Second page')).toBeVisible({ timeout: 15_000 });
  });
});
