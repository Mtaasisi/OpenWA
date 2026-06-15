import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  E2E_INBOX_CHAT_ID,
  E2E_INBOX_READY_SESSION_ID,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';
import { seedTacticalTheme } from './helpers/theme-mocks';

async function installInboxComposerSupportMocks(page: import('@playwright/test').Page): Promise<void> {
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

test.describe('Inbox — tactical variant', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
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
  });

  test('renders unified tactical shell with shared list header and new chat', async ({ page }) => {
    const ready = buildReadyInboxSession();
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [buildInboxConversation(ready.id)],
    });
    await seedTacticalTheme(page);
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect(page.locator('.tactical-inbox')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible();
    await expect(
      page.locator('.tac-conv h3', { hasText: buildInboxConversation(ready.id).displayName }),
    ).toBeVisible();
  });

  test('exposes tabbed composer actions in tactical variant', async ({ page }) => {
    const ready = buildReadyInboxSession();
    const conversation = buildInboxConversation(ready.id);
    await installInboxAfterConnectMocks(page, {
      sessions: [ready],
      conversations: [conversation],
    });
    await installInboxComposerSupportMocks(page);
    await seedTacticalTheme(page);
    await seedAdminSession(page);

    await page.goto(
      `/inbox?session=${E2E_INBOX_READY_SESSION_ID}&chat=${encodeURIComponent(E2E_INBOX_CHAT_ID)}`,
    );

    await expect(page.locator('.tactical-inbox')).toBeVisible({ timeout: 15_000 });
    const composer = page.locator('.tac-composer-host');
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await expect(composer.getByRole('tab', { name: 'Reply', exact: true })).toBeVisible();
    await expect(composer.getByRole('tab', { name: /internal notes/i })).toBeVisible();
  });
});
