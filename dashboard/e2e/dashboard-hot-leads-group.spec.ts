import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';

const GROUP_JID = '120363123456789012@g.us';

test.describe('Dashboard — hot leads group display', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page, {
      pipelineCounts: { hot_leads: 1 },
      pipelineHotLeads: [],
      aiSignals: {
        discountRequests: 0,
        installmentRequests: 0,
        paymentConfirmations: 0,
        openEscalations: 1,
        stockingReminders: 0,
        openStockingReminders: [],
        recentEscalations: [
          {
            id: 'esc-group-1',
            sessionId: 'sess-1',
            chatId: GROUP_JID,
            reason: 'group_lead',
            detail: 'Looking for laptops in bulk',
            status: 'open',
            assignedStaffId: null,
            createdAt: new Date().toISOString(),
            customerName: null,
            customerPhone: null,
            displayName: 'Arusha Buyers',
            sessionName: 'Main WA',
          },
        ],
      },
    });
    await seedAdminSession(page);
  });

  test('shows resolved group name instead of raw group JID in hot leads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByRole('heading', { name: 'Hot Leads' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Arusha Buyers/).first()).toBeVisible();
    await expect(page.getByText(GROUP_JID)).toHaveCount(0);
    await expect(page.getByText('120363123456789012')).toHaveCount(0);
  });
});
