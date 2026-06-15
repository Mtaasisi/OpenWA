import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  AI_TAKEOVER_CHAT_ELIGIBLE,
  AI_TAKEOVER_SESSION_ID,
  installInboxTrainingLearnMocks,
  seedInteraktTheme,
} from './helpers/inbox-training-learn-mocks';
import { stubTrainingWsItemMocks } from './helpers/ai-training-center-mocks';

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

test.describe('Inbox — AI training learn strip', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedInteraktTheme(page);
    await seedInboxPrefs(page);
    await seedAdminSession(page);
  });

  test('shows teach-AI strip after staff replies to waiting_human chat', async ({ page }) => {
    await installInboxTrainingLearnMocks(page);

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Tupo Dar es Salaam Boss.');

    const sendBtn = page.locator('.inbox-interakt-composer-send-circle, .inbox-send-btn').first();
    await sendBtn.click();

    const strip = page.getByTestId('inbox-ai-training-learn-strip');
    await expect(strip).toBeVisible({ timeout: 10_000 });
    await expect(strip.getByText(/Teach AI from this reply/i)).toBeVisible();
    await expect(strip.getByRole('link', { name: /Open Training Center/i })).toHaveAttribute(
      'href',
      /\/ai\?tab=training/,
    );
  });

  test('learn strip deep links to training item after pending WS event', async ({ page }) => {
    await installInboxTrainingLearnMocks(page);

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Tupo Dar es Salaam Boss.');
    await page.locator('.inbox-interakt-composer-send-circle, .inbox-send-btn').first().click();

    const strip = page.getByTestId('inbox-ai-training-learn-strip');
    await expect(strip).toBeVisible({ timeout: 10_000 });

    await page.evaluate(
      ({ sessionId, chatId, itemId }) => {
        const dispatch = (
          window as Window & {
            __openwaDispatchTestSocketEvent?: (
              event: string,
              sessionId: string,
              data: Record<string, unknown>,
            ) => void;
          }
        ).__openwaDispatchTestSocketEvent;
        dispatch?.('ai.learning.pending', sessionId, { chatId, itemId, question: 'Mko wapi?' });
      },
      { sessionId: AI_TAKEOVER_SESSION_ID, chatId: AI_TAKEOVER_CHAT_ELIGIBLE, itemId: 'train-ws-1' },
    );

    await expect(strip.getByRole('link', { name: /Open Training Center/i })).toHaveAttribute(
      'href',
      /\/ai\?tab=training&item=train-ws-1/,
    );
  });

  test('learn strip opens training center review for WS item', async ({ page }) => {
    await installInboxTrainingLearnMocks(page);
    await stubTrainingWsItemMocks(page);

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Tupo Dar es Salaam Boss.');
    await page.locator('.inbox-interakt-composer-send-circle, .inbox-send-btn').first().click();

    const strip = page.getByTestId('inbox-ai-training-learn-strip');
    await expect(strip).toBeVisible({ timeout: 10_000 });

    await page.evaluate(
      ({ sessionId, chatId, itemId }) => {
        const dispatch = (
          window as Window & {
            __openwaDispatchTestSocketEvent?: (
              event: string,
              sessionId: string,
              data: Record<string, unknown>,
            ) => void;
          }
        ).__openwaDispatchTestSocketEvent;
        dispatch?.('ai.learning.pending', sessionId, { chatId, itemId, question: 'Mko wapi?' });
      },
      { sessionId: AI_TAKEOVER_SESSION_ID, chatId: AI_TAKEOVER_CHAT_ELIGIBLE, itemId: 'train-ws-1' },
    );

    await strip.getByRole('link', { name: /Open Training Center/i }).click();
    await expect(page).toHaveURL(/\/ai\?tab=training&item=train-ws-1/);
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Customer asked where the store is located.')).toBeVisible();
    await expect(page.locator('[data-item-id="train-ws-1"].aitc-card--focused')).toBeVisible();
  });

  test('dismiss hides the teach-AI strip', async ({ page }) => {
    await installInboxTrainingLearnMocks(page);

    await page.goto(
      `/inbox?session=${AI_TAKEOVER_SESSION_ID}&chat=${encodeURIComponent(AI_TAKEOVER_CHAT_ELIGIBLE)}`,
    );

    const composer = page.locator('.inbox-interakt-composer-pill__field, textarea.inbox-compose-input').first();
    await expect(composer).toBeVisible({ timeout: 20_000 });
    await composer.fill('Tupo Sinza leo.');
    await page.locator('.inbox-interakt-composer-send-circle, .inbox-send-btn').first().click();

    const strip = page.getByTestId('inbox-ai-training-learn-strip');
    await expect(strip).toBeVisible({ timeout: 10_000 });
    await strip.getByRole('button', { name: /Not now/i }).click();
    await expect(strip).toHaveCount(0);
  });
});
