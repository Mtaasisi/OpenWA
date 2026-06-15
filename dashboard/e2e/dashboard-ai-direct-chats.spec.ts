import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';
import {
  AI_TAKEOVER_SESSION_ID,
  buildBlockedConversation,
  buildEligibleConversation,
} from './helpers/inbox-ai-takeover-mocks';

test.describe('Dashboard — direct AI chat metrics', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
  });

  test('shows eligible and blocked direct chat counts in AI safety panel', async ({ page }) => {
    await installDashboardMocks(page);

    await page.route('**/api/inbox/conversations**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversations: [buildEligibleConversation(), buildBlockedConversation()],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      });
    });

    await page.route('**/api/settings/ai/auto-reply/health**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          masterEnabled: true,
          ready: true,
          checks: [],
          sessions: [{ id: AI_TAKEOVER_SESSION_ID, name: 'Main WA', status: 'ready' }],
          stats: {
            aiReplies24h: 5,
            openEscalations: 2,
            knowledgeChunks: 10,
            knowledgeFiles: 1,
          },
        }),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText('Direct chats — AI ready')).toBeVisible();
    await expect(page.getByText('Direct chats — AI blocked')).toBeVisible();

    const safetySection = page.locator('.dash-section--ai-safety');
    await expect(safetySection.getByRole('link', { name: '1' }).first()).toBeVisible();
    await expect(safetySection.getByRole('link', { name: '1' }).nth(1)).toBeVisible();
  });
});
