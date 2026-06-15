import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  AI_TAKEOVER_CHAT_BLOCKED,
  AI_TAKEOVER_CHAT_ELIGIBLE,
  AI_TAKEOVER_SESSION_ID,
  buildBlockedConversation,
  buildEligibleConversation,
  buildFailedOutgoingMessage,
  buildManualTakeoverCrm,
  installInboxAiTakeoverMocks,
  seedInteraktTheme,
} from './helpers/inbox-ai-takeover-mocks';

async function seedInboxPrefs(page: Page) {
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

test.describe('Inbox — AI takeover UX', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInteraktTheme(page);
    await seedInboxPrefs(page);
    await seedAdminSession(page);
  });

  test('shows blocked AI strip with Resume AI after staff takeover', async ({ page }) => {
    await installInboxAiTakeoverMocks(page, {
      crm: {
        aiAutoReplyPaused: true,
        aiHandlingState: 'human_handling',
      },
      conversations: [buildBlockedConversation()],
    });

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_BLOCKED)}`,
    );

    const strip = page.locator('.inbox-interakt-ai-strip--blocked');
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip.getByText(/You took over this chat/i)).toBeVisible();
    await expect(strip.getByRole('button', { name: /Resume AI/i })).toBeVisible();
  });

  test('confirms before staff send pauses AI on eligible direct chat', async ({ page }) => {
    let sendCount = 0;
    await installInboxAiTakeoverMocks(page, {
      conversations: [buildEligibleConversation()],
    });
    await page.route('**/api/inbox/send-text**', async route => {
      sendCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messageId: 'msg-e2e-1', timestamp: Date.now() }),
      });
    });

    page.once('dialog', async dialog => {
      throw new Error(`Unexpected native dialog: ${dialog.message()}`);
    });

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Hello from staff');

    const sendBtn = page
      .locator('.inbox-interakt-composer-send-circle, .inbox-send-btn')
      .first();
    await sendBtn.click();

    const modal = page.locator('[data-testid="inbox-ai-takeover-send-confirm"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await expect(modal).toContainText(/pause AI auto-reply/i);
    await modal.getByRole('button', { name: /Cancel/i }).click();
    await expect(modal).toBeHidden();

    await expect.poll(() => sendCount).toBe(0);
  });

  test('sends after staff confirms AI takeover pause', async ({ page }) => {
    let sendCount = 0;
    await installInboxAiTakeoverMocks(page, {
      conversations: [buildEligibleConversation()],
    });
    await page.route('**/api/inbox/send-text**', async route => {
      sendCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messageId: 'msg-e2e-2', timestamp: Date.now() }),
      });
    });

    page.once('dialog', async dialog => {
      throw new Error(`Unexpected native dialog: ${dialog.message()}`);
    });

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Confirmed send');

    const sendBtn = page
      .locator('.inbox-interakt-composer-send-circle, .inbox-send-btn')
      .first();
    await sendBtn.click();

    const modal = page.locator('[data-testid="inbox-ai-takeover-send-confirm"]');
    await expect(modal).toBeVisible({ timeout: 5_000 });
    await modal.getByRole('button', { name: /Send message/i }).click();
    await expect(modal).toBeHidden();

    await expect.poll(() => sendCount, { timeout: 10_000 }).toBe(1);
  });

  test('shows manual takeover countdown with resume action', async ({ page }) => {
    await installInboxAiTakeoverMocks(page, {
      crm: buildManualTakeoverCrm(14),
      conversations: [
        {
          ...buildEligibleConversation(),
          aiAutoReplyPaused: true,
        },
      ],
    });

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const strip = page.locator('.inbox-interakt-ai-strip--blocked');
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip.getByText(/AI paused by manual reply/i)).toBeVisible();
    await expect(strip.getByText(/resumes in \d+ min/i)).toBeVisible();
    await expect(strip.getByRole('button', { name: /Resume AI/i })).toBeVisible();
    await expect(strip.getByRole('button', { name: /Keep paused/i })).toBeVisible();
  });

  test('shows failed message retry actions and calls retry API', async ({ page }) => {
    let retryCount = 0;
    await installInboxAiTakeoverMocks(page, {
      conversations: [buildEligibleConversation()],
      messages: [buildFailedOutgoingMessage()],
    });
    await page.route('**/api/inbox/messages/**/retry**', async route => {
      retryCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messageId: 'msg-retried-e2e', timestamp: Date.now() }),
      });
    });

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const failedPanel = page.locator('.inbox-failed-msg');
    await expect(failedPanel).toBeVisible({ timeout: 20_000 });
    await expect(failedPanel.getByText('Failed')).toBeVisible();
    await expect(failedPanel.getByText('Network timeout')).toBeVisible();

    await failedPanel.getByRole('button', { name: 'Retry' }).click();
    await expect.poll(() => retryCount, { timeout: 10_000 }).toBe(1);
  });
});
