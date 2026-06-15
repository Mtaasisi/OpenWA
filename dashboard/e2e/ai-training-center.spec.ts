import { test, expect } from '@playwright/test';
import { seedAdminSession, seedOperatorSession } from './helpers/auth';
import { mockAiLearningApis } from './helpers/ai-learning-mocks';
import { installDashboardMocks } from './helpers/dashboard-mocks';

const AUDIT_ROWS = [
  {
    id: 'audit-1',
    trainingItemId: 'train-1',
    action: 'created',
    actorType: 'ai',
    actorId: null,
    summary: 'Training item created: customer_service_request',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'audit-2',
    trainingItemId: 'train-1',
    action: 'applied',
    actorType: 'admin',
    actorId: 'admin-key',
    summary: 'Applied training to AI_REPLY_RULES.md',
    details: { backupPath: 'backups/AI_REPLY_RULES.md.bak' },
    createdAt: new Date().toISOString(),
  },
];

const PENDING_ITEMS = [
  {
    id: 'train-1',
    question: 'Naomba namba ya customer care',
    normalizedQuestion: 'naomba namba ya customer care',
    status: 'pending_review',
    priority: 'high',
    timesAsked: 2,
    source: 'auto_unknown',
    sourceType: 'inbox_message',
    issueType: 'customer_service_request',
    targetFile: 'AI_REPLY_RULES.md',
    aiDraftAnswer: 'Piga 0800 123 456 kwa msaada.',
    confidenceScore: 0.3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'train-2',
    question: 'Mko wapi?',
    normalizedQuestion: 'mko wapi',
    status: 'pending_review',
    priority: 'normal',
    timesAsked: 1,
    source: 'auto_unknown',
    sourceType: 'inbox_message',
    issueType: 'no_answer',
    targetFile: 'FAQ.md',
    aiDraftAnswer: 'Tupo Dar.',
    confidenceScore: 0.4,
    chatId: '255798765432@c.us',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'train-group-1',
    question: 'Bei ya simu ni ngapi?',
    normalizedQuestion: 'bei ya simu ni ngapi',
    status: 'pending_review',
    priority: 'normal',
    timesAsked: 1,
    source: 'auto_unknown',
    sourceType: 'group_conversation',
    issueType: 'no_answer',
    targetFile: 'FAQ.md',
    aiDraftAnswer: 'Tupo Dar.',
    confidenceScore: 0.4,
    chatId: '120363123456789012@g.us',
    metadata: { isGroupChat: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const APPLIED_ITEMS = [
  {
    id: 'train-applied-1',
    question: 'Mko wapi?',
    normalizedQuestion: 'mko wapi',
    status: 'applied',
    priority: 'normal',
    timesAsked: 2,
    source: 'auto_unknown',
    sourceType: 'inbox_message',
    issueType: 'no_answer',
    targetFile: 'FAQ.md',
    adminFinalAnswer: 'Tupo Dar es Salaam Boss.',
    sessionId: 'sess-inbox-ready',
    chatId: '255798765432@c.us',
    appliedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

async function stubAiChatBasics(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/settings/ai', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        enabled: true,
        apiKeySet: true,
        provider: 'OPENAI',
        model: 'gpt-4o',
        toolCallingEnabled: true,
      }),
    });
  });

  await page.route('**/api/ai/conversations**', async route => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

async function stubTrainingApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/ai-training/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/overview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingQuestions: 3,
          highPriority: 1,
          approvedToday: 2,
          appliedKnowledge: 5,
          needsReindex: true,
          aiSuggestions: 2,
          urgentCount: 0,
        }),
      });
      return;
    }

    if (url.includes('/audit')) {
      const itemId = new URL(url).searchParams.get('trainingItemId');
      const rows = itemId ? AUDIT_ROWS.filter(r => r.trainingItemId === itemId) : AUDIT_ROWS;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
      return;
    }

    if (url.includes('/items') && !url.match(/\/items\//)) {
      const status = new URL(url).searchParams.get('status');
      const body =
        status === 'applied'
          ? APPLIED_ITEMS
          : status === 'pending_review'
            ? PENDING_ITEMS
            : [...PENDING_ITEMS, ...APPLIED_ITEMS];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
      return;
    }

    if (url.includes('/settings') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requireAdminApproval: true,
          trainingCenterEnabled: true,
          trainingKnowledgeMatchThreshold: 0.65,
          trainingGroupChatsMode: 'separate',
        }),
      });
      return;
    }

    if (url.includes('/settings') && method === 'PATCH') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requireAdminApproval: true,
          trainingCenterEnabled: true,
          trainingKnowledgeMatchThreshold: body.trainingKnowledgeMatchThreshold ?? 0.65,
        }),
      });
      return;
    }

    if (url.includes('/items/train-1') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'train-1',
          question: 'Naomba namba ya customer care',
          trainingQuestion: 'Customer asked for customer care number. What should AI do next time?',
          status: 'pending_review',
          suggestions: [
            {
              id: 'sugg-a',
              trainingItemId: 'train-1',
              optionLabel: 'A',
              optionText: 'Ask which branch',
              responseText: 'Upo branch gani nikutumie namba sahihi?',
              actionType: 'update_rule',
              targetFile: 'AI_REPLY_RULES.md',
              confidence: 0.85,
              isRecommended: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/items/train-2') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'train-2',
          question: 'Mko wapi?',
          trainingQuestion: 'Customer asked where the store is located.',
          status: 'pending_review',
          targetFile: 'FAQ.md',
          aiDraftAnswer: 'Tupo Dar.',
          suggestions: [
            {
              id: 'sugg-b',
              trainingItemId: 'train-2',
              optionLabel: 'A',
              optionText: 'Share Dar location',
              responseText: 'Tupo Dar es Salaam Boss.',
              actionType: 'update_faq',
              targetFile: 'FAQ.md',
              confidence: 0.9,
              isRecommended: true,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/items/train-applied-1') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'train-applied-1',
          question: 'Mko wapi?',
          trainingQuestion: 'Customer asked where the store is located.',
          status: 'applied',
          targetFile: 'FAQ.md',
          adminFinalAnswer: 'Tupo Dar es Salaam Boss.',
          aiDraftAnswer: 'Tupo Dar.',
          suggestions: [],
        }),
      });
      return;
    }

    if (url.includes('/preview-approval') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          targetFile: 'AI_REPLY_RULES.md',
          targetSection: null,
          updateMode: 'append',
          oldContentPreview: '# Rules\n',
          newContentPreview: '# Rules\n\n## Learned Rule\nUpo branch gani?',
          warnings: ['High-risk rule — admin approval required to apply.'],
          requiresAdmin: true,
        }),
      });
      return;
    }

    if (url.includes('/approve') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: { id: 'train-1', status: 'applied' },
          approval: { id: 'ap-1', fileBackupPath: 'backups/AI_REPLY_RULES.md.bak' },
        }),
      });
      return;
    }

    if (url.includes('/bulk-approve') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          approved: ['train-2'],
          skipped: [{ id: 'train-1', reason: 'High-risk item requires admin approval' }],
          failed: [],
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

test.describe('AI Training Center', () => {
  test.beforeEach(async ({ page }) => {
    await installDashboardMocks(page);
    await mockAiLearningApis(page);
    await stubTrainingApis(page);
    await stubAiChatBasics(page);
    await seedAdminSession(page);
  });

  test('Training tab renders center with pending items', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('AI Training Center')).toBeVisible();
    await expect(page.getByText('Naomba namba ya customer care')).toBeVisible();
  });

  test('review panel auto-selects recommended option and loads preview', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible();
    await expect(page.getByLabel(/Ask which branch/i)).toBeChecked();
    await expect(page.getByTestId('ai-training-preview')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ai-training-audit-timeline')).toBeVisible();
    await expect(page.getByText('Training item created')).toBeVisible();
  });

  test('assistant tab bar includes Training', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-assistant-tab-training')).toBeVisible();
    await expect(page.getByTestId('ai-assistant-tab-chat')).toBeVisible();
  });

  test('shows admin-only badge and bulk bar actions', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-admin-badge')).toBeVisible();
    await expect(page.getByTestId('ai-training-bulk-bar')).toBeVisible();
    await page
      .locator('.aitc-card')
      .filter({ hasText: 'Mko wapi?' })
      .locator('.aitc-card__check input')
      .check();
    await expect(page.getByTestId('ai-training-bulk-approve')).toBeVisible();
  });

  test('review panel approve and apply closes review', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible();
    await expect(page.getByLabel(/Ask which branch/i)).toBeChecked({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Approve & apply' }).click();
    await expect(page.getByTestId('ai-training-review-panel')).toHaveCount(0, { timeout: 10_000 });
  });

  test('approve and apply shows reindex pending info toast', async ({ page }) => {
    await page.route('**/api/ai-training/items/train-1/approve', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          item: { id: 'train-1', status: 'applied' },
          approval: { id: 'ap-1', fileBackupPath: 'backups/AI_REPLY_RULES.md.bak', reindexStatus: 'pending' },
        }),
      });
    });

    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Review' }).first().click();
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible();
    await page.getByRole('button', { name: 'Approve & apply' }).click();
    await expect(page.getByText(/Knowledge index update is pending/i)).toBeVisible({ timeout: 10_000 });
  });

  test('bulk approve modal sends draft overrides to API', async ({ page }) => {
    let postedBody: { overrides?: Array<{ id: string; customAnswer: string }> } | null = null;
    await page.route('**/api/ai-training/items/bulk-approve', async route => {
      postedBody = route.request().postDataJSON() as typeof postedBody;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ approved: ['train-2'], skipped: [], failed: [] }),
      });
    });

    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page
      .locator('.aitc-card')
      .filter({ hasText: 'Mko wapi?' })
      .locator('.aitc-card__check input')
      .check();
    await page.getByTestId('ai-training-bulk-approve').click();
    await expect(page.getByTestId('ai-training-bulk-modal')).toBeVisible();
    await expect(page.getByTestId('ai-training-bulk-draft-note')).toBeVisible();
    await expect(page.getByTestId('ai-training-bulk-row').locator('textarea')).toHaveValue('Tupo Dar.');
    await page.getByTestId('ai-training-bulk-confirm').click();
    await expect.poll(() => postedBody?.overrides?.[0]?.customAnswer).toBe('Tupo Dar.');
  });

  test('bulk approve shows skip notes for items the server skipped', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.locator('.aitc-card__check input').nth(0).check();
    await page
      .locator('.aitc-card')
      .filter({ hasText: 'Mko wapi?' })
      .locator('.aitc-card__check input')
      .check();
    await expect(page.getByTestId('ai-training-bulk-approve')).toHaveText(/Approve selected \(2\)/);
    await page.getByTestId('ai-training-bulk-approve').click();
    await expect(page.getByTestId('ai-training-bulk-modal')).toBeVisible();
    await page.getByTestId('ai-training-bulk-confirm').click();
    const skipNotes = page.getByTestId('ai-training-bulk-skip-notes');
    await expect(skipNotes).toBeVisible({ timeout: 10_000 });
    await expect(skipNotes.getByText(/High-risk item requires admin approval/i)).toBeVisible();
  });

  test('operator sees role hint and cannot bulk-approve admin-only items', async ({ page }) => {
    await seedOperatorSession(page);
    await mockAiLearningApis(page);
    await stubTrainingApis(page);
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/high-risk items require an admin key/i)).toBeVisible();
    await page.locator('.aitc-card__check input').first().check();
    await page
      .locator('.aitc-card')
      .filter({ hasText: 'Mko wapi?' })
      .locator('.aitc-card__check input')
      .check();
    await expect(page.getByTestId('ai-training-bulk-approve')).toHaveText(/Approve selected \(1\)/);
  });

  test('operator deep link to high-risk item shows admin gate', async ({ page }) => {
    await seedOperatorSession(page);
    await mockAiLearningApis(page);
    await stubTrainingApis(page);
    await page.goto('/ai?tab=training&item=train-1');
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ai-training-admin-required')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve & apply' })).toBeDisabled();
  });

  test('operator deep link to safe item enables approve', async ({ page }) => {
    await seedOperatorSession(page);
    await mockAiLearningApis(page);
    await stubTrainingApis(page);
    await page.goto('/ai?tab=training&item=train-2');
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ai-training-admin-required')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Approve & apply' })).toBeEnabled();
  });

  test('review all logs link filters logs tab by training item', async ({ page }) => {
    await page.goto('/ai?tab=training&item=train-1');
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('ai-training-review-all-logs').click();
    await expect(page).toHaveURL(/\/ai\?tab=logs&item=train-1/);
    await expect(page.getByTestId('ai-assistant-logs-panel')).toBeVisible();
    await expect(page.getByTestId('ai-training-logs-item-filter')).toBeVisible();
    await expect(page.getByText('Training item created')).toBeVisible();
    await expect(page.getByText('Applied training to AI_REPLY_RULES.md')).toBeVisible();
  });

  test('training settings modal saves match threshold', async ({ page }) => {
    let patchedThreshold: number | undefined;
    await page.route('**/api/ai-training/settings**', async route => {
      if (route.request().method() === 'PATCH') {
        const body = route.request().postDataJSON() as { trainingKnowledgeMatchThreshold?: number };
        patchedThreshold = body.trainingKnowledgeMatchThreshold;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            requireAdminApproval: true,
            trainingCenterEnabled: true,
            trainingKnowledgeMatchThreshold: patchedThreshold ?? 0.65,
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          requireAdminApproval: true,
          trainingCenterEnabled: true,
          trainingKnowledgeMatchThreshold: 0.65,
          trainingGroupChatsMode: 'separate',
        }),
      });
    });

    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('ai-training-settings-open').click();
    await expect(page.getByText('AI Training settings')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ai-training-settings-threshold')).toBeVisible();
    await page.getByTestId('ai-training-settings-threshold').fill('0.7');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => patchedThreshold).toBe(0.7);
  });

  test('applied tab shows active-in-inbox badge', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Applied' }).click();
    await expect(page.getByText('Mko wapi?')).toBeVisible();
    await expect(page.getByTestId('ai-training-applied-badge')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open conversation' })).toHaveAttribute(
      'href',
      /\/inbox\?session=sess-inbox-ready&chat=/,
    );
  });

  test('status bar more menu links to training center', async ({ page }) => {
    await page.route('**/api/app/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overall: 'success',
          updatedAt: new Date().toISOString(),
          workSummary: { pending: 2, efficiency: 88 },
          ai: {
            status: 'success',
            label: 'AI Safe',
            autoReply: 'on',
            provider: 'OPENAI',
            model: 'gpt-4o',
            knowledgeIndexed: true,
            pendingLearning: 0,
            lastError: null,
          },
          whatsapp: {
            status: 'success',
            label: 'Connected',
            activeSessions: 1,
            qrNeeded: 0,
            disconnected: 0,
            sessions: [{ id: 'sess-1', name: 'Main WA', connected: true, qrNeeded: false }],
          },
          queue: { status: 'neutral', pending: 0, delayed: 0, failed: 0, label: 'clear' },
          database: {
            status: 'success',
            label: 'Online',
            latencyMs: 12,
            lastPingAt: new Date().toISOString(),
          },
          sync: {
            status: 'success',
            label: 'Synced',
            unsynced: 0,
            failed: 0,
            lastSyncAt: new Date().toISOString(),
          },
          branch: { id: 'dar', name: 'Dar', status: 'success', paymentProfileConfigured: true },
          user: { id: 'admin-key', name: 'Admin', role: 'admin' },
          warnings: [],
        }),
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        'openwa_status_bar_prefs',
        JSON.stringify({ compactMode: 'always', showWorkSummary: true, showBranch: true, showStatusBar: true }),
      );
    });
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^More$/i }).click();
    await expect(page.getByRole('dialog', { name: /More status/i })).toBeVisible();
    await expect(page.getByText('AI Training pending')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('link', { name: 'Open Training Center' }).click();
    await expect(page).toHaveURL(/\/ai\?tab=training/);
  });

  test('deep link opens review panel for pending item', async ({ page }) => {
    await page.goto('/ai?tab=training&item=train-2');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Customer asked where the store is located.')).toBeVisible();
    await expect(page.locator('[data-item-id="train-2"].aitc-card--focused')).toBeVisible();
    await expect(page.locator('.aitc-sidebar__btn--active')).toHaveText('Pending');
  });

  test('deep link switches to applied tab and opens review', async ({ page }) => {
    await page.goto('/ai?tab=training&item=train-applied-1');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.aitc-sidebar__btn--active')).toHaveText('Applied');
    await expect(page.locator('[data-item-id="train-applied-1"]')).toBeVisible();
    await expect(page.getByTestId('ai-training-applied-badge')).toBeVisible();
  });

  test('closing deep-linked review clears item query param', async ({ page }) => {
    await page.goto('/ai?tab=training&item=train-2');
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('ai-training-review-close').click();
    await expect(page.getByTestId('ai-training-review-panel')).toHaveCount(0);
    await expect(page).toHaveURL(/\/ai\?tab=training(?:$|&)/);
    await expect(page).not.toHaveURL(/[?&]item=/);
    await expect(page.getByTestId('ai-training-review-panel')).toHaveCount(0, { timeout: 3_000 });
  });

  test('opening review from list syncs item query param', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await page
      .locator('[data-item-id="train-2"]')
      .getByRole('button', { name: 'Review' })
      .click();
    await expect(page).toHaveURL(/[?&]item=train-2/);
    await expect(page.getByTestId('ai-training-review-panel')).toBeVisible();
  });

  test('invalid deep link item shows error and clears query param', async ({ page }) => {
    await page.route('**/api/ai-training/items/missing-item**', async route => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Training item not found' }),
      });
    });

    await page.goto('/ai?tab=training&item=missing-item');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Training item not found/i)).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/item=missing-item/);
    await expect(page.getByTestId('ai-training-review-panel')).toHaveCount(0);
  });

  test('logs tab lists filtered training audit entries', async ({ page }) => {
    await page.goto('/ai?tab=logs');
    await expect(page.getByTestId('ai-assistant-logs-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-audit-timeline')).toBeVisible();
    await expect(page.getByText('Applied training to AI_REPLY_RULES.md')).toBeVisible();
    await page.getByRole('button', { name: 'applied' }).click();
    await expect(page.getByText('Applied training to AI_REPLY_RULES.md')).toBeVisible();
    await expect(page.getByText('Training item created')).toHaveCount(0);
  });

  test('separate mode shows direct vs group training filters', async ({ page }) => {
    await page.goto('/ai?tab=training');
    await expect(page.getByTestId('ai-training-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('ai-training-chat-kind-filter')).toBeVisible();
    await expect(page.getByText('Mko wapi?')).toBeVisible();
    await expect(page.getByText('Bei ya simu ni ngapi?')).toHaveCount(0);
    await page.getByTestId('ai-training-chat-kind-group').click();
    await expect(page.getByText('Bei ya simu ni ngapi?')).toBeVisible();
    await expect(page.getByText('Mko wapi?')).toHaveCount(0);
    await expect(page.getByText('Group').first()).toBeVisible();
  });
});
