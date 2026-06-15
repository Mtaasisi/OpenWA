import { test, expect, type Page } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installWhatsAppSafetyMocks } from './helpers/whatsapp-safety-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { installDashboardMocks } from './helpers/dashboard-mocks';

async function waitForSafetyPanel(page: Page) {
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 20_000 });
}

test.describe('Settings — WhatsApp Safety', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installWhatsAppSafetyMocks(page);
    await seedAdminSession(page);
  });

  test('overview tab shows safety metrics', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await expect(page.getByText('Queue pending')).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    await expect(page.getByText('Blocked today')).toBeVisible();
    await expect(page.getByText('Warm-up accounts')).toBeVisible();
  });

  test('send queue tab shows approve and cancel actions', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await page.getByRole('tab', { name: 'Send Queue' }).click();
    await expect(page.getByRole('columnheader', { name: 'Sends at' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Needs approval' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' }).first()).toBeVisible();
  });

  test('rules tab shows reply pacing presets', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await page.getByRole('tab', { name: 'Rules' }).click();
    await expect(page.getByText('Reply pacing')).toBeVisible();
    await expect(page.getByText('Pacing preset')).toBeVisible();
    await page.locator('select').first().selectOption('instant');
    await expect(page.getByLabel('Min AI reply delay (ms)')).toHaveValue('0');
    await expect(page.getByLabel('Max AI reply delay (ms)')).toHaveValue('0');
    await page.getByRole('button', { name: /save/i }).click();
  });

  test('rules tab can enable campaigns toggle', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await page.getByRole('tab', { name: 'Rules' }).click();
    const row = page.locator('.wa-safety-policy-row').filter({
      hasText: 'Allow WhatsApp campaigns (disabled by default)',
    });
    await expect(row).toBeVisible();
    await row.locator('.wa-safety-toggle').click();
    await page.getByRole('button', { name: /save/i }).click();
    await expect(row.locator('input[type="checkbox"]')).toBeChecked();
  });

  test('send queue tab shows warm-up progress and pause/resume controls', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await page.getByRole('tab', { name: 'Send Queue' }).click();
    await expect(page.getByText(/Main WA.*day 2/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  });

  test('activity tab renders decision rows', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety');
    await waitForSafetyPanel(page);
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByRole('cell', { name: 'Customer opted out' }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Automated send queued')).toBeVisible();
  });

  test('deep link opens send queue tab directly', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=queue');
    await waitForSafetyPanel(page);
    await expect(page.getByRole('tab', { name: 'Send Queue' })).toHaveAttribute('class', /active/);
    await expect(page.getByRole('cell', { name: 'Needs approval' })).toBeVisible();
  });

  test('legacy policy deep link opens rules tab', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=policy');
    await waitForSafetyPanel(page);
    await expect(page).toHaveURL(/waTab=rules/);
    await expect(page.getByRole('tab', { name: 'Rules' })).toHaveAttribute('class', /active/);
  });

  test('legacy health deep link opens activity tab', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=health');
    await expect(page.getByText('Recent events')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/waTab=activity/);
    await expect(page.getByText('Outside warm-up limits')).toBeVisible();
  });

  test('rules tab check-send tester runs dry-run', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=rules');
    await waitForSafetyPanel(page);
    await page.locator('.wa-safety-accordion__trigger', { hasText: 'Advanced' }).click();
    await page.getByRole('combobox', { name: 'Session' }).selectOption('sess-1');
    await page.getByRole('textbox', { name: 'Chat ID' }).fill('255712345678@c.us');
    await page.getByRole('textbox', { name: 'Message body' }).fill('Hello from check-send');
    await page.getByRole('button', { name: 'Run check' }).click();
    await expect(page.getByText(/Allowed:/)).toBeVisible({ timeout: 10_000 });
  });

  test('consent tab shows restore action', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=consent');
    await expect(page.getByText('+255712345678')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
  });

  test('consent tab shows marketing consent gaps', async ({ page }) => {
    await page.goto('/settings?section=integrations&panel=whatsapp-safety&waTab=consent');
    await expect(page.getByText('Missing marketing consent')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('+255798765432')).toBeVisible();
    await expect(page.getByText('Marketing').first()).toBeVisible();
  });
});

test.describe('Dashboard — WhatsApp safety alerts', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page);
    await seedAdminSession(page);
    await page.route('**/api/dashboard/whatsapp-safety-alerts', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          blockedToday: 4,
          pendingQueue: 12,
          warmups: [{ id: 'w-1', sessionId: 'sess-1', dayNumber: 1, outboundSentToday: 5, maxOutboundToday: 30 }],
          approvalRequired: [
            {
              id: 'q-1',
              sessionId: 'sess-1',
              status: 'approval_required',
              chatId: '255712345678@c.us',
              source: 'ai',
              riskLevel: 'high',
            },
          ],
          criticalAlerts: [],
        }),
      });
    });
  });

  test('shows approval-required alert on control room', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Daily Control Room' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('WhatsApp sends need approval')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('1 queued message(s) require admin approval')).toBeVisible();
  });

  test('approval alert links to queue tab', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('WhatsApp sends need approval')).toBeVisible({ timeout: 15_000 });
    const reviewQueue = page
      .locator('.dash-alert-row')
      .filter({ hasText: 'WhatsApp sends need approval' })
      .getByRole('button', { name: 'Review queue' });
    await reviewQueue.scrollIntoViewIfNeeded();
    await reviewQueue.click();
    await expect(page).toHaveURL(/panel=whatsapp-safety/);
    await expect(page).toHaveURL(/waTab=queue/);
  });
});
