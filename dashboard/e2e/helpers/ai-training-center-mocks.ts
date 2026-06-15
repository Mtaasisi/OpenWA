import type { Page } from '@playwright/test';

const WS_TRAINING_ITEM = {
  id: 'train-ws-1',
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
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Minimal ai-training API stubs for inbox → Training Center journey (train-ws-1). */
export async function stubTrainingWsItemMocks(page: Page): Promise<void> {
  await page.route('**/api/ai-training/**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes('/overview')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingQuestions: 1,
          highPriority: 0,
          approvedToday: 0,
          appliedKnowledge: 0,
          needsReindex: false,
          aiSuggestions: 1,
          urgentCount: 0,
        }),
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
        }),
      });
      return;
    }

    if (url.includes('/items/train-ws-1') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...WS_TRAINING_ITEM,
          trainingQuestion: 'Customer asked where the store is located.',
          suggestions: [
            {
              id: 'sugg-ws-1',
              trainingItemId: 'train-ws-1',
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

    if (url.includes('/items') && !url.match(/\/items\//)) {
      const status = new URL(url).searchParams.get('status');
      const body = status === 'pending_review' ? [WS_TRAINING_ITEM] : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
      return;
    }

    if (url.includes('/preview-approval') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          targetFile: 'FAQ.md',
          updateMode: 'append',
          oldContentPreview: '# FAQ\n',
          newContentPreview: '# FAQ\n\nTupo Dar es Salaam Boss.',
          warnings: [],
          requiresAdmin: false,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
