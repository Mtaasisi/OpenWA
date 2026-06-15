import type { Page } from '@playwright/test';

export const TACTICAL_THEME_ID = 'tactical-overlay';

export async function seedDefaultTheme(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('openwa_active_theme_id', 'default');
    localStorage.setItem('openwa_theme', 'light');
  });
}

export async function seedTacticalTheme(page: Page): Promise<void> {
  await page.addInitScript(themeId => {
    localStorage.setItem('openwa_active_theme_id', themeId);
  }, TACTICAL_THEME_ID);
}
