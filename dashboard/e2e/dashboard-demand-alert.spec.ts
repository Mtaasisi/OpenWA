import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';

test.describe('Dashboard — demand campaign alerts', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page, {
      learningAlerts: {
        learning: {
          pendingCount: 0,
          unknownToday: 0,
          repeatedUnknownCount: 0,
          staffCorrectionsWaiting: 0,
          urgentWaitingCustomers: 0,
          aiPausedChats: 0,
          topPending: [],
        },
        demand: {
          outOfStockDemand: 0,
          installmentDemand: 0,
          missingProducts: 0,
          mostAskedProduct: null,
          draftCampaignsCount: 2,
          topDraftCampaigns: [
            {
              id: 'camp-1',
              title: 'Restock iPhone 15',
              recipientCount: 5,
              channel: 'sms',
            },
          ],
        },
      },
    });
    await seedAdminSession(page);
  });

  test('shows draft campaign alert and work queue item', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText('Product demand campaigns need approval'),
    ).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Today' }).click({ force: true });
    await expect(page.getByText('Restock iPhone 15')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Campaigns' }).first()).toBeVisible();
  });

  test('shows approved WhatsApp campaign alert', async ({ page }) => {
    await installDashboardMocks(page, {
      learningAlerts: {
        learning: {
          pendingCount: 0,
          unknownToday: 0,
          repeatedUnknownCount: 0,
          staffCorrectionsWaiting: 0,
          urgentWaitingCustomers: 0,
          aiPausedChats: 0,
          topPending: [],
        },
        demand: {
          outOfStockDemand: 0,
          installmentDemand: 0,
          missingProducts: 0,
          mostAskedProduct: null,
          draftCampaignsCount: 0,
          approvedCampaignsCount: 2,
          topDraftCampaigns: [],
        },
      },
    });

    await page.goto('/');
    await expect(page.getByText('WhatsApp campaigns approved to send')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('2 campaign(s) passed preflight')).toBeVisible();
  });
});
