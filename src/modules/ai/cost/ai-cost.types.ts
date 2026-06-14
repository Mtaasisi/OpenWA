export enum AiModelTier {
  CHEAP_FAST = 'cheap_fast',
  BALANCED = 'balanced',
  PREMIUM = 'premium',
}

export enum AiUsageFeature {
  WHATSAPP_AUTO_REPLY = 'whatsapp_auto_reply',
  INBOX_ASSISTANT = 'inbox_assistant',
  TRAINING_CENTER = 'training_center',
  ADMIN_ASSISTANT = 'admin_assistant',
  PRODUCT_SEARCH = 'product_search',
  MEMORY_UPDATE = 'memory_update',
  FOLLOWUP = 'followup',
  BACKGROUND_JOB = 'background_job',
}

export enum AiUsageSource {
  CUSTOMER_MESSAGE = 'customer_message',
  ADMIN_MANUAL = 'admin_manual',
  BACKGROUND_JOB = 'background_job',
}

export enum AiUsageStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  BUDGET_BLOCKED = 'budget_blocked',
  RATE_LIMITED = 'rate_limited',
}

export interface AiCallContext {
  feature: AiUsageFeature;
  source: AiUsageSource;
  branchId?: string | null;
  conversationId?: string | null;
  customerId?: string | null;
  messageId?: string | null;
  requestId?: string | null;
  tier?: AiModelTier;
  maxTokens?: number;
  maxIterations?: number;
  skipBudgetCheck?: boolean;
  adminOverrideBudget?: boolean;
}

export interface AiFeatureLimits {
  whatsapp_auto_reply?: number;
  inbox_assistant?: number;
  training_center?: number;
  admin_assistant?: number;
  greeting?: number;
  name_correction?: number;
  product_reply?: number;
}

export const DEFAULT_FEATURE_LIMITS: AiFeatureLimits = {
  whatsapp_auto_reply: 220,
  inbox_assistant: 250,
  training_center: 800,
  admin_assistant: 1500,
  greeting: 120,
  name_correction: 60,
  product_reply: 250,
};

export interface AiProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AiCallResult {
  content: string;
  actions: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  provider: string;
  model: string;
  latencyMs: number;
  usage?: AiProviderUsage;
  aiCallsCount: number;
  toolCallsCount: number;
}
