import { test, expect } from '@playwright/test';
import { seedAdminSession } from './helpers/auth';
import {
  installInboxConsentMocks,
  INBOX_CONSENT_CHAT_ID,
  INBOX_CONSENT_SESSION_ID,
} from './helpers/inbox-consent-mocks';

test.describe('Inbox — WhatsApp consent strip', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await seedAdminSession(page);
  });

  test('shows opted-out warning in CRM panel', async ({ page }) => {
    await installInboxConsentMocks(page, {
      consentLookup: {
        optInStatus: 'opted_out',
        canMarketing: false,
        canFollowup: false,
        within24h: false,
        requiresTemplate: true,
        lastCustomerMessageAt: null,
      },
    });
    await page.goto(
      `/inbox?session=${INBOX_CONSENT_SESSION_ID}&chat=${encodeURIComponent(INBOX_CONSENT_CHAT_ID)}`,
    );
    const strip = page.locator('.inbox-wa-consent-strip');
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip).toHaveClass(/inbox-wa-consent-strip--danger/);
    await expect(strip.getByText('Customer opted out')).toBeVisible();
    await expect(strip.getByRole('link', { name: 'Safety settings' })).toBeVisible();
  });

  test('shows no-marketing warning when opted in without marketing consent', async ({ page }) => {
    await installInboxConsentMocks(page, {
      consentLookup: {
        optInStatus: 'opted_in',
        canMarketing: false,
        canFollowup: true,
        within24h: true,
        requiresTemplate: false,
        lastCustomerMessageAt: new Date().toISOString(),
      },
    });
    await page.goto(
      `/inbox?session=${INBOX_CONSENT_SESSION_ID}&chat=${encodeURIComponent(INBOX_CONSENT_CHAT_ID)}`,
    );
    const strip = page.locator('.inbox-wa-consent-strip');
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip).toHaveClass(/inbox-wa-consent-strip--warning/);
    await expect(strip.getByText('No marketing consent')).toBeVisible();
  });

  test('shows outside-24h info when template is required', async ({ page }) => {
    await installInboxConsentMocks(page, {
      consentLookup: {
        optInStatus: 'opted_in',
        canMarketing: true,
        canFollowup: true,
        within24h: false,
        requiresTemplate: true,
        lastCustomerMessageAt: null,
      },
    });
    await page.goto(
      `/inbox?session=${INBOX_CONSENT_SESSION_ID}&chat=${encodeURIComponent(INBOX_CONSENT_CHAT_ID)}`,
    );
    const strip = page.locator('.inbox-wa-consent-strip');
    await expect(strip).toBeVisible({ timeout: 20_000 });
    await expect(strip).toHaveClass(/inbox-wa-consent-strip--info/);
    await expect(strip.getByText('Outside 24h window')).toBeVisible();
  });

  test('hides strip when consent and service window are clear', async ({ page }) => {
    await installInboxConsentMocks(page, {
      consentLookup: {
        optInStatus: 'opted_in',
        canMarketing: true,
        canFollowup: true,
        within24h: true,
        requiresTemplate: false,
        lastCustomerMessageAt: new Date().toISOString(),
      },
    });
    await page.goto(
      `/inbox?session=${INBOX_CONSENT_SESSION_ID}&chat=${encodeURIComponent(INBOX_CONSENT_CHAT_ID)}`,
    );
    await expect(page.locator('.inbox-crm-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.inbox-wa-consent-strip')).toHaveCount(0);
  });
});
