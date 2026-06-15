import type { Page } from '@playwright/test';

export async function installAiLearningCacheMocks(
  page: Page,
  options?: { permissions?: string[] },
): Promise<void> {
  const permissions = options?.permissions ?? [
    'ai.cost.view',
    'ai.learning.view',
    'ai.learning.manage',
  ];

  await page.route('**/api/ai/cost/permissions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ permissions }),
    });
  });

  await page.route('**/api/admin/ai-learning/cache-stats**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        activeCount: 12,
        totalUsage: 340,
        topIntents: [
          { intent: 'greeting', count: 8, usage: 210 },
          { intent: 'location_question', count: 2, usage: 45 },
        ],
      }),
    });
  });

  await page.route('**/api/admin/ai-learning/learned-intents**', async route => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET' && !url.includes('export')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'li-1',
              phrase: 'mambo',
              normalizedPhrase: 'mambo',
              intent: 'greeting',
              suggestedReply: 'Mambo vipi Boss 😊',
              status: 'active',
              usageCount: 42,
              confidence: 95,
            },
          ],
        }),
      });
      return;
    }

    if (method === 'POST' && url.endsWith('/merge')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, item: { id: 'li-1', usageCount: 50 } }),
      });
      return;
    }

    if (method === 'POST' && url.includes('/import-csv')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, imported: 2, skipped: 0 }),
      });
      return;
    }

    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, item: { id: 'li-new', phrase: 'habari' } }),
      });
      return;
    }

    await route.continue();
  });

  await page.route('**/api/admin/ai-learning/learned-intents-export.csv', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'phrase,intent,suggested_reply,reply_variations,status,usage_count\nmambo,greeting,Hi,,active,42\n',
    });
  });

  await page.route('**/api/admin/ai-learning/unknown-messages**', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'unk-1',
            rawText: 'Bei ya kioo cha iPhone 11?',
            normalizedText: 'bei ya kioo cha iphone 11',
            status: 'pending_review',
            frequencyCount: 3,
            confidence: 55,
            detectedIntent: 'price_question',
            aiSuggestedReply: 'Bei inategemea model Boss.',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'unk-2',
            rawText: 'nanoae bora?',
            status: 'pending_review',
            frequencyCount: 2,
            confidence: 48,
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  await page.route('**/api/ai-training/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pendingQuestions: 2,
        highPriority: 1,
        approvedToday: 3,
        appliedKnowledge: 10,
        needsReindex: false,
        aiSuggestions: 1,
        urgentCount: 0,
      }),
    });
  });

  await page.route('**/api/ai-training/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enableLearningDetection: true }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/settings/ai', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: 'ANTHROPIC',
          model: 'claude-haiku-4-5-20251001',
          temperature: 0.3,
          enabled: true,
          autoReplyContextMessages: 3,
          autoReplyContextMessagesMax: 5,
          includeCrmWhenNeeded: true,
          includeKnowledgeWhenNeeded: true,
          includeCatalogWhenNeeded: true,
          includeMemoryWhenNeeded: true,
          messageBufferEnabled: true,
          messageBufferDebounceSeconds: 10,
          learnedReplyCacheEnabled: true,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/admin/ai-learning/reply-templates**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'tpl-greeting-1',
              name: 'Greeting - Variation 1',
              category: 'greeting',
              message: 'Poa sana 😊 Karibu Inauzwa, nikusaidie nini leo?',
              usageCount: 142,
              ratingPercent: 95,
              isFavorite: true,
              language: 'mixed',
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/admin/ai-learning/analytics**', async route => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        kpis: [
          { label: 'Cache Hit Rate', value: '72.0%', change: '+5.0%', changePositive: true },
          { label: 'AI Calls Saved', value: '12', change: '+3', changePositive: true },
        ],
        cacheHitSeries: [
          { date: 'Jun 10', rate: 68 },
          { date: 'Jun 11', rate: 72 },
        ],
        intentsByStatus: [
          { status: 'Active', count: 10 },
          { status: 'Pending', count: 2 },
        ],
        costSavedSeries: [
          { date: 'Jun 10', amount: 0.8 },
          { date: 'Jun 11', amount: 1.2 },
        ],
        topIntentsByUsage: [{ intent: 'greeting', usage: 42 }],
        unknownTrend: [
          { date: 'Jun 10', count: 1 },
          { date: 'Jun 11', count: 2 },
        ],
        topSavingPhrases: [{ phrase: 'mambo', savedCalls: 42 }],
        repeatedUnknown: [],
        lowConfidenceIntents: [],
      }),
    });
  });
}
