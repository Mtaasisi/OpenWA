import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';

test.describe('Inbox — after session delete', () => {
  test('shows no-sessions state when the sessions list becomes empty', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const ready = buildReadyInboxSession();
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [buildInboxConversation(ready.id)],
    });
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect(page.getByText('No sessions found')).not.toBeVisible({ timeout: 15_000 });

    await page.route('**/api/sessions**', async route => {
      const url = route.request().url();
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      if (
        url.includes('/messages') ||
        url.includes('/contacts/') ||
        url.includes('/health/') ||
        url.includes('/engine')
      ) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/inbox/conversations**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [], total: 0, limit: 50, offset: 0 }),
      });
    });

    await page.reload();
    await expect(page.getByText('No sessions found')).toBeVisible({ timeout: 15_000 });
  });
});
