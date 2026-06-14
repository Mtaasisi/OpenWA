import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import {
  DEFAULT_KNOWLEDGE_FILES,
  DEFAULT_RISKY_CATEGORIES,
  DEFAULT_UNKNOWN_REPLY,
} from '../ai-learning.enums';

export const AI_LEARNING_SETTINGS_ID = 'default';

@Entity('ai_learning_settings')
export class AiLearningSettings {
  @PrimaryColumn({ default: AI_LEARNING_SETTINGS_ID })
  id: string;

  @Column({ default: true })
  enableLearningDetection: boolean;

  @Column({ default: true })
  requireAdminApproval: boolean;

  @Column({ default: true })
  autoCreatePendingQuestion: boolean;

  @Column({ default: true })
  autoSuggestDraftAnswer: boolean;

  @Column({ default: true })
  groupSimilarQuestions: boolean;

  @Column({ default: true })
  trackRepeatedQuestions: boolean;

  @Column({ default: true })
  trackStaffCorrections: boolean;

  @Column({ default: true })
  trackCustomerOutcome: boolean;

  @Column({ type: 'real', default: 0.8 })
  highConfidenceThreshold: number;

  @Column({ type: 'real', default: 0.65 })
  trainingKnowledgeMatchThreshold: number;

  /** skip | separate | include — how group (@g.us) chats appear in AI Training. */
  @Column({ default: 'skip' })
  trainingGroupChatsMode: string;

  @Column({ type: 'real', default: 0.5 })
  mediumConfidenceThreshold: number;

  @Column({ type: 'text', default: DEFAULT_UNKNOWN_REPLY })
  defaultUnknownReply: string;

  @Column({ default: true })
  trackProductMentions: boolean;

  @Column({ default: true })
  trackVariants: boolean;

  @Column({ default: true })
  trackUnmatchedProducts: boolean;

  @Column({ default: true })
  trackOutOfStockDemand: boolean;

  @Column({ default: true })
  trackInstallmentDemand: boolean;

  @Column({ default: true })
  trackDiscountPressure: boolean;

  @Column({ default: true })
  trackPaymentReadyDemand: boolean;

  @Column({ default: true })
  trackCategoryDemand: boolean;

  @Column({ default: true })
  trackBrandDemand: boolean;

  @Column({ type: 'simple-json', nullable: true })
  allowedTargetFiles: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  ignoredIntents: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  riskyCategories: string[] | null;

  @Column({ default: true })
  trainingCenterEnabled: boolean;

  @Column({ default: true })
  autoCreateFromLowConfidence: boolean;

  @Column({ default: true })
  autoCreateFromHumanReplies: boolean;

  @Column({ default: true })
  dailyInboxScan: boolean;

  @Column({ default: 7 })
  scanLastDays: number;

  /** Local server time HH:mm for daily inbox scan (default 02:00). */
  @Column({ default: '02:00' })
  dailyScanTime: string;

  @Column({ default: true })
  useLlmTrainingSuggestions: boolean;

  @Column({ default: true })
  autoClusterRepeated: boolean;

  @Column({ default: true })
  autoReindexAfterApproval: boolean;

  @Column({ default: true })
  allowMarkdownWrites: boolean;

  @Column({ default: true })
  allowMemoryWrites: boolean;

  @Column({ default: true })
  allowDbTrainingRules: boolean;

  @Column({ default: true })
  maskPrivateDataInExports: boolean;

  @Column({ default: true })
  autoReindexSmallUpdatesOnly: boolean;

  @Column({ default: false })
  knowledgeIndexStale: boolean;

  @UpdateDateColumn()
  updatedAt: Date;

  static defaults(): Partial<AiLearningSettings> {
    return {
      id: AI_LEARNING_SETTINGS_ID,
      enableLearningDetection: true,
      requireAdminApproval: true,
      autoCreatePendingQuestion: true,
      autoSuggestDraftAnswer: true,
      groupSimilarQuestions: true,
      trackRepeatedQuestions: true,
      trackStaffCorrections: true,
      trackCustomerOutcome: true,
      highConfidenceThreshold: 0.8,
      trainingKnowledgeMatchThreshold: 0.65,
      trainingGroupChatsMode: 'skip',
      mediumConfidenceThreshold: 0.5,
      defaultUnknownReply: DEFAULT_UNKNOWN_REPLY,
      trackProductMentions: true,
      trackVariants: true,
      trackUnmatchedProducts: true,
      trackOutOfStockDemand: true,
      trackInstallmentDemand: true,
      trackDiscountPressure: true,
      trackPaymentReadyDemand: true,
      trackCategoryDemand: true,
      trackBrandDemand: true,
      allowedTargetFiles: [...DEFAULT_KNOWLEDGE_FILES],
      ignoredIntents: [],
      riskyCategories: [...DEFAULT_RISKY_CATEGORIES],
      trainingCenterEnabled: true,
      autoCreateFromLowConfidence: true,
      autoCreateFromHumanReplies: true,
      dailyInboxScan: true,
      scanLastDays: 7,
      dailyScanTime: '02:00',
      useLlmTrainingSuggestions: true,
      autoClusterRepeated: true,
      autoReindexAfterApproval: true,
      allowMarkdownWrites: true,
      allowMemoryWrites: true,
      allowDbTrainingRules: true,
      maskPrivateDataInExports: true,
      autoReindexSmallUpdatesOnly: true,
      knowledgeIndexStale: false,
    };
  }
}
