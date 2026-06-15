import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';
import { installProductsMocks } from './helpers/products-mocks';
import { installAiChatMocks } from './helpers/ai-chat-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/stitch');

const MOCK_PIPELINE_LEAD = {
  id: 'conv-pipeline-1',
  sessionId: 'sess-inbox-ready',
  chatId: '255700000000@c.us',
  customerName: 'Amina K.',
  customerPhone: '+255700000000',
  customerHandle: null,
  source: 'whatsapp',
  channel: 'whatsapp',
  stage: 'hot_leads',
  productInterest: 'iPhone 15 Pro',
  priority: 'hot',
  lastCustomerMessageAt: new Date().toISOString(),
  lastStaffMessageAt: null,
  nextFollowupAt: new Date().toISOString(),
  nextAction: 'Send updated quote',
  assignedStaffId: null,
  assignedStaffName: null,
  isManual: false,
  linkedSaleId: null,
  responseTimeSeconds: 3600,
};

async function seedStitchShell(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('openwa_active_theme_id', 'digital-reconstruction');
    localStorage.setItem('openwa_theme', 'light');
    localStorage.setItem(
      'openwa_status_bar_prefs',
      JSON.stringify({
        showStatusBar: true,
        refreshInterval: 60_000,
        showWorkSummary: true,
        showBranch: true,
        compactMode: 'auto',
        showAdvancedHealth: false,
        version: 2,
      }),
    );
  });
}

async function installWorkspacePreviewMocks(page: import('@playwright/test').Page) {
  await installDashboardMocks(page, {
    pipelineHotLeads: [MOCK_PIPELINE_LEAD],
    pipelineCounts: {
      new_leads: 2,
      hot_leads: 1,
      waiting_reply: 3,
      followup_needed: 1,
      payment_pending: 0,
      won_leads: 4,
      lost_leads: 1,
    },
  });
  await installProductsMocks(page);
  await installAiChatMocks(page);
  await installSettingsShellMocks(page);

  await page.route('**/api/followup/pipeline?**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_PIPELINE_LEAD]),
    });
  });

  await page.route('**/api/followup/customers**', async route => {
    const url = route.request().url();
    if (/\/customers\/[^/?]+/.test(url)) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ ...MOCK_PIPELINE_LEAD, stage: 'contacted' }],
        total: 1,
        stats: { total: 42, unidentified: 3, activeThisWeek: 12 },
      }),
    });
  });

  await page.route('**/api/quotes**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'quote-1',
          quoteNumber: 'Q-1042',
          sessionId: 'sess-inbox-ready',
          chatId: '255700000000@c.us',
          customerName: 'Amina K.',
          customerPhone: '+255700000000',
          status: 'sent',
          totalAmount: 850000,
          currency: 'TZS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'quote-2',
          quoteNumber: 'Q-1041',
          sessionId: 'sess-inbox-ready',
          chatId: '255711111111@c.us',
          customerName: 'Daniel K.',
          customerPhone: '+255711111111',
          status: 'draft',
          totalAmount: 420000,
          currency: 'TZS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/quick-reply/templates**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'qr-1',
          branchId: null,
          name: 'Warm welcome',
          category: 'greeting',
          body: 'Hello! Thanks for reaching out — how can we help today?',
          language: 'en',
          isActive: true,
          createdBy: null,
          updatedBy: null,
        },
        {
          id: 'qr-2',
          branchId: null,
          name: 'Product details',
          category: 'product_info',
          body: 'Here are the specs and pricing for the model you asked about.',
          language: 'en',
          isActive: true,
          createdBy: null,
          updatedBy: null,
        },
      ]),
    });
  });
}

test.describe('Capture Stitch workspace previews', () => {
  test('save workspace page screenshots', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStitchShell(page);
    await installWorkspacePreviewMocks(page);
    await seedAdminSession(page);

    await page.goto('/followups');
    await expect(page.locator('.layout--stitch-v1')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.fu-bento')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-followups.png'),
      fullPage: false,
    });

    await page.goto('/products');
    await expect(page.locator('.products-summary-cards')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.products-category-sidebar')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-products.png'),
      fullPage: false,
    });

    await page.goto('/dashboard');
    await expect(page.locator('.layout--stitch-v1')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.dashboard--control-room-v2')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cr-tab-nav')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-dashboard.png'),
      fullPage: false,
    });

    await page.goto('/pipeline');
    await expect(page.locator('.customers-pipeline-panel--interakt')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Amina K.')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-pipeline.png'),
      fullPage: false,
    });

    await page.goto('/quotes');
    await expect(page.locator('.quotes-bento')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Q-1042')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-quotes.png'),
      fullPage: false,
    });

    await page.goto('/templates');
    await expect(page.locator('.templates-panel')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-templates.png'),
      fullPage: false,
    });

    await page.goto('/content');
    await expect(page.locator('.content-bento')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.content-coming-soon-strip')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.content-calendar__cell--today')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-content.png'),
      fullPage: false,
    });

    await page.goto('/customers');
    await expect(page.locator('.customers-bento')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Amina K.')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-customers.png'),
      fullPage: false,
    });

    await page.goto('/ai');
    await expect(page.locator('.ai-assistant-shell')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('ai-chat-studio')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-ai-assistant.png'),
      fullPage: false,
    });
  });

  test('save settings preview screenshot', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStitchShell(page);
    await installSettingsShellMocks(page);
    await seedAdminSession(page);

    await page.goto('/settings?category=profile');
    await expect(page).toHaveURL(/category=profile/, { timeout: 20_000 });
    await expect(page.locator('.settings-wa')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-settings.png'),
      fullPage: false,
    });
  });
});
