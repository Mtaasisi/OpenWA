import { test, expect, type Page } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installAiChatMocks } from './helpers/ai-chat-mocks';

async function waitForAiStudio(page: Page): Promise<void> {
  await expect(page.getByTestId('ai-chat-studio')).toBeVisible({ timeout: 20_000 });
}

test.describe('AI Chat — studio layout', () => {
  test.beforeEach(async ({ page }) => {
    await installAiChatMocks(page);
    await seedAdminSession(page);
  });

  test('shows hero cards on new chat and sends prompt', async ({ page }) => {
    await page.goto('/ai');
    await waitForAiStudio(page);
    await page.getByTestId('ai-chat-new-btn').click();

    await expect(page.getByTestId('ai-chat-hero')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('ai-chat-hero-card-campaign').getByRole('button', { name: 'View report', exact: true }).click();
    await expect(page.getByText('Mock reply for:')).toBeVisible({ timeout: 15_000 });
  });

  test('opens search sheet and navigates to campaigns', async ({ page }) => {
    await page.goto('/ai');
    await waitForAiStudio(page);
    await page.getByTestId('ai-chat-search-btn').click();
    await expect(page.getByTestId('ai-chat-search-sheet')).toBeVisible();

    await page.getByTestId('ai-chat-search-link-campaigns').click();
    await expect(page).toHaveURL(/\/campaigns/);
  });

  test('history drawer lists conversations', async ({ page }) => {
    await page.goto('/ai');
    await waitForAiStudio(page);
    await page.getByLabel('Chat history').first().click();
    await expect(page.getByText('Campaign health check')).toBeVisible({ timeout: 10_000 });
  });

  test('compose sends a message in existing chat', async ({ page }) => {
    await page.goto('/ai?conv=conv-1');
    await waitForAiStudio(page);
    await expect(page.locator('.ai-chat-bubble--user').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('ai-chat-compose-input').fill('Check pipeline hot leads');
    await page.getByTestId('ai-chat-send-btn').click();

    await expect(page.getByText('Mock reply for: Check pipeline hot leads')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('hero open page navigates to pipeline', async ({ page }) => {
    await page.goto('/ai');
    await waitForAiStudio(page);
    await page.getByTestId('ai-chat-new-btn').click();
    await expect(page.getByTestId('ai-chat-hero')).toBeVisible({ timeout: 15_000 });
    await page
      .getByTestId('ai-chat-hero-card-leads')
      .getByRole('button', { name: 'Open page' })
      .click();
    await expect(page).toHaveURL(/\/pipeline/);
  });

  test('Cmd+K opens search sheet', async ({ page }) => {
    await page.goto('/ai');
    await waitForAiStudio(page);
    await page.keyboard.press('Meta+k');
    await expect(page.getByTestId('ai-chat-search-sheet')).toBeVisible();
  });

  test('agent action success card for disable auto reply', async ({ page }) => {
    await page.goto('/ai?conv=conv-1');
    await waitForAiStudio(page);
    await expect(page.locator('.ai-chat-bubble--user').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('ai-chat-compose-input').fill('Zima AI auto reply');
    await page.getByTestId('ai-chat-send-btn').click();

    await expect(page.getByTestId('agent-action-success')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('agent-action-success').getByText('AI auto reply imezimwa.')).toBeVisible();
  });

  test('agent action confirmation card and confirm flow', async ({ page }) => {
    await page.goto('/ai?conv=conv-1');
    await waitForAiStudio(page);
    await expect(page.locator('.ai-chat-bubble--user').first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('ai-chat-compose-input').fill('Zima burst reading');
    await page.getByTestId('ai-chat-send-btn').click();

    await expect(page.getByTestId('agent-action-confirmation')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Confirm action' }).click();
    await expect(page.getByTestId('agent-action-success')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('agent-action-success').getByText('Burst reading imezimwa.')).toBeVisible();
  });

  test('share copies conversation URL to clipboard', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __sharedUrl?: string }).__sharedUrl = '';
      navigator.clipboard.writeText = async (text: string) => {
        (window as unknown as { __sharedUrl?: string }).__sharedUrl = text;
      };
    });

    await page.goto('/ai?conv=conv-1');
    await waitForAiStudio(page);
    await page.getByRole('button', { name: 'Share' }).click();

    await expect
      .poll(async () =>
        page.evaluate(() => (window as unknown as { __sharedUrl?: string }).__sharedUrl ?? ''),
      )
      .toContain('conv=conv-1');
  });
});
