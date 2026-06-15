import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import { AiProvider } from '../ai.enums';

export const AI_CONFIG_ID = 'default';

@Entity('ai_config')
export class AiConfig {
  @PrimaryColumn({ default: AI_CONFIG_ID })
  id: string;

  @Column({ type: 'varchar', default: AiProvider.OPENAI })
  provider: AiProvider;

  @Column({ type: 'varchar', default: 'gpt-4o-mini' })
  model: string;

  @Column({ type: 'text', nullable: true })
  apiKeyEncrypted: string | null;

  @Column({ type: 'varchar', nullable: true })
  baseUrl: string | null;

  @Column({ type: 'text', nullable: true })
  systemPrompt: string | null;

  @Column({ type: 'real', default: 0.7 })
  temperature: number;

  @Column({ type: 'int', default: 4096 })
  maxTokens: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: true })
  toolCallingEnabled: boolean;

  @Column({ default: true })
  autoReplyEnabled: boolean;

  @Column({ default: true })
  autoReplyPrivateOnly: boolean;

  @Column({ type: 'int', default: 0 })
  autoReplyCooldownMinutes: number;

  @Column({ type: 'int', default: 3 })
  autoReplyContextMessages: number;

  @Column({ type: 'int', default: 5 })
  autoReplyContextMessagesMax: number;

  @Column({ type: 'text', nullable: true })
  autoReplyPrompt: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  autoReplyTone: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  autoReplyPreset: string | null;

  @Column({ default: false })
  autoReplyOutsideHoursOnly: boolean;

  @Column({ type: 'varchar', nullable: true })
  autoReplyTimezone: string | null;

  @Column({ type: 'int', default: 9 })
  autoReplyStartHour: number;

  @Column({ type: 'int', default: 17 })
  autoReplyEndHour: number;

  @Column({ type: 'simple-json', nullable: true })
  autoReplyWeekdays: number[] | null;

  /** One-line reply when customer opts out of AI (empty = default message). */
  @Column({ type: 'text', nullable: true })
  autoReplyOptOutMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  fallbackModels: Array<{
    provider: string;
    model: string;
    baseUrl?: string;
    apiKeyEncrypted?: string;
  }> | null;

  /** Tool names excluded when tool calling is enabled (staff assistant). */
  @Column({ type: 'simple-json', nullable: true })
  disabledTools: string[] | null;

  @Column({ default: true })
  knowledgeRagEnabled: boolean;

  @Column({ default: true })
  memoryRagEnabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  testStatus: string | null;

  @Column({ type: 'text', nullable: true })
  testError: string | null;

  @Column({ default: true })
  progressiveProfilingEnabled: boolean;

  @Column({ type: 'int', default: 1 })
  profilingMaxQuestionsPerReply: number;

  @Column({ default: true })
  profilingAutoSaveHighConfidenceNames: boolean;

  @Column({ default: true })
  profilingRequireReviewMediumConfidence: boolean;

  @Column({ default: true })
  profilingDetectNameCorrections: boolean;

  @Column({ default: true })
  profilingSilentSaveFields: boolean;

  @Column({ default: true })
  profilingCreateLostDemandFollowups: boolean;

  @Column({ default: false })
  profilingAskNameImmediately: boolean;

  @Column({ default: true })
  profilingDisabledInGroups: boolean;

  @Column({ type: 'real', default: 0.9 })
  profilingHighConfidenceThreshold: number;

  @Column({ type: 'real', default: 0.6 })
  profilingMediumConfidenceThreshold: number;

  @Column({
    type: 'text',
    nullable: true,
    default: 'Sawa {name}, ngoja nisave namba yako 😊',
  })
  profilingNameSaveReplyTemplate: string | null;

  @Column({ type: 'text', nullable: true, default: 'Ahaa basi powa nimekupata.' })
  profilingNameCorrectionReply: string | null;

  @Column({ default: false })
  humanTimingEnabled: boolean;

  @Column({ type: 'int', default: 500 })
  activeChatWaitMinMs: number;

  @Column({ type: 'int', default: 1500 })
  activeChatWaitMaxMs: number;

  @Column({ type: 'int', default: 1500 })
  warmChatWaitMinMs: number;

  @Column({ type: 'int', default: 4000 })
  warmChatWaitMaxMs: number;

  @Column({ type: 'int', default: 5000 })
  coldChatWaitMinMs: number;

  @Column({ type: 'int', default: 9000 })
  coldChatWaitMaxMs: number;

  @Column({ type: 'int', default: 4500 })
  burstPauseMinMs: number;

  @Column({ type: 'int', default: 7500 })
  burstPauseMaxMs: number;

  @Column({ type: 'int', default: 30000 })
  maxBurstWaitMs: number;

  @Column({ type: 'int', default: 1200 })
  typingMinMs: number;

  @Column({ type: 'int', default: 14000 })
  typingMaxMs: number;

  @Column({ type: 'int', default: 18 })
  typingCharsPerSecondMin: number;

  @Column({ type: 'int', default: 35 })
  typingCharsPerSecondMax: number;

  @Column({ type: 'int', default: 2500 })
  typingComplexityExtraMs: number;

  @Column({ type: 'int', default: 240 })
  greetingRepeatCooldownMinutes: number;

  @Column({ default: true })
  presenceIntentEnabled: boolean;

  @Column({ default: true })
  suspiciousNameConfirmationEnabled: boolean;

  @Column({ default: true })
  autoReplyUseQuotedReply: boolean;

  @Column({ default: true })
  replyToBurstLatestMessage: boolean;

  @Column({ default: true })
  noTypingDuringDebounce: boolean;

  @Column({ type: 'varchar', length: 16, default: 'fast' })
  humanReplyStyle: string;

  /** When true, bypass AI reply delays, caps, and hardcoded escalations (groups still excluded). */
  @Column({ default: true })
  aiUnrestrictedMode: boolean;

  /** Reply with fallback when product search returns no catalog match (never stay silent). */
  @Column({ default: true })
  replyWhenProductNotFound: boolean;

  /** Minutes AI stays paused after a manual staff reply in thread. */
  @Column({ type: 'int', default: 15 })
  manualTakeoverMinutes: number;

  /** Max automatic retries for failed AI outbound messages. */
  @Column({ type: 'int', default: 3 })
  aiFailedSendMaxRetries: number;

  @Column({ type: 'varchar', length: 16, default: 'cheap_fast' })
  autoReplyModelTier: string;

  @Column({ type: 'varchar', length: 16, default: 'cheap_fast' })
  inboxAssistantModelTier: string;

  @Column({ type: 'varchar', length: 16, default: 'balanced' })
  trainingModelTier: string;

  @Column({ type: 'varchar', length: 16, default: 'balanced' })
  adminAssistantModelTier: string;

  @Column({ type: 'varchar', nullable: true })
  autoReplyModelOverride: string | null;

  @Column({ type: 'varchar', nullable: true })
  inboxAssistantModelOverride: string | null;

  @Column({ type: 'varchar', nullable: true })
  trainingModelOverride: string | null;

  @Column({ type: 'varchar', nullable: true })
  adminAssistantModelOverride: string | null;

  @Column({ default: false })
  allowPremiumModelForAutoReply: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 1 })
  aiDailyBudgetUsd: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 20 })
  aiMonthlyBudgetUsd: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0.5 })
  autoReplyDailyBudgetUsd: number;

  @Column({ default: true })
  stopAutoReplyWhenBudgetExceeded: boolean;

  @Column({ type: 'int', default: 80 })
  notifyAdminWhenBudgetAtPercent: number;

  @Column({ default: true })
  allowAdminOverrideBudget: boolean;

  @Column({ default: false })
  aiBudgetPaused: boolean;

  @Column({ default: false })
  autoReplyPaused: boolean;

  @Column({ type: 'simple-json', nullable: true })
  aiFeatureLimits: Record<string, number> | null;

  @Column({ default: true })
  includeCrmWhenNeeded: boolean;

  @Column({ default: true })
  includeKnowledgeWhenNeeded: boolean;

  @Column({ default: true })
  includeCatalogWhenNeeded: boolean;

  @Column({ default: true })
  includeMemoryWhenNeeded: boolean;

  @Column({ type: 'int', default: 60 })
  autoReplyCooldownSeconds: number;

  @Column({ default: true })
  ignoreDuplicateMessageIds: boolean;

  @Column({ default: true })
  ignorePromotionalMessages: boolean;

  @Column({ type: 'int', default: 2 })
  maxCustomerToolIterations: number;

  @Column({ type: 'int', default: 5 })
  maxAdminToolIterations: number;

  @Column({ type: 'int', default: 2 })
  maxAiCallsPerInboundMessage: number;

  @Column({ default: true })
  messageBufferEnabled: boolean;

  @Column({ type: 'int', default: 10 })
  messageBufferDebounceSeconds: number;

  @Column({ type: 'int', default: 30 })
  messageBufferMaxWaitSeconds: number;

  @Column({ type: 'int', default: 10 })
  messageBufferMaxMessages: number;

  @Column({ type: 'int', default: 4000 })
  messageBufferMaxCharacters: number;

  @Column({ default: true })
  oneReplyPerMessageBurst: boolean;

  @Column({ default: true })
  learnedReplyCacheEnabled: boolean;

  @Column({ default: true })
  autoLearnSafeIntents: boolean;

  @Column({ type: 'int', default: 90 })
  autoApproveConfidenceThreshold: number;

  @Column({ type: 'int', default: 60 })
  pendingReviewThreshold: number;

  @Column({ default: true })
  disableLearningForSensitive: boolean;

  @Column({ default: true })
  replyVariationRotation: boolean;

  @Column({ default: true })
  ignoreGroupMessages: boolean;

  @Column({ default: true })
  ignoreSelfMessages: boolean;

  @Column({ type: 'int', default: 1500 })
  autoReplyPromptBudgetTokens: number;

  @Column({ type: 'int', default: 500 })
  autoReplySimplePromptBudgetTokens: number;

  @Column({ type: 'int', default: 2 })
  knowledgeMaxChunks: number;

  @Column({ type: 'int', default: 600 })
  knowledgeMaxCharsPerChunk: number;

  @Column({ type: 'int', default: 1200 })
  knowledgeMaxTotalChars: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
