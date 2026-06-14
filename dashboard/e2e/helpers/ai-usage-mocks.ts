import type { Page } from '@playwright/test';

export const AI_USAGE_SUMMARY = {
  usage: {
    todayCostUsd: 0.0421,
    monthCostUsd: 1.2345,
    last7DaysCostUsd: 0.89,
    autoReplyTodayCostUsd: 0.031,
    mostExpensiveModel: 'gpt-4o-mini',
    mostExpensiveFeature: 'whatsapp_auto_reply',
    averageCostPerReply: 0.0082,
    totalAiCalls: 42,
  },
  budget: {
    dailyTotalUsd: 0.0421,
    monthlyTotalUsd: 1.2345,
    autoReplyDailyUsd: 0.031,
    dailyBudgetUsd: 1,
    monthlyBudgetUsd: 20,
    autoReplyDailyBudgetUsd: 0.5,
    dailyUsagePercent: 4.2,
    monthlyUsagePercent: 6.2,
    autoReplyDailyPercent: 6.2,
    aiBudgetPaused: false,
    autoReplyPaused: false,
    atWarningThreshold: false,
  },
};

export const AI_USAGE_DAILY = [
  { date: '2026-06-08', costUsd: 0.12 },
  { date: '2026-06-09', costUsd: 0.08 },
  { date: '2026-06-10', costUsd: 0.15 },
];

export const AI_USAGE_BY_MODEL = [
  { model: 'gpt-4o-mini', provider: 'OPENAI', costUsd: 0.9, calls: 30 },
  { model: 'claude-haiku-4-5-20251001', provider: 'ANTHROPIC', costUsd: 0.2, calls: 8 },
];

export const AI_USAGE_BY_FEATURE = [
  { feature: 'whatsapp_auto_reply', costUsd: 0.7, calls: 25 },
  { feature: 'inbox_assistant', costUsd: 0.2, calls: 10 },
];

export const AI_USAGE_RECENT = {
  items: [
    {
      id: 'log-1',
      feature: 'whatsapp_auto_reply',
      model: 'gpt-4o-mini',
      inputTokens: 420,
      outputTokens: 88,
      actualCostUsd: 0.0021,
      status: 'success',
      createdAt: new Date().toISOString(),
    },
  ],
  total: 1,
};

export const AI_COST_CONFIG = {
  provider: 'OPENAI',
  model: 'gpt-4o-mini',
  autoReplyModelTier: 'cheap_fast',
  allowPremiumModelForAutoReply: false,
  aiDailyBudgetUsd: 1,
  aiMonthlyBudgetUsd: 20,
  autoReplyDailyBudgetUsd: 0.5,
  autoReplyContextMessages: 8,
  autoReplyContextMessagesMax: 12,
  maxCustomerToolIterations: 2,
  maxAdminToolIterations: 5,
  maxAiCallsPerInboundMessage: 2,
  ignoreDuplicateMessageIds: true,
  ignorePromotionalMessages: true,
  autoReplyCooldownSeconds: 60,
  apiKeySet: true,
  enabled: true,
};

type InstallOptions = {
  permissions?: string[];
  autoReplyPaused?: boolean;
};

export async function installAiUsageMocks(page: Page, options: InstallOptions = {}): Promise<void> {
  const permissions = options.permissions ?? ['ai.cost.view', 'ai.cost.manage'];
  const summary = structuredClone(AI_USAGE_SUMMARY);
  if (options.autoReplyPaused) {
    summary.budget.autoReplyPaused = true;
  }

  await page.route('**/api/ai/cost/permissions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ permissions }),
    });
  });

  await page.route('**/api/admin/ai-usage/summary', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });

  await page.route('**/api/admin/ai-usage/daily**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AI_USAGE_DAILY),
    });
  });

  await page.route('**/api/admin/ai-usage/by-model**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AI_USAGE_BY_MODEL),
    });
  });

  await page.route('**/api/admin/ai-usage/by-feature**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AI_USAGE_BY_FEATURE),
    });
  });

  await page.route('**/api/admin/ai-usage/recent**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(AI_USAGE_RECENT),
    });
  });

  await page.route('**/api/admin/ai-budget/status', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary.budget),
    });
  });

  await page.route('**/api/admin/ai-usage/export.csv', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'date,feature,model,costUsd\n2026-06-10,whatsapp_auto_reply,gpt-4o-mini,0.0021\n',
    });
  });

  await page.route('**/api/admin/ai-control/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('**/api/admin/ai-budget/settings', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, budget: summary.budget }),
    });
  });

  await page.route('**/api/settings/ai', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AI_COST_CONFIG),
      });
      return;
    }
    await route.continue();
  });
}
