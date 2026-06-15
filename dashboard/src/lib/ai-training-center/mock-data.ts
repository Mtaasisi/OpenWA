import type {
  LearnedIntentView,
  ReplyTemplateView,
  TrainingAnalyticsData,
  TrainingDashboardData,
  TrainingSettingsForm,
  UnknownMessageView,
} from './types';

/** Mock adapter — replace when /api/admin/ai-learning/* analytics endpoints ship. */
export const MOCK_REPLY_TEMPLATES: ReplyTemplateView[] = [
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
  },
  {
    id: 'tpl-greeting-2',
    name: 'Greeting - Variation 2',
    category: 'greeting',
    message: 'Mambo vipi 😊 Karibu, unahitaji bidhaa gani?',
    usageCount: 98,
    ratingPercent: 94,
    isFavorite: false,
    language: 'mixed',
    active: true,
  },
  {
    id: 'tpl-price',
    name: 'Price - General',
    category: 'price',
    message: 'Bei inategemea model unayotaka. Vipi, unahitaji ya matumizi gani?',
    usageCount: 186,
    ratingPercent: 96,
    isFavorite: true,
    language: 'sw',
    active: true,
  },
  {
    id: 'tpl-location',
    name: 'Location - Shop',
    category: 'location',
    message: 'Tupo Kariakoo, Dar es Salaam Tanzania dukani 😊',
    usageCount: 77,
    ratingPercent: 93,
    isFavorite: false,
    language: 'sw',
    active: true,
  },
  {
    id: 'tpl-delivery',
    name: 'Delivery - General',
    category: 'delivery',
    message: 'Ndiyo, tunatuma ndani karibu kote Tanzania kupitia makampuni ya usafirishaji.',
    usageCount: 121,
    ratingPercent: 94,
    isFavorite: false,
    language: 'sw',
    active: true,
  },
  {
    id: 'tpl-installment',
    name: 'Installment - General',
    category: 'installment',
    message: 'Ndiyo, tunaweza malipo kidogo kidogo. Unahitaji kulipa kwa muda gani?',
    usageCount: 64,
    ratingPercent: 90,
    isFavorite: false,
    language: 'sw',
    active: true,
  },
];

export const MOCK_LEARNED_INTENTS: LearnedIntentView[] = [
  {
    id: 'li-1',
    phrase: 'mambo',
    examples: ['mambo', 'mambo vipi', 'za mida', 'vp', 'vipi'],
    intent: 'greeting',
    confidence: 98,
    status: 'active',
    usageCount: 432,
    lastUsedAt: new Date().toISOString(),
    meaning: 'Casual greeting',
    suggestedReply: MOCK_REPLY_TEMPLATES[0].message,
    trainedBy: 'Auto',
  },
  {
    id: 'li-2',
    phrase: 'bei ya laptop',
    examples: ['bei gani', 'laptop ngapi', 'price ya laptop'],
    intent: 'price_question',
    confidence: 96,
    status: 'active',
    usageCount: 285,
    lastUsedAt: new Date().toISOString(),
    suggestedReply: MOCK_REPLY_TEMPLATES[2].message,
    trainedBy: 'Admin',
  },
  {
    id: 'li-3',
    phrase: 'mko wapi',
    examples: ['uko wapi', 'location', 'duka liko wapi'],
    intent: 'location',
    confidence: 97,
    status: 'active',
    usageCount: 198,
    lastUsedAt: new Date().toISOString(),
    suggestedReply: MOCK_REPLY_TEMPLATES[3].message,
    trainedBy: 'Auto',
  },
  {
    id: 'li-4',
    phrase: 'matuma mikoani',
    examples: ['matuma', 'delivery mikoani', 'tuma mikoani'],
    intent: 'delivery',
    confidence: 95,
    status: 'active',
    usageCount: 176,
    lastUsedAt: new Date().toISOString(),
    suggestedReply: MOCK_REPLY_TEMPLATES[4].message,
    trainedBy: 'Auto',
  },
  {
    id: 'li-5',
    phrase: 'nalipa kidogo kidogo',
    examples: ['installment', 'lipo kidogo', 'credit'],
    intent: 'installment',
    confidence: 72,
    status: 'pending_review',
    usageCount: 67,
    lastUsedAt: new Date().toISOString(),
    suggestedReply: MOCK_REPLY_TEMPLATES[5].message,
    trainedBy: 'Staff',
  },
  {
    id: 'li-6',
    phrase: 'nataka kuongea na mtu',
    examples: ['call me', 'nipigie', 'naongea na mtu'],
    intent: 'human_request',
    confidence: 93,
    status: 'active',
    usageCount: 143,
    lastUsedAt: new Date().toISOString(),
    trainedBy: 'Auto',
  },
];

export const MOCK_UNKNOWN: UnknownMessageView[] = [
  {
    id: 'unk-1',
    message: 'hii ya gaming kali inakaa aje?',
    detectedIntent: 'product_question',
    suggestedMeaning: 'Customer asking about gaming phone appearance',
    suggestedReply: 'Ni design ya gaming Boss — performance na look zake ni nzuri kwa games.',
    confidence: 58,
    frequency: 12,
    lastSeen: new Date().toISOString(),
    status: 'pending_review',
  },
  {
    id: 'unk-2',
    message: 'nanoae bora?',
    detectedIntent: 'product_question',
    suggestedMeaning: 'Compare Nano vs other options',
    suggestedReply: 'Nano ni nzuri kwa portability; tuko na options kulingana na budget yako.',
    confidence: 45,
    frequency: 8,
    lastSeen: new Date().toISOString(),
    status: 'pending_review',
  },
  {
    id: 'unk-3',
    message: 'imei unaficha?',
    detectedIntent: 'unknown',
    suggestedMeaning: 'IMEI visibility concern',
    suggestedReply: 'IMEI inaonyeshwa kwenye device Boss — tunauza stock halisi.',
    confidence: 41,
    frequency: 5,
    lastSeen: new Date().toISOString(),
    status: 'pending_review',
  },
];

export function buildMockDashboard(): TrainingDashboardData {
  const days = 7;
  const overviewSeries = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: d.toLocaleDateString(undefined, { weekday: 'short' }),
      messagesTrained: 120 + i * 18,
      aiCallsSaved: 80 + i * 12,
    };
  });

  return {
    kpis: [
      { label: 'Learned Intents', value: '284', change: '+18 this week', changePositive: true },
      { label: 'Cache Hit Rate', value: '78.6%', change: '+12.4% this week', changePositive: true },
      { label: 'Messages Trained', value: '1,243', change: '+156 this week', changePositive: true },
      { label: 'AI Calls Saved', value: '892', change: '+201 this week', changePositive: true },
      { label: 'Money Saved', value: '$23.45', change: '+$6.34 this week', changePositive: true },
    ],
    overviewSeries,
    topIntents: [
      { intent: 'Greeting', count: 32 },
      { intent: 'Product Question', count: 24 },
      { intent: 'Price / Availability', count: 18 },
      { intent: 'Location', count: 12 },
      { intent: 'Delivery', count: 10 },
      { intent: 'Others', count: 14 },
    ],
    recentTrained: MOCK_LEARNED_INTENTS.slice(0, 5).map(row => ({
      id: row.id,
      phrase: row.phrase,
      intent: row.intent,
      status: row.status,
      confidence: row.confidence,
      trainedBy: row.trainedBy ?? '—',
      date: row.lastUsedAt ?? new Date().toISOString(),
    })),
    status: {
      autoLearningEnabled: true as boolean,
      pendingReview: 3,
      unknownMessages: MOCK_UNKNOWN.length,
      lowConfidence: 2,
      disabledIntents: 4,
    },
  };
}

export function buildMockAnalytics(): TrainingAnalyticsData {
  const days = 14;
  const cacheHitSeries = Array.from({ length: days }, (_, i) => ({
    date: `D${i + 1}`,
    rate: 65 + Math.sin(i / 2) * 8 + i * 0.5,
  }));
  const costSavedSeries = Array.from({ length: days }, (_, i) => ({
    date: `D${i + 1}`,
    amount: 1.2 + i * 0.15,
  }));
  const unknownTrend = Array.from({ length: days }, (_, i) => ({
    date: `D${i + 1}`,
    count: 8 + (i % 4),
  }));

  return {
    kpis: [
      { label: 'Cache Hit Rate', value: '78.6%', change: '+12.4%', changePositive: true },
      { label: 'AI Calls Saved', value: '892', change: '+201', changePositive: true },
      { label: 'Tokens Saved', value: '1.2M', change: '+180k', changePositive: true },
      { label: 'Money Saved', value: '$23.45', change: '+$6.34', changePositive: true },
      { label: 'New Intents Learned', value: '18', change: '+5', changePositive: true },
    ],
    cacheHitSeries,
    intentsByStatus: [
      { status: 'Active', count: 240 },
      { status: 'Pending', count: 18 },
      { status: 'Disabled', count: 4 },
    ],
    costSavedSeries,
    topIntentsByUsage: MOCK_LEARNED_INTENTS.map(r => ({
      intent: r.intent,
      usage: r.usageCount,
    })),
    unknownTrend,
    topSavingPhrases: [
      { phrase: 'mambo', savedCalls: 432 },
      { phrase: 'bei ya laptop', savedCalls: 285 },
      { phrase: 'mko wapi', savedCalls: 198 },
    ],
    repeatedUnknown: MOCK_UNKNOWN.map(u => ({ message: u.message, count: u.frequency })),
    lowConfidenceIntents: MOCK_LEARNED_INTENTS.filter(i => i.confidence < 80),
  };
}

export const DEFAULT_TRAINING_SETTINGS: TrainingSettingsForm = {
  enabled: true,
  learnedReplyCache: true,
  replyVariations: true,
  defaultLanguage: 'mixed',
  autoLearning: true,
  autoLearnSafeIntents: true,
  autoApproveSafeIntents: true,
  disableAutoLearningSensitive: true,
  autoApproveThreshold: 90,
  pendingReviewThreshold: 60,
  lowConfidenceThreshold: 40,
  messageBufferEnabled: true,
  debounceSeconds: 10,
  maxWaitSeconds: 30,
  maxMessagesPerBatch: 10,
  maxCharsPerBatch: 4000,
  oneReplyPerBurst: true,
  defaultContextMessages: 3,
  maxContextMessages: 5,
  includeCrmWhenNeeded: true,
  includeKnowledgeWhenNeeded: true,
  includeCatalogWhenNeeded: true,
  includeMemoryWhenNeeded: true,
  autoReplyModel: 'claude-haiku-4-5-20251001',
  classifierModel: 'claude-haiku-4-5-20251001',
  trainingModel: 'claude-sonnet-4-6',
  allowPremiumForAutoReply: false,
  maxOutputTokens: 250,
  temperature: 0.3,
  ignoreGroupMessages: true,
  ignoreSelfMessages: true,
  ignoreDuplicateIds: true,
  ignorePromotional: true,
  humanReviewComplaints: true,
  humanReviewPayments: true,
  humanReviewLowConfidence: true,
};
