import {
  aiApi,
  aiLearningCacheApi,
  aiTrainingApi,
  type AiLearnedIntentRow,
  type AiReplyTemplateRow,
  type AiUnknownMessageRow,
} from '../../services/api';
import { getAuthHeaders } from '../auth-storage';
import {
  buildMockAnalytics,
  buildMockDashboard,
  DEFAULT_TRAINING_SETTINGS,
  MOCK_LEARNED_INTENTS,
  MOCK_REPLY_TEMPLATES,
  MOCK_UNKNOWN,
} from './mock-data';
import type {
  IntentFormValues,
  LearnedIntentView,
  ReplyTemplateFormValues,
  ReplyTemplateView,
  TrainingAnalyticsData,
  TrainingDashboardData,
  TrainingIntentStatus,
  TrainingSettingsForm,
  UnknownMessageStatus,
  UnknownMessageView,
} from './types';

const USE_MOCK =
  import.meta.env.VITE_AI_TRAINING_CENTER_MOCK === '1' ||
  import.meta.env.VITE_AI_TRAINING_CENTER_MOCK === 'true';

const REPLY_TEMPLATES_KEY = 'openwa_aitc_reply_templates';

function mapIntentStatus(status: string): TrainingIntentStatus {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'approved') return 'active';
  if (s === 'pending' || s === 'pending_review') return 'pending_review';
  if (s === 'disabled') return 'disabled';
  if (s === 'rejected') return 'rejected';
  return 'pending_review';
}

function mapUnknownStatus(status: string): UnknownMessageStatus {
  const s = status.toLowerCase();
  if (s === 'approved') return 'approved';
  if (s === 'rejected') return 'rejected';
  if (s === 'ignored') return 'ignored';
  return 'pending_review';
}

function rowToLearnedIntent(row: AiLearnedIntentRow): LearnedIntentView {
  return {
    id: row.id,
    phrase: row.phrase,
    examples: [row.phrase, row.normalizedPhrase].filter(Boolean),
    intent: row.intent,
    confidence: Math.round(row.confidence * (row.confidence <= 1 ? 100 : 1)),
    status: mapIntentStatus(row.status),
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt,
    suggestedReply: row.suggestedReply,
    trainedBy: row.approvedBy ?? (row.autoApproved ? 'Auto' : null),
  };
}

function rowToUnknown(row: AiUnknownMessageRow): UnknownMessageView {
  return {
    id: row.id,
    message: row.rawText,
    detectedIntent: row.detectedIntent,
    suggestedMeaning: row.aiSuggestedMeaning,
    suggestedReply: row.aiSuggestedReply,
    confidence: Math.round(row.confidence * (row.confidence <= 1 ? 100 : 1)),
    frequency: row.frequencyCount,
    lastSeen: row.createdAt,
    status: mapUnknownStatus(row.status),
  };
}

function rowToReplyTemplate(row: AiReplyTemplateRow): ReplyTemplateView {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    message: row.message,
    usageCount: row.usageCount ?? 0,
    ratingPercent: row.ratingPercent ?? 0,
    isFavorite: row.isFavorite ?? false,
    language: row.language ?? 'mixed',
    active: row.active ?? true,
  };
}

function loadReplyTemplatesLocal(): ReplyTemplateView[] {
  try {
    const raw = localStorage.getItem(REPLY_TEMPLATES_KEY);
    if (raw) return JSON.parse(raw) as ReplyTemplateView[];
  } catch {
    /* ignore */
  }
  return [...MOCK_REPLY_TEMPLATES];
}

function saveReplyTemplatesLocal(templates: ReplyTemplateView[]) {
  localStorage.setItem(REPLY_TEMPLATES_KEY, JSON.stringify(templates));
}

async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (USE_MOCK) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const aiTrainingCenterApi = {
  async getDashboard(): Promise<TrainingDashboardData> {
    return withFallback(async () => {
      const [stats, intents, unknown, overview] = await Promise.all([
        aiLearningCacheApi.getCacheStats(),
        aiLearningCacheApi.listLearnedIntents({ limit: 200 }),
        aiLearningCacheApi.listUnknownMessages({ limit: 200 }),
        aiTrainingApi.getOverview(),
      ]);

      const items = intents.items.map(rowToLearnedIntent);
      const pending = items.filter(i => i.status === 'pending_review').length;
      const disabled = items.filter(i => i.status === 'disabled').length;
      const lowConf = items.filter(i => i.confidence < 60).length;
      const mock = buildMockDashboard();

      return {
        ...mock,
        kpis: [
          {
            label: 'Learned Intents',
            value: String(stats.activeCount ?? items.length),
            change: `+${overview.approvedToday ?? 0} today`,
            changePositive: true,
          },
          mock.kpis[1],
          {
            label: 'Messages Trained',
            value: String(stats.totalUsage ?? 0),
            change: mock.kpis[2].change,
            changePositive: true,
          },
          mock.kpis[3],
          mock.kpis[4],
        ],
        recentTrained: items.slice(0, 8).map(row => ({
          id: row.id,
          phrase: row.phrase,
          intent: row.intent,
          status: row.status,
          confidence: row.confidence,
          trainedBy: row.trainedBy ?? '—',
          date: row.lastUsedAt ?? row.id,
        })),
        status: {
          ...mock.status,
          pendingReview: pending + (overview.pendingQuestions ?? 0),
          unknownMessages: unknown.items.length,
          lowConfidence: lowConf,
          disabledIntents: disabled,
        },
        topIntents: stats.topIntents?.map(t => ({
          intent: t.intent,
          count: t.count,
        })) ?? mock.topIntents,
      } satisfies TrainingDashboardData;
    }, buildMockDashboard() as TrainingDashboardData);
  },

  async listLearnedIntents(): Promise<LearnedIntentView[]> {
    return withFallback(async () => {
      const { items } = await aiLearningCacheApi.listLearnedIntents({ limit: 500 });
      return items.length ? items.map(rowToLearnedIntent) : MOCK_LEARNED_INTENTS;
    }, MOCK_LEARNED_INTENTS);
  },

  async createIntent(values: IntentFormValues): Promise<LearnedIntentView> {
    const variations = values.variations
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const res = await aiLearningCacheApi.createLearnedIntent({
      phrase: values.phrase.trim(),
      intent: values.intent,
      suggestedReply: values.replyVariations[0] ?? '',
      replyVariations: values.replyVariations,
    });
    if (res.item) return rowToLearnedIntent(res.item);
    return {
      id: `new-${Date.now()}`,
      phrase: values.phrase,
      examples: variations,
      intent: values.intent,
      confidence: values.confidence,
      status: values.status,
      usageCount: 0,
      lastUsedAt: null,
      meaning: values.meaning,
      suggestedReply: values.replyVariations[0],
      replyVariations: values.replyVariations,
      trainedBy: 'Admin',
    };
  },

  async approveIntent(id: string) {
    await aiLearningCacheApi.approveLearnedIntent(id);
  },

  async disableIntent(id: string) {
    await aiLearningCacheApi.disableLearnedIntent(id);
  },

  async rejectIntent(id: string) {
    await aiLearningCacheApi.rejectLearnedIntent(id);
  },

  async listUnknownMessages(): Promise<UnknownMessageView[]> {
    return withFallback(async () => {
      const { items } = await aiLearningCacheApi.listUnknownMessages({ limit: 500 });
      return items.length ? items.map(rowToUnknown) : MOCK_UNKNOWN;
    }, MOCK_UNKNOWN);
  },

  async approveUnknown(
    id: string,
    body: { intent?: string; reply?: string },
  ): Promise<void> {
    await aiLearningCacheApi.approveUnknownMessage(id, body);
  },

  async rejectUnknown(id: string): Promise<void> {
    await aiLearningCacheApi.rejectUnknownMessage(id);
  },

  async bulkUnknownMessages(
    ids: string[],
    action: 'approve' | 'reject' | 'disable' | 'change_category',
    category?: string,
  ): Promise<void> {
    const res = await aiLearningCacheApi.bulkUnknownMessages({ ids, action, category });
    if (!res.ok) throw new Error(res.error ?? 'bulk_failed');
  },

  async bulkLearnedIntents(
    ids: string[],
    action: 'approve' | 'reject' | 'disable' | 'change_category' | 'assign_template',
    opts?: { category?: string; replyTemplateId?: string },
  ): Promise<void> {
    const res = await aiLearningCacheApi.bulkLearnedIntents({
      ids,
      action,
      category: opts?.category,
      replyTemplateId: opts?.replyTemplateId,
    });
    if (!res.ok) throw new Error(res.error ?? 'bulk_failed');
  },

  async listReplyTemplates(): Promise<ReplyTemplateView[]> {
    return withFallback(async () => {
      const { items } = await aiLearningCacheApi.listReplyTemplates();
      return items.map(rowToReplyTemplate);
    }, loadReplyTemplatesLocal());
  },

  async createReplyTemplate(values: ReplyTemplateFormValues): Promise<ReplyTemplateView> {
    if (USE_MOCK) {
      const templates = loadReplyTemplatesLocal();
      const row: ReplyTemplateView = {
        id: `tpl-${Date.now()}`,
        name: values.name,
        category: values.category,
        message: values.message,
        usageCount: 0,
        ratingPercent: 0,
        isFavorite: false,
        language: values.language,
        active: values.active,
      };
      templates.push(row);
      saveReplyTemplatesLocal(templates);
      return row;
    }

    const res = await aiLearningCacheApi.createReplyTemplate(values);
    if (!res.ok || !res.item) throw new Error(res.error ?? 'create_failed');
    return rowToReplyTemplate(res.item);
  },

  async updateReplyTemplate(id: string, values: Partial<ReplyTemplateFormValues>): Promise<void> {
    if (USE_MOCK) {
      const templates = loadReplyTemplatesLocal();
      const idx = templates.findIndex(t => t.id === id);
      if (idx === -1) return;
      templates[idx] = {
        ...templates[idx],
        ...values,
        name: values.name ?? templates[idx].name,
        category: values.category ?? templates[idx].category,
        message: values.message ?? templates[idx].message,
        language: values.language ?? templates[idx].language,
        active: values.active ?? templates[idx].active,
      };
      saveReplyTemplatesLocal(templates);
      return;
    }

    const res = await aiLearningCacheApi.updateReplyTemplate(id, values);
    if (!res.ok) throw new Error(res.error ?? 'update_failed');
  },

  async deleteReplyTemplate(id: string): Promise<void> {
    if (USE_MOCK) {
      const templates = loadReplyTemplatesLocal().filter(t => t.id !== id);
      saveReplyTemplatesLocal(templates);
      return;
    }

    const res = await aiLearningCacheApi.deleteReplyTemplate(id);
    if (!res.ok) throw new Error('delete_failed');
  },

  async getAnalytics(range = '7'): Promise<TrainingAnalyticsData> {
    return withFallback(async () => {
      const data = await aiLearningCacheApi.getAnalytics({ range });
      return {
        kpis: data.kpis,
        cacheHitSeries: data.cacheHitSeries,
        intentsByStatus: data.intentsByStatus,
        costSavedSeries: data.costSavedSeries,
        topIntentsByUsage: data.topIntentsByUsage,
        unknownTrend: data.unknownTrend,
        topSavingPhrases: data.topSavingPhrases,
        repeatedUnknown: data.repeatedUnknown,
        lowConfidenceIntents: data.lowConfidenceIntents.map(rowToLearnedIntent),
      };
    }, buildMockAnalytics());
  },

  async getSettings(): Promise<TrainingSettingsForm> {
    return withFallback(async () => {
      const [trainingSettings, aiConfig] = await Promise.all([
        aiTrainingApi.getSettings().catch(() => null),
        aiApi.getConfig().catch(() => null),
      ]);
      const base = { ...DEFAULT_TRAINING_SETTINGS };
      if (aiConfig) {
        base.defaultContextMessages = aiConfig.autoReplyContextMessages ?? 3;
        base.maxContextMessages = aiConfig.autoReplyContextMessagesMax ?? 5;
        base.includeCrmWhenNeeded = aiConfig.includeCrmWhenNeeded ?? true;
        base.includeKnowledgeWhenNeeded = aiConfig.includeKnowledgeWhenNeeded ?? true;
        base.includeCatalogWhenNeeded = aiConfig.includeCatalogWhenNeeded ?? true;
        base.includeMemoryWhenNeeded = aiConfig.includeMemoryWhenNeeded ?? true;
        base.allowPremiumForAutoReply = aiConfig.allowPremiumModelForAutoReply ?? false;
        base.maxOutputTokens = 250;
        base.temperature = aiConfig.temperature ?? 0.3;
        base.messageBufferEnabled = aiConfig.messageBufferEnabled ?? true;
        base.debounceSeconds = aiConfig.messageBufferDebounceSeconds ?? 10;
        base.maxWaitSeconds = aiConfig.messageBufferMaxWaitSeconds ?? 30;
        base.maxMessagesPerBatch = aiConfig.messageBufferMaxMessages ?? 10;
        base.maxCharsPerBatch = aiConfig.messageBufferMaxCharacters ?? 4000;
        base.oneReplyPerBurst = aiConfig.oneReplyPerMessageBurst ?? true;
        base.ignoreDuplicateIds = aiConfig.ignoreDuplicateMessageIds ?? true;
        base.ignorePromotional = aiConfig.ignorePromotionalMessages ?? true;
        if (aiConfig.learnedReplyCacheEnabled != null) {
          base.learnedReplyCache = aiConfig.learnedReplyCacheEnabled;
        }
        if (aiConfig.autoLearnSafeIntents != null) {
          base.autoLearnSafeIntents = aiConfig.autoLearnSafeIntents;
        }
        if (aiConfig.autoApproveConfidenceThreshold != null) {
          base.autoApproveThreshold = aiConfig.autoApproveConfidenceThreshold;
        }
        if (aiConfig.pendingReviewThreshold != null) {
          base.pendingReviewThreshold = aiConfig.pendingReviewThreshold;
        }
      }
      if (trainingSettings) {
        if (trainingSettings.enableLearningDetection != null) {
          base.autoLearning = trainingSettings.enableLearningDetection;
        }
      }
      return base;
    }, DEFAULT_TRAINING_SETTINGS);
  },

  async saveSettings(form: TrainingSettingsForm): Promise<void> {
    await aiApi.saveConfig({
      autoReplyContextMessages: form.defaultContextMessages,
      autoReplyContextMessagesMax: form.maxContextMessages,
      includeCrmWhenNeeded: form.includeCrmWhenNeeded,
      includeKnowledgeWhenNeeded: form.includeKnowledgeWhenNeeded,
      includeCatalogWhenNeeded: form.includeCatalogWhenNeeded,
      includeMemoryWhenNeeded: form.includeMemoryWhenNeeded,
      allowPremiumModelForAutoReply: form.allowPremiumForAutoReply,
      temperature: form.temperature,
      messageBufferEnabled: form.messageBufferEnabled,
      messageBufferDebounceSeconds: form.debounceSeconds,
      messageBufferMaxWaitSeconds: form.maxWaitSeconds,
      messageBufferMaxMessages: form.maxMessagesPerBatch,
      messageBufferMaxCharacters: form.maxCharsPerBatch,
      oneReplyPerMessageBurst: form.oneReplyPerBurst,
      ignoreDuplicateMessageIds: form.ignoreDuplicateIds,
      ignorePromotionalMessages: form.ignorePromotional,
      learnedReplyCacheEnabled: form.learnedReplyCache,
      autoLearnSafeIntents: form.autoLearnSafeIntents,
      autoApproveConfidenceThreshold: form.autoApproveThreshold,
      pendingReviewThreshold: form.pendingReviewThreshold,
      disableLearningForSensitive: form.disableAutoLearningSensitive,
      replyVariationRotation: form.replyVariations,
    });
    try {
      await aiTrainingApi.patchSettings({ enableLearningDetection: form.autoLearning });
    } catch {
      /* training settings optional */
    }
  },

  async importTrainingData(csv: string): Promise<{ imported: number; skipped: number }> {
    const res = await aiLearningCacheApi.importLearnedIntentsCsv(csv);
    if (!res.ok) throw new Error(res.error ?? 'import_failed');
    return { imported: res.imported ?? 0, skipped: res.skipped ?? 0 };
  },

  async exportLearnedIntentsCsv(): Promise<void> {
    const res = await fetch('/api/admin/ai-learning/learned-intents-export.csv', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('export_failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learned-intents-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
