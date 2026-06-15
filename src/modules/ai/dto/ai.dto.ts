import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiProvider, AI_PROVIDER_VALUES } from '../ai.enums';

export class UpsertAiConfigDto {
  @IsEnum(AI_PROVIDER_VALUES)
  provider: AiProvider;

  @IsString()
  model: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;

  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsNumber()
  @IsOptional()
  @Min(256)
  @Max(128000)
  maxTokens?: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  toolCallingEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReplyEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReplyPrivateOnly?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1440)
  autoReplyCooldownMinutes?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  autoReplyContextMessages?: number;

  @IsString()
  @IsOptional()
  autoReplyPrompt?: string;

  @IsString()
  @IsOptional()
  autoReplyOptOutMessage?: string | null;

  @IsBoolean()
  @IsOptional()
  autoReplyOutsideHoursOnly?: boolean;

  @IsString()
  @IsOptional()
  autoReplyTimezone?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(23)
  autoReplyStartHour?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(23)
  autoReplyEndHour?: number;

  @IsArray()
  @IsOptional()
  autoReplyWeekdays?: number[];

  @IsString()
  @IsOptional()
  autoReplyTone?: string;

  @IsString()
  @IsOptional()
  autoReplyPreset?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  disabledTools?: string[];

  @IsBoolean()
  @IsOptional()
  knowledgeRagEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  memoryRagEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  progressiveProfilingEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(3)
  profilingMaxQuestionsPerReply?: number;

  @IsBoolean()
  @IsOptional()
  profilingAutoSaveHighConfidenceNames?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingRequireReviewMediumConfidence?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingDetectNameCorrections?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingSilentSaveFields?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingCreateLostDemandFollowups?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingAskNameImmediately?: boolean;

  @IsBoolean()
  @IsOptional()
  profilingDisabledInGroups?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  profilingHighConfidenceThreshold?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  profilingMediumConfidenceThreshold?: number;

  @IsString()
  @IsOptional()
  profilingNameSaveReplyTemplate?: string;

  @IsString()
  @IsOptional()
  profilingNameCorrectionReply?: string;

  @IsBoolean()
  @IsOptional()
  humanTimingEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  activeChatWaitMinMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  activeChatWaitMaxMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  warmChatWaitMinMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  warmChatWaitMaxMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  coldChatWaitMinMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  coldChatWaitMaxMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  burstPauseMinMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(120000)
  burstPauseMaxMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(180000)
  maxBurstWaitMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(500)
  @Max(30000)
  typingMinMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(60000)
  typingMaxMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(80)
  typingCharsPerSecondMin?: number;

  @IsNumber()
  @IsOptional()
  @Min(5)
  @Max(80)
  typingCharsPerSecondMax?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(15000)
  typingComplexityExtraMs?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10080)
  greetingRepeatCooldownMinutes?: number;

  @IsBoolean()
  @IsOptional()
  presenceIntentEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  suspiciousNameConfirmationEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoReplyUseQuotedReply?: boolean;

  @IsBoolean()
  @IsOptional()
  replyToBurstLatestMessage?: boolean;

  @IsBoolean()
  @IsOptional()
  noTypingDuringDebounce?: boolean;

  @IsString()
  @IsOptional()
  humanReplyStyle?: string;

  @IsBoolean()
  @IsOptional()
  aiUnrestrictedMode?: boolean;

  @IsString()
  @IsOptional()
  autoReplyModelTier?: string;

  @IsString()
  @IsOptional()
  inboxAssistantModelTier?: string;

  @IsString()
  @IsOptional()
  trainingModelTier?: string;

  @IsString()
  @IsOptional()
  adminAssistantModelTier?: string;

  @IsBoolean()
  @IsOptional()
  allowPremiumModelForAutoReply?: boolean;

  @IsNumber()
  @IsOptional()
  aiDailyBudgetUsd?: number;

  @IsNumber()
  @IsOptional()
  aiMonthlyBudgetUsd?: number;

  @IsNumber()
  @IsOptional()
  autoReplyDailyBudgetUsd?: number;

  @IsBoolean()
  @IsOptional()
  stopAutoReplyWhenBudgetExceeded?: boolean;

  @IsNumber()
  @IsOptional()
  notifyAdminWhenBudgetAtPercent?: number;

  @IsBoolean()
  @IsOptional()
  allowAdminOverrideBudget?: boolean;

  @IsNumber()
  @IsOptional()
  autoReplyContextMessagesMax?: number;

  @IsNumber()
  @IsOptional()
  autoReplyCooldownSeconds?: number;

  @IsNumber()
  @IsOptional()
  maxCustomerToolIterations?: number;

  @IsNumber()
  @IsOptional()
  maxAdminToolIterations?: number;

  @IsNumber()
  @IsOptional()
  maxAiCallsPerInboundMessage?: number;

  @IsBoolean()
  @IsOptional()
  includeCrmWhenNeeded?: boolean;

  @IsBoolean()
  @IsOptional()
  includeKnowledgeWhenNeeded?: boolean;

  @IsBoolean()
  @IsOptional()
  includeCatalogWhenNeeded?: boolean;

  @IsBoolean()
  @IsOptional()
  includeMemoryWhenNeeded?: boolean;

  @IsBoolean()
  @IsOptional()
  ignoreDuplicateMessageIds?: boolean;

  @IsBoolean()
  @IsOptional()
  ignorePromotionalMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  messageBufferEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  messageBufferDebounceSeconds?: number;

  @IsNumber()
  @IsOptional()
  messageBufferMaxWaitSeconds?: number;

  @IsNumber()
  @IsOptional()
  messageBufferMaxMessages?: number;

  @IsNumber()
  @IsOptional()
  messageBufferMaxCharacters?: number;

  @IsBoolean()
  @IsOptional()
  oneReplyPerMessageBurst?: boolean;

  @IsBoolean()
  @IsOptional()
  learnedReplyCacheEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  autoLearnSafeIntents?: boolean;

  @IsNumber()
  @IsOptional()
  autoApproveConfidenceThreshold?: number;

  @IsNumber()
  @IsOptional()
  pendingReviewThreshold?: number;

  @IsBoolean()
  @IsOptional()
  disableLearningForSensitive?: boolean;

  @IsBoolean()
  @IsOptional()
  replyVariationRotation?: boolean;

  @IsBoolean()
  @IsOptional()
  ignoreGroupMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  ignoreSelfMessages?: boolean;

  @IsNumber()
  @IsOptional()
  autoReplyPromptBudgetTokens?: number;

  @IsNumber()
  @IsOptional()
  autoReplySimplePromptBudgetTokens?: number;

  @IsNumber()
  @IsOptional()
  knowledgeMaxChunks?: number;

  @IsNumber()
  @IsOptional()
  knowledgeMaxCharsPerChunk?: number;

  @IsNumber()
  @IsOptional()
  knowledgeMaxTotalChars?: number;
}

export class FallbackModelDto {
  @IsString()
  provider: string;

  @IsString()
  model: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  baseUrl?: string;
}

export class AiBudgetSettingsDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  aiDailyBudgetUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  aiMonthlyBudgetUsd?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  autoReplyDailyBudgetUsd?: number;

  @IsBoolean()
  @IsOptional()
  stopAutoReplyWhenBudgetExceeded?: boolean;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  notifyAdminWhenBudgetAtPercent?: number;

  @IsBoolean()
  @IsOptional()
  allowAdminOverrideBudget?: boolean;
}

export class ChatImageAttachmentDto {
  @IsString()
  mimeType: string;

  @IsString()
  data: string;
}

export class ChatMessageDto {
  @IsEnum(['user', 'assistant', 'system'])
  role: 'user' | 'assistant' | 'system';

  @IsString()
  content: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChatImageAttachmentDto)
  images?: ChatImageAttachmentDto[];
}

export class AiChatBodyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @IsString()
  @IsOptional()
  conversationId?: string;

  @IsString()
  @IsOptional()
  currentPage?: string;

  @IsString()
  @IsOptional()
  currentChatId?: string;

  @IsString()
  @IsOptional()
  currentCustomerId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  title?: string;
}

export class AiAutoReplyPreviewDto {
  @IsString()
  @IsOptional()
  sampleMessage?: string;
}
