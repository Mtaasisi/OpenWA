import type { Page } from '@playwright/test';

const AI_AUTO_REPLY_HEALTH = {
  masterEnabled: true,
  ready: true,
  checks: [
    { id: 'provider', ok: true, fixTarget: 'ai' as const },
    { id: 'knowledge', ok: true, fixTarget: 'ai-knowledge' as const },
    { id: 'localCatalog', ok: true, fixTarget: 'products' as const, detail: '8 in-stock of 10 products' },
  ],
  sessions: [],
  stats: {
    aiReplies24h: 0,
    openEscalations: 0,
    knowledgeChunks: 12,
    knowledgeFiles: 4,
  },
};

const AI_CONFIG = {
  provider: 'OPENAI',
  model: 'gpt-4o',
  baseUrl: null,
  systemPrompt: '',
  temperature: 0.7,
  enabled: true,
  toolCallingEnabled: true,
  autoReplyEnabled: true,
  autoReplyPrivateOnly: true,
  autoReplyCooldownMinutes: 0,
  autoReplyContextMessages: 3,
  disabledTools: [],
  knowledgeRagEnabled: true,
  memoryRagEnabled: true,
  progressiveProfilingEnabled: true,
  profilingAutoSaveHighConfidenceNames: true,
  profilingRequireReviewMediumConfidence: true,
  profilingDetectNameCorrections: true,
  profilingSilentSaveFields: true,
  profilingCreateLostDemandFollowups: true,
  profilingAskNameImmediately: false,
  profilingDisabledInGroups: true,
  profilingMaxQuestionsPerReply: 1,
  profilingNameSaveReplyTemplate: 'Sawa {name}, ngoja nisave namba yako 😊',
  profilingNameCorrectionReply: 'Ahaa basi powa nimekupata.',
  humanTimingEnabled: false,
  aiUnrestrictedMode: true,
  humanReplyStyle: 'fast',
  greetingRepeatCooldownMinutes: 240,
  presenceIntentEnabled: true,
  suspiciousNameConfirmationEnabled: true,
  noTypingDuringDebounce: true,
  autoReplyUseQuotedReply: true,
  replyToBurstLatestMessage: true,
  activeChatWaitMinMs: 500,
  activeChatWaitMaxMs: 1500,
  warmChatWaitMinMs: 1500,
  warmChatWaitMaxMs: 4000,
  coldChatWaitMinMs: 5000,
  coldChatWaitMaxMs: 9000,
  burstPauseMinMs: 4500,
  burstPauseMaxMs: 7500,
  maxBurstWaitMs: 30000,
  typingMinMs: 1200,
  typingMaxMs: 14000,
  apiKeySet: true,
  testStatus: 'ok',
};

export async function installAiSettingsMocks(page: Page): Promise<void> {
  await page.route('**/api/settings/ai', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AI_CONFIG),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...AI_CONFIG, ...(route.request().postDataJSON() as object) }),
    });
  });

  await page.route('**/api/settings/ai/**', async route => {
    const url = route.request().url();
    if (url.includes('/models')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['gpt-4o', 'gpt-4o-mini']),
      });
      return;
    }
    if (url.includes('/fallbacks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (url.includes('/auto-reply/presets')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'custom', label: 'Custom', tone: '', prompt: '' }]),
      });
      return;
    }
    if (url.includes('/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          apiKeySet: false,
          autoReplyEnabled: false,
          toolCallingEnabled: true,
          testStatus: 'ok',
          provider: 'OPENAI',
          model: 'gpt-4o',
          memory: { chunks: 0, vectorSearch: false, database: 'sqlite' },
          knowledge: { chunks: 100, vectorSearch: true, database: 'sqlite' },
          setup: {
            ready: false,
            completed: 4,
            total: 7,
            items: [
              { id: 'apiKey', ok: false },
              { id: 'enabled', ok: true },
              { id: 'autoReply', ok: false },
              { id: 'knowledgeIndexed', ok: true, detail: '100 chunks' },
              { id: 'knowledgeFiles', ok: true, detail: '14 files' },
              { id: 'branchProfile', ok: true, detail: '2 branch(es)' },
              { id: 'paymentAccount', ok: false },
            ],
          },
        }),
      });
      return;
    }
    if (url.includes('/auto-reply/health')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AI_AUTO_REPLY_HEALTH),
      });
      return;
    }
    if (url.includes('/auto-reply/master')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...AI_AUTO_REPLY_HEALTH, masterEnabled: true }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/ai/tools', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'search_products', description: 'Search catalog', parameters: {} },
      ]),
    });
  });

  await page.route('**/api/**', async route => {
    const url = route.request().url();
    if (
      url.includes('/api/auth/') ||
      url.includes('/api/settings/ai') ||
      url.includes('/api/settings') ||
      url.includes('/api/ai/tools') ||
      url.includes('/api/health') ||
      url.includes('/api/sessions') ||
      url.includes('/api/app/status')
    ) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}
