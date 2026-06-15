import { test, expect, type Page } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import { installSettingsShellMocks } from './helpers/settings-shell-mocks';
import { installWhatsAppSafetyMocks } from './helpers/whatsapp-safety-mocks';
import { installAiSettingsMocks } from './helpers/ai-settings-mocks';
import {
  installSettingsAskAiMocks,
  SETTINGS_ASK_AI_PANEL_ROUTES,
  SETTINGS_ASK_AI_PROMPT_FIXTURES,
  SETTINGS_ASK_AI_SHELL_PANELS,
} from './helpers/settings-ask-ai-mocks';

async function expectAskAiHref(page: Page, panelId: keyof typeof SETTINGS_ASK_AI_PROMPT_FIXTURES): Promise<void> {
  const askAi = page.getByTestId('settings-ask-ai');
  await expect(askAi).toBeVisible({ timeout: 20_000 });
  await expect(askAi).toHaveAttribute(
    'href',
    `/ai?prompt=${encodeURIComponent(SETTINGS_ASK_AI_PROMPT_FIXTURES[panelId])}`,
  );
}

test.describe('Settings — Ask AI operator button', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsShellMocks(page);
    await installSettingsAskAiMocks(page);
    await seedAdminSession(page);
  });

  for (const panelId of SETTINGS_ASK_AI_SHELL_PANELS) {
    test(`${panelId} panel links to AI with operator prompt`, async ({ page }) => {
      await page.goto(SETTINGS_ASK_AI_PANEL_ROUTES[panelId]);
      await expectAskAiHref(page, panelId);
    });
  }

  test('WhatsApp Safety panel links to AI with safety prompt', async ({ page }) => {
    await installWhatsAppSafetyMocks(page);
    await page.goto(SETTINGS_ASK_AI_PANEL_ROUTES['whatsapp-safety']);
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 20_000 });
    await expectAskAiHref(page, 'whatsapp-safety');
  });

  test('AI Knowledge panel links to AI with reindex prompt', async ({ page }) => {
    await installAiSettingsMocks(page);
    await page.goto(SETTINGS_ASK_AI_PANEL_ROUTES['ai-knowledge']);
    await expect(page.getByRole('button', { name: /Reindex/i })).toBeVisible({ timeout: 20_000 });
    await expectAskAiHref(page, 'ai-knowledge');
  });

  test('Automations autopilot tab links to AI with autopilot prompt', async ({ page }) => {
    await page.route('**/api/sessions**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'sess-1', name: 'Main WA', status: 'ready' }]),
      });
    });

    await page.goto(SETTINGS_ASK_AI_PANEL_ROUTES['followup-autopilot']);
    await expect(page.getByRole('heading', { name: 'Follow-up autopilot' })).toBeVisible({
      timeout: 20_000,
    });
    await expectAskAiHref(page, 'followup-autopilot');
  });

  test('clicking Ask AI navigates to AI chat with prefilled prompt', async ({ page }) => {
    await installWhatsAppSafetyMocks(page);
    await page.goto(SETTINGS_ASK_AI_PANEL_ROUTES['whatsapp-safety']);
    await expect(page.getByTestId('settings-ask-ai')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('settings-ask-ai').click();
    await expect(page).toHaveURL(/\/ai\?prompt=/);
    await expect(page.url()).toContain(encodeURIComponent(SETTINGS_ASK_AI_PROMPT_FIXTURES['whatsapp-safety']));
  });
});
