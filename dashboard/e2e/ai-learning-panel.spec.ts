import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installDashboardMocks } from './helpers/dashboard-mocks';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { mockAiLearningApis } from './helpers/ai-learning-mocks';

test.describe('AI Learning & Product Demand panel', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page);
    await installSettingsShellMocks(page);
    await mockAiLearningApis(page);
    await seedAdminSession(page);
  });

  test('renders learning panel with pending question from mocked inbox flow', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Pending Questions' }).click();

    await expect(page.getByText('Bei ya iPhone 14 ni ngapi?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review' })).toBeVisible();
  });

  test('overview KPI shows pending learning count', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });

    const kpiRow = page.locator('.ail-kpi').filter({ hasText: 'Pending AI Learning' });
    await expect(kpiRow.locator('.ail-kpi__value')).toHaveText('2');
  });

  test('product requests tab lists catalog requests', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Product Requests' }).click();
    const row = page.locator('tr', { hasText: 'Samsung A55' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('4');
    await expect(row).toContainText('Open');
  });

  test('map missing modal shows recent customer chats', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Missing Products' }).click();
    await expect(page.getByText('Redmi Note 13')).toBeVisible();
    await page.locator('tr', { hasText: 'Redmi Note 13' }).getByRole('button', { name: 'Map' }).click();
    await expect(page.locator('.ail-modal')).toBeVisible();
    await expect(page.getByText('Customers who asked')).toBeVisible();
    await expect(page.locator('.ail-modal select option')).toContainText(['255700000000']);
    await expect(page.getByRole('button', { name: 'Browse catalog & send' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Map & send to chat' })).toBeVisible();
  });

  test('product request details modal marks request complete', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('tab', { name: 'Product Requests' }).click();
    await page.getByRole('button', { name: 'Details' }).click();
    await expect(page.getByRole('heading', { name: 'Product catalog request' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByRole('heading', { name: 'Product catalog request' })).not.toBeVisible();
  });

  test('settings tab shows training inbox match threshold summary', async ({ page }) => {
    await page.goto('/settings?category=ai&panel=ai-learning');
    await expect(page.locator('.ail-panel')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Settings' }).click();
    await expect(page.getByText(/Training inbox match threshold:\s*70%/i)).toBeVisible();
  });
});
