import { test, expect } from '@playwright/test';

const LIVE_EMAIL = process.env.OPENWA_LIVE_EMAIL ?? 'care@care.com';
const LIVE_PASSWORD = process.env.OPENWA_LIVE_PASSWORD ?? '12345678';
const LIVE_E2E = process.env.OPENWA_LIVE_E2E === '1';

test.describe('Live stack — fast unrestricted AI auto-reply', () => {
  test.skip(!LIVE_E2E, 'Set OPENWA_LIVE_E2E=1 with backend on PLAYWRIGHT_BASE_URL (default http://localhost:2886)');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(LIVE_EMAIL);
    await page.locator('#password').fill(LIVE_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });
  });

  test('AI auto-reply settings show unrestricted ON and human delays OFF', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-auto-reply');
    await expect(page.getByText('Unrestricted auto-reply (fast, no escalations)')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByLabel('Unrestricted auto-reply (fast, no escalations)')).toBeChecked();
    await expect(page.getByLabel('Human-like reply delays')).not.toBeChecked();
  });

  test('WhatsApp Safety shows instant AI pacing values', async ({ page }) => {
    await page.goto('/settings?category=whatsapp&panel=whatsapp-safety');
    await expect(page.getByText(/WhatsApp Safety|Safety rules/i).first()).toBeVisible({
      timeout: 20_000,
    });
    const minDelay = page.getByLabel(/Min AI reply delay|Minimum AI reply delay/i).first();
    const maxDelay = page.getByLabel(/Max AI reply delay|Maximum AI reply delay/i).first();
    if (await minDelay.isVisible().catch(() => false)) {
      await expect(minDelay).toHaveValue('0');
      await expect(maxDelay).toHaveValue('0');
    }
  });

  test('Automations auto-reply health shows master enabled', async ({ page }) => {
    await page.goto('/automations?tab=autoReply');
    await expect(page.getByRole('tab', { name: 'AI Auto-reply' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText(/Master auto-reply|Auto-reply health|Advanced Auto-Reply/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
