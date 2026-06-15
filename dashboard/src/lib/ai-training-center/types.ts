export type TrainingIntentStatus = 'active' | 'pending_review' | 'disabled' | 'rejected';
export type UnknownMessageStatus = 'pending_review' | 'approved' | 'rejected' | 'ignored';

export interface TrainingKpi {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
}

export interface TrainingDashboardData {
  kpis: TrainingKpi[];
  overviewSeries: Array<{ date: string; messagesTrained: number; aiCallsSaved: number }>;
  topIntents: Array<{ intent: string; count: number; color?: string }>;
  recentTrained: RecentTrainedRow[];
  status: TrainingStatusSummary;
}

export interface RecentTrainedRow {
  id: string;
  phrase: string;
  intent: string;
  status: TrainingIntentStatus;
  confidence: number;
  trainedBy: string;
  date: string;
}

export interface TrainingStatusSummary {
  autoLearningEnabled: boolean;
  pendingReview: number;
  unknownMessages: number;
  lowConfidence: number;
  disabledIntents: number;
}

export interface LearnedIntentView {
  id: string;
  phrase: string;
  examples: string[];
  intent: string;
  confidence: number;
  status: TrainingIntentStatus;
  usageCount: number;
  lastUsedAt: string | null;
  meaning?: string;
  suggestedReply?: string | null;
  replyVariations?: string[];
  trainedBy?: string | null;
  replyTemplateId?: string | null;
}

export interface UnknownMessageView {
  id: string;
  message: string;
  detectedIntent: string | null;
  suggestedMeaning: string | null;
  suggestedReply: string | null;
  confidence: number;
  frequency: number;
  lastSeen: string;
  status: UnknownMessageStatus;
}

export interface ReplyTemplateView {
  id: string;
  name: string;
  category: string;
  message: string;
  usageCount: number;
  ratingPercent: number;
  isFavorite: boolean;
  language: string;
  active: boolean;
}

export interface TrainingAnalyticsData {
  kpis: TrainingKpi[];
  cacheHitSeries: Array<{ date: string; rate: number }>;
  intentsByStatus: Array<{ status: string; count: number }>;
  costSavedSeries: Array<{ date: string; amount: number }>;
  topIntentsByUsage: Array<{ intent: string; usage: number }>;
  unknownTrend: Array<{ date: string; count: number }>;
  topSavingPhrases: Array<{ phrase: string; savedCalls: number }>;
  repeatedUnknown: Array<{ message: string; count: number }>;
  lowConfidenceIntents: LearnedIntentView[];
}

export interface TrainingSettingsForm {
  enabled: boolean;
  learnedReplyCache: boolean;
  replyVariations: boolean;
  defaultLanguage: 'sw' | 'en' | 'mixed';
  autoLearning: boolean;
  autoLearnSafeIntents: boolean;
  autoApproveSafeIntents: boolean;
  disableAutoLearningSensitive: boolean;
  autoApproveThreshold: number;
  pendingReviewThreshold: number;
  lowConfidenceThreshold: number;
  messageBufferEnabled: boolean;
  debounceSeconds: number;
  maxWaitSeconds: number;
  maxMessagesPerBatch: number;
  maxCharsPerBatch: number;
  oneReplyPerBurst: boolean;
  defaultContextMessages: number;
  maxContextMessages: number;
  includeCrmWhenNeeded: boolean;
  includeKnowledgeWhenNeeded: boolean;
  includeCatalogWhenNeeded: boolean;
  includeMemoryWhenNeeded: boolean;
  autoReplyModel: string;
  classifierModel: string;
  trainingModel: string;
  allowPremiumForAutoReply: boolean;
  maxOutputTokens: number;
  temperature: number;
  ignoreGroupMessages: boolean;
  ignoreSelfMessages: boolean;
  ignoreDuplicateIds: boolean;
  ignorePromotional: boolean;
  humanReviewComplaints: boolean;
  humanReviewPayments: boolean;
  humanReviewLowConfidence: boolean;
}

export type BulkActionType =
  | 'approve'
  | 'reject'
  | 'disable'
  | 'assign_template'
  | 'change_category';

export interface IntentFormValues {
  phrase: string;
  variations: string;
  intent: string;
  meaning?: string;
  confidence: number;
  status: TrainingIntentStatus;
  replyTemplateId?: string;
  replyVariations: string[];
}

export interface ReplyTemplateFormValues {
  name: string;
  category: string;
  message: string;
  language: string;
  active: boolean;
}
