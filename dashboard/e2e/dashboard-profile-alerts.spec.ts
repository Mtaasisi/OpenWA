import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';

test.describe('Dashboard — progressive profiling alerts', () => {
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
          draftCampaignsCount: 0,
          topDraftCampaigns: [],
        },
        profile: {
          nameReview: 2,
          learningReview: 0,
          lostWaiting: 3,
          openLostDemand: 3,
        },
      },
    });
    await seedAdminSession(page);
  });

  test('shows lost-demand and name-review alerts on overview', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Customers waiting for stock')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Customer names need review')).toBeVisible();
  });

  test('Today tab lists profile work queue items', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('tab', { name: 'Today' }).click({ force: true });
    await expect(page.getByText('Review AI-detected customer names')).toBeVisible();
    await expect(page.getByText('Notify customers when stock arrives')).toBeVisible();
    await expect(page.getByRole('link', { name: 'View Follow-ups' }).first()).toBeVisible();
  });
});
