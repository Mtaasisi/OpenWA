import type { Page } from '@playwright/test';

export const E2E_USER = {
  id: 'e2e-admin',
  email: 'admin@openwa.test',
  name: 'E2E Admin',
  role: 'admin',
  staffId: 'staff-e2e',
  isActive: true,
};

export const E2E_OPERATOR_USER = {
  id: 'e2e-operator',
  email: 'operator@openwa.test',
  name: 'E2E Operator',
  role: 'operator',
  staffId: 'staff-e2e-op',
  isActive: true,
};

export const E2E_ACCESS_TOKEN = 'e2e-test-token';
export const E2E_REFRESH_TOKEN = 'e2e-refresh-token';

/** Mock auth endpoints so Playwright does not proxy to an offline backend (2785). */
export async function mockAuthRoutes(page: Page): Promise<void> {
  await page.route('**/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_USER),
    });
  });

  await page.route('**/api/auth/refresh', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: E2E_ACCESS_TOKEN,
        refreshToken: E2E_REFRESH_TOKEN,
        user: E2E_USER,
      }),
    });
  });
}

async function seedSession(
  page: Page,
  user: typeof E2E_USER,
  language: 'en' | 'he' | 'sw' = 'en',
): Promise<void> {
  await page.addInitScript(
    ({ user, lang, accessToken, refreshToken }) => {
      if (!localStorage.getItem('openwa_language')) {
        localStorage.setItem('openwa_language', lang);
        localStorage.setItem('i18nextLng', lang);
      }
      sessionStorage.setItem('openwa_access_token', accessToken);
      sessionStorage.setItem('openwa_refresh_token', refreshToken);
      sessionStorage.setItem('openwa_user', JSON.stringify(user));
      localStorage.setItem('openwa_user_role', user.role);
    },
    {
      user,
      lang: language,
      accessToken: E2E_ACCESS_TOKEN,
      refreshToken: E2E_REFRESH_TOKEN,
    },
  );

  await page.route('**/api/auth/me', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.route('**/api/auth/refresh', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: E2E_ACCESS_TOKEN,
        refreshToken: E2E_REFRESH_TOKEN,
        user,
      }),
    });
  });
}

export async function seedAdminSession(page: Page, language: 'en' | 'he' | 'sw' = 'en'): Promise<void> {
  await seedSession(page, E2E_USER, language);
}

export async function seedOperatorSession(page: Page, language: 'en' | 'he' | 'sw' = 'en'): Promise<void> {
  await seedSession(page, E2E_OPERATOR_USER, language);
}
