import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedAdminSession } from './helpers/auth';
import { installInboxApiStubs } from './helpers/inbox-api-mocks';
import {
  buildInboxConversation,
  buildReadyInboxSession,
  E2E_INBOX_CHAT_ID,
  E2E_INBOX_READY_SESSION_ID,
  installInboxAfterConnectMocks,
} from './helpers/inbox-after-connect-mocks';
import { buildInboxTestMessage } from './helpers/inbox-context-menu-mocks';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/stitch');

async function seedStitchInboxPrefs(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('openwa_active_theme_id', 'digital-reconstruction');
    localStorage.setItem('openwa_theme', 'light');
    localStorage.setItem(
      'openwa_user_preferences',
      JSON.stringify({
        inboxConversationFilter: 'all',
        inboxDefaultView: 'one',
        inboxMyStaffId: null,
        inboxChatTypeFilter: 'all',
        inboxListWidthPx: 288,
        inboxCrmWidthPx: 380,
        inboxShowCustomerPanel: true,
        inboxShowChatList: true,
      }),
    );
    localStorage.setItem(
      'openwa_status_bar_prefs',
      JSON.stringify({
        showStatusBar: true,
        refreshInterval: 60000,
        showWorkSummary: true,
        showBranch: true,
        compactMode: 'auto',
        showAdvancedHealth: false,
        version: 2,
      }),
    );
  });
}

async function installStitchInboxMocks(page: import('@playwright/test').Page) {
  const ready = buildReadyInboxSession();
  const alice = buildInboxConversation(ready.id, 'Stephany M.');
  const daniel = buildInboxConversation(ready.id, 'Daniel K.');
  daniel.chatId = '255711111111@c.us';
  daniel.lastDirection = 'outgoing';
  daniel.hasUnread = false;
  daniel.unreadCount = 0;
  daniel.lastPreview = 'Thanks for checking in';

  const elena = buildInboxConversation(ready.id, 'Elena T.');
  elena.chatId = '255722222222@c.us';
  elena.lastPreview = 'Still waiting on your reply';

  await installInboxAfterConnectMocks(page, {
    sessions: [ready],
    conversations: [alice, daniel, elena],
  });
  await installInboxApiStubs(page);

  await page.route(`**/api/sessions/${ready.id}/messages**`, async route => {
    const incoming = buildInboxTestMessage();
    const outgoing = {
      ...incoming,
      id: 'msg-out-1',
      waMessageId: 'wa-msg-out-1',
      direction: 'outgoing' as const,
      body: "Hello, Stephany! You'll be in a private recovery room near the nurses' station.",
      status: 'read',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [incoming, outgoing], total: 2 }),
    });
  });

  await page.route('**/api/inbox/threads/crm**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        sessionId: ready.id,
        chatId: E2E_INBOX_CHAT_ID,
        resolved: false,
        internalNote: null,
        customerName: 'Stephany M.',
        customerPhone: '707-723-4127',
        aiAutoReplyPaused: false,
      }),
    });
  });

  await page.route('**/api/inbox/threads/events**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'evt-1',
          sessionId: ready.id,
          chatId: E2E_INBOX_CHAT_ID,
          eventType: 'staff_message_sent',
          actorType: 'staff',
          actorId: 'staff-1',
          actorName: 'Dr. Julianne',
          summary:
            "Hello, Stephany! You'll be in a private recovery room near the nurses' station.",
          createdAt: new Date().toISOString(),
        },
        {
          id: 'evt-2',
          sessionId: ready.id,
          chatId: E2E_INBOX_CHAT_ID,
          eventType: 'document_uploaded',
          actorType: 'staff',
          actorId: 'staff-1',
          actorName: 'Dr. Julianne',
          summary: 'pre_op_checklist.pdf',
          createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        },
        {
          id: 'evt-3',
          sessionId: ready.id,
          chatId: E2E_INBOX_CHAT_ID,
          eventType: 'message_incoming',
          actorType: 'customer',
          actorId: null,
          actorName: 'Stephany M.',
          summary:
            "Hello! Quick question — do you happen to know which room I'll be staying in after the surgery?",
          createdAt: new Date(Date.now() - 172_800_000).toISOString(),
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
          body: "Hello! You'll be in a private recovery room near the nurses' station. I can send a photo if helpful.",
          language: 'en',
          isActive: true,
          createdBy: null,
          updatedBy: null,
        },
        {
          id: 'qr-2',
          branchId: null,
          name: 'Room details',
          category: 'product_info',
          body: 'A private room with a large bed, clean setup, and window facing the city.',
          language: 'en',
          isActive: true,
          createdBy: null,
          updatedBy: null,
        },
      ]),
    });
  });
}

test.describe('Capture Stitch inbox previews', () => {
  test('save inbox UI screenshots', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStitchInboxPrefs(page);
    await installStitchInboxMocks(page);
    await seedAdminSession(page);

    await page.goto('/inbox');
    await expect(page.locator('.layout--stitch-v1')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Stephany M.')).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-inbox-list.png'),
      fullPage: false,
    });

    await page.getByRole('button', { name: /Stephany M\./ }).click();
    await expect(page.locator('.inbox-stitch-chat-header')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.inbox-messages--stitch .inbox-bubble--stitch')).toHaveCount(2, {
      timeout: 15_000,
    });
    await page.locator('.inbox-stitch-chat-header').scrollIntoViewIfNeeded();
    await page.locator('.inbox-messages--stitch').evaluate(el => {
      el.scrollTop = 0;
    });

    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-inbox-thread.png'),
      fullPage: false,
    });

    await page.locator('.inbox-stitch-crm-tabs').getByRole('tab', { name: 'Activity' }).click();
    await expect(page.locator('.inbox-stitch-activity-feed')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-activity.png'),
      fullPage: false,
    });

    await page.getByRole('button', { name: 'Manage filters' }).click();
    await expect(page.locator('.inbox-stitch-filter-menu')).toBeVisible();
    await page.screenshot({
      path: path.join(OUT_DIR, 'app-preview-filter-open.png'),
      fullPage: false,
    });

    await expect(page.locator('.wa-sidebar-stitch__nav')).toBeVisible();
    await expect(page.locator('.wa-sidebar-stitch__nav').getByRole('link', { name: 'AI Assistant' })).toBeVisible();
    await expect(page.locator('.wa-sidebar-stitch__nav').getByRole('link', { name: 'Content' })).toBeVisible();
  });
});
