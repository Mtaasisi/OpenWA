import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig, AI_CONFIG_ID } from './entities/ai-config.entity';
import { AiProvider } from './ai.enums';
import { encryptAiSecret, decryptAiSecret } from '../../common/utils/ai-crypto.util';
import { PROVIDER_BASE_URLS, PROVIDER_MODELS } from './ai-provider-catalog';
import { formatAiProviderError } from './utils/ai-error.util';
import type { UpsertAiConfigDto } from './dto/ai.dto';
import {
  humanTimingPresetForStyle,
  type HumanReplyStyle,
} from './services/ai-human-timing.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import {
  AI_UNRESTRICTED_SAFETY_PATCH,
  isAiUnrestricted,
} from './utils/ai-unrestricted.util';
import { pickModelForTier } from './cost/ai-model-router.util';
import { AiModelTier } from './cost/ai-cost.types';

export interface FallbackModelEntry {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  apiKeyEncrypted?: string;
}

@Injectable()
export class AiSettingsService {
  constructor(
    @InjectRepository(AiConfig, 'data')
    private readonly configRepo: Repository<AiConfig>,
    private readonly safetySettings: WhatsAppSafetySettingsService,
  ) {}

  async get() {
    const config = await this.ensureConfig();
    return {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      systemPrompt: config.systemPrompt ?? '',
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      enabled: config.enabled,
      toolCallingEnabled: config.toolCallingEnabled,
      autoReplyEnabled: config.autoReplyEnabled,
      autoReplyPrivateOnly: config.autoReplyPrivateOnly,
      autoReplyCooldownMinutes: config.autoReplyCooldownMinutes,
      autoReplyContextMessages: config.autoReplyContextMessages,
      autoReplyPrompt: config.autoReplyPrompt ?? '',
      autoReplyTone: config.autoReplyTone ?? '',
      autoReplyPreset: config.autoReplyPreset ?? 'custom',
      autoReplyOutsideHoursOnly: config.autoReplyOutsideHoursOnly,
      autoReplyTimezone: config.autoReplyTimezone ?? 'Africa/Dar_es_Salaam',
      autoReplyStartHour: config.autoReplyStartHour,
      autoReplyEndHour: config.autoReplyEndHour,
      autoReplyWeekdays: config.autoReplyWeekdays ?? [1, 2, 3, 4, 5],
      autoReplyOptOutMessage: config.autoReplyOptOutMessage ?? '',
      disabledTools: config.disabledTools ?? [],
      knowledgeRagEnabled: config.knowledgeRagEnabled !== false,
      memoryRagEnabled: config.memoryRagEnabled !== false,
      apiKeySet: !!config.apiKeyEncrypted || !!this.envKeyForProvider(config.provider),
      apiKeySource: this.envKeyForProvider(config.provider)
        ? 'environment'
        : config.apiKeyEncrypted
          ? 'database'
          : null,
      testStatus: config.testStatus,
      testError: config.testError,
      progressiveProfilingEnabled: config.progressiveProfilingEnabled !== false,
      profilingMaxQuestionsPerReply: config.profilingMaxQuestionsPerReply ?? 1,
      profilingAutoSaveHighConfidenceNames: config.profilingAutoSaveHighConfidenceNames !== false,
      profilingRequireReviewMediumConfidence:
        config.profilingRequireReviewMediumConfidence !== false,
      profilingDetectNameCorrections: config.profilingDetectNameCorrections !== false,
      profilingSilentSaveFields: config.profilingSilentSaveFields !== false,
      profilingCreateLostDemandFollowups: config.profilingCreateLostDemandFollowups !== false,
      profilingAskNameImmediately: config.profilingAskNameImmediately === true,
      profilingDisabledInGroups: config.profilingDisabledInGroups !== false,
      profilingHighConfidenceThreshold: config.profilingHighConfidenceThreshold ?? 0.9,
      profilingMediumConfidenceThreshold: config.profilingMediumConfidenceThreshold ?? 0.6,
      profilingNameSaveReplyTemplate:
        config.profilingNameSaveReplyTemplate ??
        'Sawa {name}, ngoja nisave namba yako 😊',
      profilingNameCorrectionReply:
        config.profilingNameCorrectionReply ?? 'Ahaa basi powa nimekupata.',
      humanTimingEnabled: config.humanTimingEnabled === true,
      activeChatWaitMinMs:
        config.activeChatWaitMinMs ?? humanTimingPresetForStyle('fast').activeChatWaitMinMs,
      activeChatWaitMaxMs:
        config.activeChatWaitMaxMs ?? humanTimingPresetForStyle('fast').activeChatWaitMaxMs,
      warmChatWaitMinMs:
        config.warmChatWaitMinMs ?? humanTimingPresetForStyle('fast').warmChatWaitMinMs,
      warmChatWaitMaxMs:
        config.warmChatWaitMaxMs ?? humanTimingPresetForStyle('fast').warmChatWaitMaxMs,
      coldChatWaitMinMs:
        config.coldChatWaitMinMs ?? humanTimingPresetForStyle('fast').coldChatWaitMinMs,
      coldChatWaitMaxMs:
        config.coldChatWaitMaxMs ?? humanTimingPresetForStyle('fast').coldChatWaitMaxMs,
      burstPauseMinMs:
        config.burstPauseMinMs ?? humanTimingPresetForStyle('fast').coldBurstPauseMinMs,
      burstPauseMaxMs:
        config.burstPauseMaxMs ?? humanTimingPresetForStyle('fast').coldBurstPauseMaxMs,
      maxBurstWaitMs: config.maxBurstWaitMs ?? 30000,
      typingMinMs: config.typingMinMs ?? 1200,
      typingMaxMs: config.typingMaxMs ?? 14000,
      typingCharsPerSecondMin: config.typingCharsPerSecondMin ?? 18,
      typingCharsPerSecondMax: config.typingCharsPerSecondMax ?? 35,
      typingComplexityExtraMs: config.typingComplexityExtraMs ?? 2500,
      greetingRepeatCooldownMinutes: config.greetingRepeatCooldownMinutes ?? 240,
      presenceIntentEnabled: config.presenceIntentEnabled !== false,
      suspiciousNameConfirmationEnabled: config.suspiciousNameConfirmationEnabled !== false,
      autoReplyUseQuotedReply: config.autoReplyUseQuotedReply !== false,
      replyToBurstLatestMessage: config.replyToBurstLatestMessage !== false,
      noTypingDuringDebounce: config.noTypingDuringDebounce !== false,
      humanReplyStyle: config.humanReplyStyle ?? 'fast',
      aiUnrestrictedMode: config.aiUnrestrictedMode === true,
      autoReplyModelTier: config.autoReplyModelTier ?? 'cheap_fast',
      inboxAssistantModelTier: config.inboxAssistantModelTier ?? 'cheap_fast',
      trainingModelTier: config.trainingModelTier ?? 'balanced',
      adminAssistantModelTier: config.adminAssistantModelTier ?? 'balanced',
      allowPremiumModelForAutoReply: config.allowPremiumModelForAutoReply === true,
      aiDailyBudgetUsd: Number(config.aiDailyBudgetUsd ?? 1),
      aiMonthlyBudgetUsd: Number(config.aiMonthlyBudgetUsd ?? 20),
      autoReplyDailyBudgetUsd: Number(config.autoReplyDailyBudgetUsd ?? 0.5),
      stopAutoReplyWhenBudgetExceeded: config.stopAutoReplyWhenBudgetExceeded !== false,
      notifyAdminWhenBudgetAtPercent: config.notifyAdminWhenBudgetAtPercent ?? 80,
      allowAdminOverrideBudget: config.allowAdminOverrideBudget !== false,
      aiBudgetPaused: config.aiBudgetPaused === true,
      autoReplyPaused: config.autoReplyPaused === true,
      autoReplyContextMessagesMax: config.autoReplyContextMessagesMax ?? 5,
      autoReplyCooldownSeconds: config.autoReplyCooldownSeconds ?? 60,
      maxCustomerToolIterations: config.maxCustomerToolIterations ?? 2,
      maxAdminToolIterations: config.maxAdminToolIterations ?? 5,
      maxAiCallsPerInboundMessage: config.maxAiCallsPerInboundMessage ?? 2,
      includeCrmWhenNeeded: config.includeCrmWhenNeeded !== false,
      includeKnowledgeWhenNeeded: config.includeKnowledgeWhenNeeded !== false,
      includeCatalogWhenNeeded: config.includeCatalogWhenNeeded !== false,
      includeMemoryWhenNeeded: config.includeMemoryWhenNeeded !== false,
      ignoreDuplicateMessageIds: config.ignoreDuplicateMessageIds !== false,
      ignorePromotionalMessages: config.ignorePromotionalMessages !== false,
      messageBufferEnabled: config.messageBufferEnabled !== false,
      messageBufferDebounceSeconds: config.messageBufferDebounceSeconds ?? 10,
      messageBufferMaxWaitSeconds: config.messageBufferMaxWaitSeconds ?? 30,
      messageBufferMaxMessages: config.messageBufferMaxMessages ?? 10,
      messageBufferMaxCharacters: config.messageBufferMaxCharacters ?? 4000,
      oneReplyPerMessageBurst: config.oneReplyPerMessageBurst !== false,
      learnedReplyCacheEnabled: config.learnedReplyCacheEnabled !== false,
      autoLearnSafeIntents: config.autoLearnSafeIntents !== false,
      autoApproveConfidenceThreshold: config.autoApproveConfidenceThreshold ?? 90,
      pendingReviewThreshold: config.pendingReviewThreshold ?? 60,
      disableLearningForSensitive: config.disableLearningForSensitive !== false,
      replyVariationRotation: config.replyVariationRotation !== false,
      ignoreGroupMessages: config.ignoreGroupMessages !== false,
      ignoreSelfMessages: config.ignoreSelfMessages !== false,
      autoReplyPromptBudgetTokens: config.autoReplyPromptBudgetTokens ?? 1500,
      autoReplySimplePromptBudgetTokens: config.autoReplySimplePromptBudgetTokens ?? 500,
      knowledgeMaxChunks: config.knowledgeMaxChunks ?? 2,
      knowledgeMaxCharsPerChunk: config.knowledgeMaxCharsPerChunk ?? 600,
      knowledgeMaxTotalChars: config.knowledgeMaxTotalChars ?? 1200,
      updatedAt: config.updatedAt,
    };
  }

  async setAutoReplyEnabled(enabled: boolean) {
    const config = await this.ensureConfig();
    config.autoReplyEnabled = enabled;
    await this.configRepo.save(config);
    return this.get();
  }

  async setUnrestrictedMode(enabled: boolean) {
    const config = await this.ensureConfig();
    config.aiUnrestrictedMode = enabled;
    if (enabled) {
      config.autoReplyEnabled = true;
      config.humanTimingEnabled = false;
      config.autoReplyCooldownMinutes = 0;
      config.autoReplyOutsideHoursOnly = false;
    }
    await this.configRepo.save(config);
    if (enabled) {
      await this.applyUnrestrictedSafetySettings();
    }
    return this.get();
  }

  async upsert(dto: UpsertAiConfigDto) {
    const config = await this.ensureConfig();
    config.provider = dto.provider;
    config.model = dto.model;
    if (dto.baseUrl !== undefined) config.baseUrl = dto.baseUrl?.trim() || null;
    if (dto.systemPrompt !== undefined) config.systemPrompt = dto.systemPrompt;
    if (dto.temperature !== undefined) config.temperature = dto.temperature;
    if (dto.maxTokens !== undefined) config.maxTokens = dto.maxTokens;
    if (dto.enabled !== undefined) config.enabled = dto.enabled;
    if (dto.toolCallingEnabled !== undefined) config.toolCallingEnabled = dto.toolCallingEnabled;
    if (dto.autoReplyEnabled !== undefined) config.autoReplyEnabled = dto.autoReplyEnabled;
    if (dto.autoReplyPrivateOnly !== undefined) config.autoReplyPrivateOnly = dto.autoReplyPrivateOnly;
    if (dto.autoReplyCooldownMinutes !== undefined) {
      config.autoReplyCooldownMinutes = dto.autoReplyCooldownMinutes;
    }
    if (dto.autoReplyContextMessages !== undefined) {
      config.autoReplyContextMessages = dto.autoReplyContextMessages;
    }
    if (dto.autoReplyPrompt !== undefined) config.autoReplyPrompt = dto.autoReplyPrompt;
    if (dto.autoReplyTone !== undefined) config.autoReplyTone = dto.autoReplyTone?.trim() || null;
    if (dto.autoReplyPreset !== undefined) config.autoReplyPreset = dto.autoReplyPreset?.trim() || null;
    if (dto.autoReplyOutsideHoursOnly !== undefined) {
      config.autoReplyOutsideHoursOnly = dto.autoReplyOutsideHoursOnly;
    }
    if (dto.autoReplyTimezone !== undefined) config.autoReplyTimezone = dto.autoReplyTimezone?.trim() || null;
    if (dto.autoReplyStartHour !== undefined) config.autoReplyStartHour = dto.autoReplyStartHour;
    if (dto.autoReplyEndHour !== undefined) config.autoReplyEndHour = dto.autoReplyEndHour;
    if (dto.autoReplyWeekdays !== undefined) config.autoReplyWeekdays = dto.autoReplyWeekdays;
    if (dto.autoReplyOptOutMessage !== undefined) {
      config.autoReplyOptOutMessage = dto.autoReplyOptOutMessage?.trim() || null;
    }
    if (dto.disabledTools !== undefined) config.disabledTools = dto.disabledTools;
    if (dto.knowledgeRagEnabled !== undefined) config.knowledgeRagEnabled = dto.knowledgeRagEnabled;
    if (dto.memoryRagEnabled !== undefined) config.memoryRagEnabled = dto.memoryRagEnabled;
    if (dto.progressiveProfilingEnabled !== undefined) {
      config.progressiveProfilingEnabled = dto.progressiveProfilingEnabled;
    }
    if (dto.profilingMaxQuestionsPerReply !== undefined) {
      config.profilingMaxQuestionsPerReply = dto.profilingMaxQuestionsPerReply;
    }
    if (dto.profilingAutoSaveHighConfidenceNames !== undefined) {
      config.profilingAutoSaveHighConfidenceNames = dto.profilingAutoSaveHighConfidenceNames;
    }
    if (dto.profilingRequireReviewMediumConfidence !== undefined) {
      config.profilingRequireReviewMediumConfidence = dto.profilingRequireReviewMediumConfidence;
    }
    if (dto.profilingDetectNameCorrections !== undefined) {
      config.profilingDetectNameCorrections = dto.profilingDetectNameCorrections;
    }
    if (dto.profilingSilentSaveFields !== undefined) {
      config.profilingSilentSaveFields = dto.profilingSilentSaveFields;
    }
    if (dto.profilingCreateLostDemandFollowups !== undefined) {
      config.profilingCreateLostDemandFollowups = dto.profilingCreateLostDemandFollowups;
    }
    if (dto.profilingAskNameImmediately !== undefined) {
      config.profilingAskNameImmediately = dto.profilingAskNameImmediately;
    }
    if (dto.profilingDisabledInGroups !== undefined) {
      config.profilingDisabledInGroups = dto.profilingDisabledInGroups;
    }
    if (dto.profilingHighConfidenceThreshold !== undefined) {
      config.profilingHighConfidenceThreshold = dto.profilingHighConfidenceThreshold;
    }
    if (dto.profilingMediumConfidenceThreshold !== undefined) {
      config.profilingMediumConfidenceThreshold = dto.profilingMediumConfidenceThreshold;
    }
    if (dto.profilingNameSaveReplyTemplate !== undefined) {
      config.profilingNameSaveReplyTemplate = dto.profilingNameSaveReplyTemplate;
    }
    if (dto.profilingNameCorrectionReply !== undefined) {
      config.profilingNameCorrectionReply = dto.profilingNameCorrectionReply;
    }
    if (dto.humanTimingEnabled !== undefined) config.humanTimingEnabled = dto.humanTimingEnabled;
    if (dto.activeChatWaitMinMs !== undefined) config.activeChatWaitMinMs = dto.activeChatWaitMinMs;
    if (dto.activeChatWaitMaxMs !== undefined) config.activeChatWaitMaxMs = dto.activeChatWaitMaxMs;
    if (dto.warmChatWaitMinMs !== undefined) config.warmChatWaitMinMs = dto.warmChatWaitMinMs;
    if (dto.warmChatWaitMaxMs !== undefined) config.warmChatWaitMaxMs = dto.warmChatWaitMaxMs;
    if (dto.coldChatWaitMinMs !== undefined) config.coldChatWaitMinMs = dto.coldChatWaitMinMs;
    if (dto.coldChatWaitMaxMs !== undefined) config.coldChatWaitMaxMs = dto.coldChatWaitMaxMs;
    if (dto.burstPauseMinMs !== undefined) config.burstPauseMinMs = dto.burstPauseMinMs;
    if (dto.burstPauseMaxMs !== undefined) config.burstPauseMaxMs = dto.burstPauseMaxMs;
    if (dto.maxBurstWaitMs !== undefined) config.maxBurstWaitMs = dto.maxBurstWaitMs;
    if (dto.typingMinMs !== undefined) config.typingMinMs = dto.typingMinMs;
    if (dto.typingMaxMs !== undefined) config.typingMaxMs = dto.typingMaxMs;
    if (dto.typingCharsPerSecondMin !== undefined) {
      config.typingCharsPerSecondMin = dto.typingCharsPerSecondMin;
    }
    if (dto.typingCharsPerSecondMax !== undefined) {
      config.typingCharsPerSecondMax = dto.typingCharsPerSecondMax;
    }
    if (dto.typingComplexityExtraMs !== undefined) {
      config.typingComplexityExtraMs = dto.typingComplexityExtraMs;
    }
    if (dto.greetingRepeatCooldownMinutes !== undefined) {
      config.greetingRepeatCooldownMinutes = dto.greetingRepeatCooldownMinutes;
    }
    if (dto.presenceIntentEnabled !== undefined) {
      config.presenceIntentEnabled = dto.presenceIntentEnabled;
    }
    if (dto.suspiciousNameConfirmationEnabled !== undefined) {
      config.suspiciousNameConfirmationEnabled = dto.suspiciousNameConfirmationEnabled;
    }
    if (dto.autoReplyUseQuotedReply !== undefined) {
      config.autoReplyUseQuotedReply = dto.autoReplyUseQuotedReply;
    }
    if (dto.replyToBurstLatestMessage !== undefined) {
      config.replyToBurstLatestMessage = dto.replyToBurstLatestMessage;
    }
    if (dto.noTypingDuringDebounce !== undefined) {
      config.noTypingDuringDebounce = dto.noTypingDuringDebounce;
    }
    if (dto.humanReplyStyle !== undefined) {
      const style = (dto.humanReplyStyle?.trim() || 'fast') as HumanReplyStyle;
      config.humanReplyStyle = style;
      const preset = humanTimingPresetForStyle(style);
      config.activeChatWaitMinMs = preset.activeChatWaitMinMs;
      config.activeChatWaitMaxMs = preset.activeChatWaitMaxMs;
      config.warmChatWaitMinMs = preset.warmChatWaitMinMs;
      config.warmChatWaitMaxMs = preset.warmChatWaitMaxMs;
      config.coldChatWaitMinMs = preset.coldChatWaitMinMs;
      config.coldChatWaitMaxMs = preset.coldChatWaitMaxMs;
      config.burstPauseMinMs = preset.coldBurstPauseMinMs;
      config.burstPauseMaxMs = preset.coldBurstPauseMaxMs;
    }
    if (dto.aiUnrestrictedMode !== undefined) {
      config.aiUnrestrictedMode = dto.aiUnrestrictedMode;
    }
    if (dto.autoReplyModelTier !== undefined) config.autoReplyModelTier = dto.autoReplyModelTier;
    if (dto.inboxAssistantModelTier !== undefined) {
      config.inboxAssistantModelTier = dto.inboxAssistantModelTier;
    }
    if (dto.trainingModelTier !== undefined) config.trainingModelTier = dto.trainingModelTier;
    if (dto.adminAssistantModelTier !== undefined) {
      config.adminAssistantModelTier = dto.adminAssistantModelTier;
    }
    if (dto.allowPremiumModelForAutoReply !== undefined) {
      config.allowPremiumModelForAutoReply = dto.allowPremiumModelForAutoReply;
    }
    if (dto.aiDailyBudgetUsd !== undefined) config.aiDailyBudgetUsd = dto.aiDailyBudgetUsd;
    if (dto.aiMonthlyBudgetUsd !== undefined) config.aiMonthlyBudgetUsd = dto.aiMonthlyBudgetUsd;
    if (dto.autoReplyDailyBudgetUsd !== undefined) {
      config.autoReplyDailyBudgetUsd = dto.autoReplyDailyBudgetUsd;
    }
    if (dto.stopAutoReplyWhenBudgetExceeded !== undefined) {
      config.stopAutoReplyWhenBudgetExceeded = dto.stopAutoReplyWhenBudgetExceeded;
    }
    if (dto.notifyAdminWhenBudgetAtPercent !== undefined) {
      config.notifyAdminWhenBudgetAtPercent = dto.notifyAdminWhenBudgetAtPercent;
    }
    if (dto.allowAdminOverrideBudget !== undefined) {
      config.allowAdminOverrideBudget = dto.allowAdminOverrideBudget;
    }
    if (dto.autoReplyContextMessagesMax !== undefined) {
      config.autoReplyContextMessagesMax = dto.autoReplyContextMessagesMax;
    }
    if (dto.autoReplyCooldownSeconds !== undefined) {
      config.autoReplyCooldownSeconds = dto.autoReplyCooldownSeconds;
    }
    if (dto.maxCustomerToolIterations !== undefined) {
      config.maxCustomerToolIterations = dto.maxCustomerToolIterations;
    }
    if (dto.maxAdminToolIterations !== undefined) {
      config.maxAdminToolIterations = dto.maxAdminToolIterations;
    }
    if (dto.maxAiCallsPerInboundMessage !== undefined) {
      config.maxAiCallsPerInboundMessage = dto.maxAiCallsPerInboundMessage;
    }
    if (dto.includeCrmWhenNeeded !== undefined) config.includeCrmWhenNeeded = dto.includeCrmWhenNeeded;
    if (dto.includeKnowledgeWhenNeeded !== undefined) {
      config.includeKnowledgeWhenNeeded = dto.includeKnowledgeWhenNeeded;
    }
    if (dto.includeCatalogWhenNeeded !== undefined) {
      config.includeCatalogWhenNeeded = dto.includeCatalogWhenNeeded;
    }
    if (dto.includeMemoryWhenNeeded !== undefined) {
      config.includeMemoryWhenNeeded = dto.includeMemoryWhenNeeded;
    }
    if (dto.ignoreDuplicateMessageIds !== undefined) {
      config.ignoreDuplicateMessageIds = dto.ignoreDuplicateMessageIds;
    }
    if (dto.ignorePromotionalMessages !== undefined) {
      config.ignorePromotionalMessages = dto.ignorePromotionalMessages;
    }
    if (dto.messageBufferEnabled !== undefined) config.messageBufferEnabled = dto.messageBufferEnabled;
    if (dto.messageBufferDebounceSeconds !== undefined) {
      config.messageBufferDebounceSeconds = dto.messageBufferDebounceSeconds;
    }
    if (dto.messageBufferMaxWaitSeconds !== undefined) {
      config.messageBufferMaxWaitSeconds = dto.messageBufferMaxWaitSeconds;
    }
    if (dto.messageBufferMaxMessages !== undefined) {
      config.messageBufferMaxMessages = dto.messageBufferMaxMessages;
    }
    if (dto.messageBufferMaxCharacters !== undefined) {
      config.messageBufferMaxCharacters = dto.messageBufferMaxCharacters;
    }
    if (dto.oneReplyPerMessageBurst !== undefined) {
      config.oneReplyPerMessageBurst = dto.oneReplyPerMessageBurst;
    }
    if (dto.learnedReplyCacheEnabled !== undefined) {
      config.learnedReplyCacheEnabled = dto.learnedReplyCacheEnabled;
    }
    if (dto.autoLearnSafeIntents !== undefined) config.autoLearnSafeIntents = dto.autoLearnSafeIntents;
    if (dto.autoApproveConfidenceThreshold !== undefined) {
      config.autoApproveConfidenceThreshold = dto.autoApproveConfidenceThreshold;
    }
    if (dto.pendingReviewThreshold !== undefined) {
      config.pendingReviewThreshold = dto.pendingReviewThreshold;
    }
    if (dto.disableLearningForSensitive !== undefined) {
      config.disableLearningForSensitive = dto.disableLearningForSensitive;
    }
    if (dto.replyVariationRotation !== undefined) {
      config.replyVariationRotation = dto.replyVariationRotation;
    }
    if (dto.ignoreGroupMessages !== undefined) config.ignoreGroupMessages = dto.ignoreGroupMessages;
    if (dto.ignoreSelfMessages !== undefined) config.ignoreSelfMessages = dto.ignoreSelfMessages;
    if (dto.autoReplyPromptBudgetTokens !== undefined) {
      config.autoReplyPromptBudgetTokens = dto.autoReplyPromptBudgetTokens;
    }
    if (dto.autoReplySimplePromptBudgetTokens !== undefined) {
      config.autoReplySimplePromptBudgetTokens = dto.autoReplySimplePromptBudgetTokens;
    }
    if (dto.knowledgeMaxChunks !== undefined) config.knowledgeMaxChunks = dto.knowledgeMaxChunks;
    if (dto.knowledgeMaxCharsPerChunk !== undefined) {
      config.knowledgeMaxCharsPerChunk = dto.knowledgeMaxCharsPerChunk;
    }
    if (dto.knowledgeMaxTotalChars !== undefined) {
      config.knowledgeMaxTotalChars = dto.knowledgeMaxTotalChars;
    }
    if (dto.apiKey?.trim()) {
      config.apiKeyEncrypted = encryptAiSecret(dto.apiKey.trim());
      config.testStatus = null;
      config.testError = null;
    }
    await this.configRepo.save(config);
    if (isAiUnrestricted(config)) {
      await this.applyUnrestrictedSafetySettings();
    }
    return this.get();
  }

  /** Apply instant pacing and relaxed approval gates for unrestricted auto-reply. */
  async applyUnrestrictedSafetySettings(): Promise<void> {
    await this.safetySettings.updateGlobal({ ...AI_UNRESTRICTED_SAFETY_PATCH });
  }

  async clearApiKey() {
    const config = await this.ensureConfig();
    config.apiKeyEncrypted = null;
    config.testStatus = null;
    config.testError = null;
    await this.configRepo.save(config);
    return this.get();
  }

  async revealApiKey(): Promise<{
    apiKey: string | null;
    source: 'database' | 'environment' | null;
  }> {
    const config = await this.ensureConfig();
    const envKey = this.envKeyForProvider(config.provider);
    if (envKey) {
      return { apiKey: envKey, source: 'environment' };
    }
    if (!config.apiKeyEncrypted) {
      return { apiKey: null, source: null };
    }
    return { apiKey: decryptAiSecret(config.apiKeyEncrypted), source: 'database' };
  }

  async test() {
    const config = await this.ensureConfig();
    const apiKey = this.decryptKey(config);
    if (!apiKey) {
      return { ok: false, error: 'AI provider is not configured. Save an API key first.' };
    }
    const start = Date.now();
    const chain = [
      {
        provider: config.provider,
        model: this.pingModelForTest(config.provider, config.model),
        apiKey,
        baseUrl: config.baseUrl,
      },
      ...(await this.getResolvedFallbacks(config)),
    ];
    const seen = new Set<string>();
    const candidates = chain.filter(c => {
      const id = `${c.provider}:${c.model}:${c.apiKey.slice(0, 12)}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    let lastMessage = 'All AI providers failed. Check your API key and fallback models in Settings → Integrations → AI.';
    for (const candidate of candidates) {
      try {
        const reply = await this.pingProvider(
          candidate.provider as AiProvider,
          candidate.model,
          candidate.apiKey,
          candidate.baseUrl,
        );
        config.testStatus = 'ok';
        config.testError = null;
        await this.configRepo.save(config);
        return {
          ok: true,
          reply,
          latencyMs: Date.now() - start,
          testedProvider: candidate.provider,
          testedModel: candidate.model,
        };
      } catch (err: unknown) {
        const raw = err instanceof Error ? err.message : String(err);
        lastMessage = this.normalizeTestError(raw, candidate.provider as AiProvider);
      }
    }

    config.testStatus = 'error';
    config.testError = lastMessage;
    await this.configRepo.save(config);
    return { ok: false, error: lastMessage };
  }

  getProviderModels(provider: AiProvider): string[] {
    return PROVIDER_MODELS[provider] ?? [];
  }

  async getFallbacks() {
    const config = await this.ensureConfig();
    const raw = config.fallbackModels ?? [];
    const primaryKey = this.decryptKey(config);
    return raw.map(({ provider, model, baseUrl, apiKeyEncrypted }) => {
      const hasOwnKey = !!apiKeyEncrypted;
      const keyMaterial = hasOwnKey ? decryptAiSecret(apiKeyEncrypted!) : primaryKey;
      return {
        provider,
        model,
        baseUrl,
        apiKeySet: hasOwnKey || !!primaryKey,
        apiKeyHint: keyMaterial ? this.maskApiKeyHint(keyMaterial, hasOwnKey) : null,
      };
    });
  }

  async addFallback(entry: FallbackModelEntry) {
    const config = await this.ensureConfig();
    const existing = [...(config.fallbackModels ?? [])];
    if (existing.length >= 5) {
      throw new Error('Maximum 5 fallback models allowed');
    }
    existing.push({
      provider: entry.provider,
      model: entry.model,
      baseUrl: entry.baseUrl,
      apiKeyEncrypted: entry.apiKey?.trim()
        ? encryptAiSecret(entry.apiKey.trim())
        : undefined,
    });
    config.fallbackModels = existing;
    await this.configRepo.save(config);
  }

  async removeFallback(index: number) {
    const config = await this.ensureConfig();
    const existing = [...(config.fallbackModels ?? [])];
    existing.splice(index, 1);
    config.fallbackModels = existing;
    await this.configRepo.save(config);
  }

  async getActiveConfig(): Promise<AiConfig | null> {
    const config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (!config?.enabled || !this.decryptKey(config)) return null;
    return config;
  }

  decryptKey(config: AiConfig): string {
    const envKey = this.envKeyForProvider(config.provider);
    if (envKey) return envKey;
    if (!config.apiKeyEncrypted) return '';
    return decryptAiSecret(config.apiKeyEncrypted);
  }

  private envKeyForProvider(provider: AiProvider): string | null {
    const map: Partial<Record<AiProvider, string | undefined>> = {
      [AiProvider.ANTHROPIC]: process.env.ANTHROPIC_API_KEY,
      [AiProvider.OPENAI]: process.env.OPENAI_API_KEY,
      [AiProvider.GEMINI]: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
      [AiProvider.GROQ]: process.env.GROQ_API_KEY,
      [AiProvider.OPENROUTER]: process.env.OPENROUTER_API_KEY,
      [AiProvider.DEEPSEEK]: process.env.DEEPSEEK_API_KEY,
    };
    const key = map[provider]?.trim();
    return key || null;
  }

  private pingModelForTest(provider: AiProvider, configuredModel: string): string {
    switch (provider) {
      case AiProvider.ANTHROPIC:
      case AiProvider.OPENAI:
      case AiProvider.GEMINI:
        return pickModelForTier(provider, AiModelTier.CHEAP_FAST);
      default:
        return configuredModel;
    }
  }

  /** Filter tool list by global toggle, RAG/memory flags, and per-tool disabled list. */
  filterTools<T extends { name: string }>(tools: T[], config: AiConfig): T[] {
    if (!config.toolCallingEnabled) return [];
    const disabled = new Set(config.disabledTools ?? []);
    return tools.filter((t) => {
      if (disabled.has(t.name)) return false;
      if (config.knowledgeRagEnabled === false && t.name === 'search_shop_knowledge') return false;
      if (
        config.memoryRagEnabled === false &&
        (t.name.startsWith('memory_') || t.name === 'search_memory')
      ) {
        return false;
      }
      return true;
    });
  }

  private maskApiKeyHint(key: string, ownKey: boolean): string {
    const prefix = ownKey ? 'Active Key: ' : 'Primary Key: ';
    if (key.length <= 8) return `${prefix}••••••••`;
    return `${prefix}${key.slice(0, 3)}***${key.slice(-2)}`;
  }

  async getResolvedFallbacks(config: AiConfig): Promise<
    Array<{ provider: string; model: string; apiKey: string; baseUrl?: string | null }>
  > {
    const primaryKey = this.decryptKey(config);
    return (config.fallbackModels ?? []).map((f) => ({
      provider: f.provider,
      model: f.model,
      baseUrl: f.baseUrl ?? null,
      apiKey: f.apiKeyEncrypted ? decryptAiSecret(f.apiKeyEncrypted) : primaryKey,
    }));
  }

  private async ensureConfig(): Promise<AiConfig> {
    let config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (!config) {
      config = this.configRepo.create({
        id: AI_CONFIG_ID,
        provider: AiProvider.OPENAI,
        model: 'gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 4096,
        enabled: false,
        toolCallingEnabled: true,
        autoReplyEnabled: true,
        autoReplyPrivateOnly: true,
        autoReplyCooldownMinutes: 0,
        autoReplyContextMessages: 3,
        autoReplyPrompt: null,
        autoReplyOutsideHoursOnly: false,
        autoReplyTimezone: 'Africa/Dar_es_Salaam',
        autoReplyStartHour: 9,
        autoReplyEndHour: 17,
        autoReplyWeekdays: [1, 2, 3, 4, 5],
        disabledTools: [],
        knowledgeRagEnabled: true,
        memoryRagEnabled: true,
        humanTimingEnabled: false,
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
        typingCharsPerSecondMin: 18,
        typingCharsPerSecondMax: 35,
        typingComplexityExtraMs: 2500,
        greetingRepeatCooldownMinutes: 240,
        presenceIntentEnabled: true,
        suspiciousNameConfirmationEnabled: true,
        autoReplyUseQuotedReply: true,
        replyToBurstLatestMessage: true,
        noTypingDuringDebounce: true,
        humanReplyStyle: 'fast',
        aiUnrestrictedMode: true,
      });
      await this.configRepo.save(config);
    }
    return config;
  }

  private async pingProvider(
    provider: AiProvider,
    model: string,
    apiKey: string,
    baseUrl?: string | null,
  ): Promise<string> {
    switch (provider) {
      case AiProvider.GEMINI:
        return this.pingOpenAI(
          model,
          apiKey,
          'https://generativelanguage.googleapis.com/v1beta/openai',
        );
      case AiProvider.ANTHROPIC:
        return this.pingAnthropic(model, apiKey);
      case AiProvider.OPENAI:
        return this.pingOpenAI(model, apiKey);
      case AiProvider.OLLAMA:
        return this.pingOpenAI(model, apiKey, baseUrl ?? 'http://localhost:11434/v1');
      case AiProvider.CUSTOM:
        if (!baseUrl) throw new Error('baseUrl is required for CUSTOM provider');
        return this.pingOpenAI(model, apiKey, baseUrl);
      default: {
        const url = PROVIDER_BASE_URLS[provider];
        if (!url) throw new Error(`Unknown provider: ${provider}`);
        return this.pingOpenAI(model, apiKey, url);
      }
    }
  }

  private async pingOpenAI(
    model: string,
    apiKey: string,
    baseUrl = 'https://api.openai.com/v1',
  ): Promise<string> {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "pong" in one word.' }],
        max_tokens: 10,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(formatAiProviderError(res.status, body));
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? 'ok';
  }

  private async pingAnthropic(model: string, apiKey: string): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "pong" in one word.' }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(formatAiProviderError(res.status, body));
    }
    const json = (await res.json()) as { content?: Array<{ text?: string }> };
    return json.content?.[0]?.text ?? 'ok';
  }

  private normalizeTestError(raw: string, provider?: AiProvider): string {
    const statusMatch = raw.match(/(?:API|AI|Anthropic) error: (\d{3})\s*(.*)/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      const body = statusMatch[2] ?? '';
      return formatAiProviderError(status, body);
    }
    if (/fetch failed/i.test(raw) || /cannot reach/i.test(raw)) {
      return this.networkReachabilityHint(provider);
    }
    return raw.slice(0, 280);
  }

  private networkReachabilityHint(provider?: AiProvider): string {
    if (provider === AiProvider.ANTHROPIC) {
      return (
        'Cannot reach api.anthropic.com from this server (POST requests time out). ' +
        'Anthropic is often blocked on some networks. Switch to OpenAI, Gemini, or Groq, ' +
        'or use OpenRouter with model anthropic/claude-sonnet-4-6 and an OpenRouter API key.'
      );
    }
    if (provider === AiProvider.DEEPSEEK) {
      return (
        'Cannot reach api.deepseek.com from this server. Try OpenAI, Gemini, Groq, or OpenRouter instead.'
      );
    }
    return (
      'Cannot reach the AI provider (network timeout or blocked). ' +
      'Check internet/VPN/firewall or switch provider in Settings → Integrations → AI.'
    );
  }
}
