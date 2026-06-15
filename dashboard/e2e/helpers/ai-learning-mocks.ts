import type { Page } from '@playwright/test';

export async function mockAiLearningApis(page: Page): Promise<void> {
  await page.route('**/api/sessions**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'sess-1', name: 'Main WA', status: 'ready', phone: '255700000000' },
      ]),
    });
  });

  await page.route('**/api/ai-learning/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pendingLearning: 2,
        unknownQuestionsToday: 1,
        mostAskedProduct: 'iPhone 14',
        outOfStockDemand: 3,
        installmentDemand: 1,
        aiPausedChats: 0,
      }),
    });
  });

  await page.route('**/api/ai-learning/items**', async route => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get('status');
    const rows =
      status === 'pending_review'
        ? [
            {
              id: 'pending-1',
              question: 'Bei ya iPhone 14 ni ngapi?',
              detectedIntent: 'price_request',
              confidenceScore: 0.28,
              timesAsked: 1,
              priority: 'high',
              createdAt: new Date().toISOString(),
              status: 'pending_review',
            },
          ]
        : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rows),
    });
  });

  await page.route('**/api/ai-learning/settings', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enableLearningDetection: true,
          trackCustomerOutcome: true,
          highConfidenceThreshold: 0.8,
          mediumConfidenceThreshold: 0.5,
          defaultUnknownReply: 'Nipe muda kidogo Boss…',
          trainingCenterEnabled: true,
          trainingKnowledgeMatchThreshold: 0.7,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route('**/api/ai-learning/history', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/ai-learning/knowledge**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/ai-learning/imports**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/ai/learning/imports**', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/product-demand/product-requests**', async route => {
    const url = route.request().url();
    const method = route.request().method();

    if (method === 'PATCH' && url.includes('/product-requests/req-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'req-1',
          productName: 'Samsung A55',
          category: 'Phones',
          brand: 'Samsung',
          customerCount: 4,
          priority: 'high',
          status: 'done',
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }

    if (url.includes('/product-requests/req-1') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'req-1',
          productName: 'Samsung A55',
          category: 'Phones',
          brand: 'Samsung',
          customerCount: 4,
          priority: 'high',
          status: 'open',
          createdAt: new Date().toISOString(),
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'req-1',
          productName: 'Samsung A55',
          category: 'Phones',
          brand: 'Samsung',
          customerCount: 4,
          priority: 'high',
          status: 'open',
          createdAt: new Date().toISOString(),
        },
      ]),
    });
  });

  await page.route('**/api/product-demand/missing**', async route => {
    const url = route.request().url();
    if (url.match(/\/missing\/[^/?]+$/)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          missing: {
            id: 'miss-1',
            rawProductName: 'Redmi Note 13',
            timesAsked: 3,
            uniqueCustomers: 2,
            status: 'unmatched',
            exampleMessages: ['Bei ya Redmi Note 13?'],
          },
          recentChats: [
            {
              sessionId: 'sess-1',
              chatId: '255700000000@c.us',
              customerId: 'cust-1',
              lastMessage: 'Bei ya Redmi Note 13?',
              lastAskedAt: new Date().toISOString(),
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'miss-1',
          rawProductName: 'Redmi Note 13',
          timesAsked: 3,
          uniqueCustomers: 2,
          status: 'unmatched',
        },
      ]),
    });
  });

  await page.route('**/api/product-demand/overview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalProducts: 0, missingCount: 0, risingTrends: 0 }),
    });
  });

  await page.route('**/api/dashboard/ai-learning-demand-alerts', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ topPending: [], demandSpikes: [], knowledgeNeedsReview: [] }),
    });
  });
}
