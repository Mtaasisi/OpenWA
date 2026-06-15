import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSettingsService } from '../ai-settings.service';
import { AiChatService } from '../ai-chat.service';
import { AiConversationFactsService } from './ai-conversation-facts.service';
import { AiUnknownMessageService } from './ai-unknown-message.service';
import {
  AiLearnedIntent,
  AiLearnedIntentStatus,
} from '../entities/ai-learned-intent.entity';
import { normalizeCustomerText } from './ai-text-normalizer.util';
import { detectCustomerIntent } from '../utils/ai-intent-detector.util';
import { AiCustomerIntent } from '../ai-signal.enums';
import {
  extractMessageBusinessFields,
  shouldExtractStructuredFields,
} from './ai-message-extraction.util';
import {
  AiUsageFeature,
  AiUsageSource,
  AiModelTier,
} from '../cost/ai-cost.types';

const SAFE_AUTO_LEARN_INTENTS = new Set([
  'greeting',
  'location_question',
  'delivery_question',
  'installment_question',
  'human_request',
]);

const SENSITIVE_INTENT_RE =
  /(complaint|refund|malalamiko|rudisha\s*pesa|payment\s*dispute|hasira|threat|legal)/i;

export type ClassifierFastPathResult =
  | { hit: true; reply: string; intent: string; confidence: number }
  | { hit: false };

interface ClassifierJson {
  intent?: string;
  meaning?: string;
  suggested_reply?: string;
  confidence?: number;
}

@Injectable()
export class AiIntentLearningService {
  private readonly logger = new Logger(AiIntentLearningService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly aiChat: AiChatService,
    private readonly conversationFacts: AiConversationFactsService,
    private readonly unknownMessages: AiUnknownMessageService,
    @InjectRepository(AiLearnedIntent, 'data')
    private readonly learnedRepo: Repository<AiLearnedIntent>,
  ) {}

  async extractAndPersistFacts(input: {
    conversationId: string;
    text: string;
    branchId?: string | null;
    contactId?: string | null;
    messageId?: string | null;
  }): Promise<void> {
    if (!shouldExtractStructuredFields(input.text)) return;

    const fields = extractMessageBusinessFields(input.text);
    if (fields.confidence < 20) return;

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const saves: Array<{ type: string; key: string; value: string }> = [];
    if (fields.budget) saves.push({ type: 'budget', key: 'amount', value: String(fields.budget) });
    if (fields.productType) saves.push({ type: 'product_interest', key: 'type', value: fields.productType });
    if (fields.useCase) saves.push({ type: 'use_case', key: 'primary', value: fields.useCase });
    if (fields.location) saves.push({ type: 'location', key: 'city', value: fields.location });
    if (fields.specs.length) {
      saves.push({ type: 'preferred_specs', key: 'list', value: fields.specs.join(', ') });
    }
    if (fields.deliveryNeed) {
      saves.push({ type: 'delivery_need', key: 'requested', value: 'yes' });
    }
    if (fields.installmentInterest) {
      saves.push({ type: 'installment_interest', key: 'requested', value: 'yes' });
    }

    for (const s of saves) {
      await this.conversationFacts.saveFact({
        conversationId: input.conversationId,
        factType: s.type,
        factKey: s.key,
        factValue: s.value,
        branchId: input.branchId,
        contactId: input.contactId,
        sourceMessageId: input.messageId,
        confidence: fields.confidence,
        expiresAt: s.type === 'budget' ? expires : null,
      });
    }
  }

  async maybeLearnFromPhrase(input: {
    phrase: string;
    suggestedReply: string;
    branchId?: string | null;
    conversationId?: string | null;
    messageId?: string | null;
    intentOverride?: string;
  }): Promise<void> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.learnedReplyCacheEnabled === false || config?.autoLearnSafeIntents === false) {
      return;
    }

    const text = input.phrase.trim();
    if (!text || text.length > 200 || SENSITIVE_INTENT_RE.test(text)) return;

    const detected = detectCustomerIntent(text);
    const intent = input.intentOverride ?? this.mapIntentToLearnedKey(detected);
    if (!intent || !SAFE_AUTO_LEARN_INTENTS.has(intent)) return;

    const normalizedPhrase = normalizeCustomerText(text);
    const existing = await this.learnedRepo.findOne({ where: { normalizedPhrase } });
    if (existing) return;

    const autoThreshold = config?.autoApproveConfidenceThreshold ?? 90;
    const status =
      autoThreshold <= 90
        ? AiLearnedIntentStatus.ACTIVE
        : AiLearnedIntentStatus.PENDING_REVIEW;

    await this.learnedRepo.save(
      this.learnedRepo.create({
        phrase: text,
        normalizedPhrase,
        intent,
        suggestedReply: input.suggestedReply.trim(),
        status,
        autoApproved: status === AiLearnedIntentStatus.ACTIVE,
        confidence: 92,
        branchId: input.branchId ?? null,
        createdFromMessageId: input.messageId ?? null,
        createdFromConversationId: input.conversationId ?? null,
        metadata: { source: 'auto_learn_safe' },
      }),
    );
  }

  async tryClassifierBeforeAgent(input: {
    text: string;
    branchId?: string | null;
    conversationId?: string | null;
    contactId?: string | null;
    messageId?: string | null;
  }): Promise<ClassifierFastPathResult> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.learnedReplyCacheEnabled === false) return { hit: false };
    if (SENSITIVE_INTENT_RE.test(input.text)) return { hit: false };

    const text = input.text.trim();
    if (!text || text.length > 120) return { hit: false };

    const detected = detectCustomerIntent(text);
    if (detected !== AiCustomerIntent.UNKNOWN) return { hit: false };

    const classified = await this.runCheapClassifier(input);
    if (!classified) return { hit: false };

    const { json, suggestedReply, confidence } = classified;
    const intent = json.intent?.trim();
    const reply = suggestedReply?.trim();
    const autoThreshold = config?.autoApproveConfidenceThreshold ?? 90;

    if (
      intent &&
      reply &&
      SAFE_AUTO_LEARN_INTENTS.has(intent) &&
      confidence >= autoThreshold
    ) {
      await this.maybeLearnFromPhrase({
        phrase: text,
        suggestedReply: reply,
        branchId: input.branchId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        intentOverride: intent,
      });
      return { hit: true, reply, intent, confidence };
    }

    const pendingThreshold = config?.pendingReviewThreshold ?? 60;
    if (confidence < pendingThreshold) {
      await this.unknownMessages.upsert({
        rawText: text,
        branchId: input.branchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        messageId: input.messageId,
        detectedIntent: intent ?? 'unknown',
        aiSuggestedReply: reply,
        confidence,
      });
    }

    return { hit: false };
  }

  async classifyAndQueueUnknown(input: {
    text: string;
    branchId?: string | null;
    conversationId?: string | null;
    contactId?: string | null;
    messageId?: string | null;
  }): Promise<void> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.learnedReplyCacheEnabled === false) return;
    if (SENSITIVE_INTENT_RE.test(input.text)) return;

    const detected = detectCustomerIntent(input.text);
    if (detected !== AiCustomerIntent.UNKNOWN) return;

    const normalized = normalizeCustomerText(input.text);
    if (normalized.length < 4) return;

    const classified = await this.runCheapClassifier(input);
    if (!classified) {
      await this.unknownMessages.upsert({
        rawText: input.text,
        branchId: input.branchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        messageId: input.messageId,
        detectedIntent: 'unknown',
        aiSuggestedReply: null,
        confidence: 55,
      });
      return;
    }

    const { json, suggestedReply, confidence } = classified;
    if (
      json.intent &&
      SAFE_AUTO_LEARN_INTENTS.has(json.intent) &&
      confidence >= (config?.autoApproveConfidenceThreshold ?? 90)
    ) {
      await this.maybeLearnFromPhrase({
        phrase: input.text,
        suggestedReply: suggestedReply ?? '',
        branchId: input.branchId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        intentOverride: json.intent,
      });
      return;
    }

    const pendingThreshold = config?.pendingReviewThreshold ?? 60;
    if (confidence < pendingThreshold) {
      await this.unknownMessages.upsert({
        rawText: input.text,
        branchId: input.branchId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        messageId: input.messageId,
        detectedIntent: json.intent ?? 'unknown',
        aiSuggestedReply: suggestedReply,
        confidence,
      });
    }
  }

  private async runCheapClassifier(input: {
    text: string;
    branchId?: string | null;
    contactId?: string | null;
    messageId?: string | null;
  }): Promise<{
    json: ClassifierJson;
    suggestedReply: string | null;
    confidence: number;
  } | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.disableLearningForSensitive === false) return null;

    const raw = await this.aiChat.completeStructuredPrompt(
      'Classify short customer WhatsApp message. Reply JSON only: {"intent":"greeting|location_question|delivery_question|installment_question|human_request|product_question|unknown","meaning":"brief","suggested_reply":"one short Swahili reply","confidence":0-100}',
      input.text.slice(0, 500),
      120,
      {
        feature: AiUsageFeature.LEARNED_REPLY_CLASSIFIER,
        source: AiUsageSource.BACKGROUND_JOB,
        tier: AiModelTier.CHEAP_FAST,
        branchId: input.branchId,
        conversationId: input.contactId ?? undefined,
        messageId: input.messageId ?? undefined,
      },
    );

    if (!raw) return null;

    try {
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim()) as ClassifierJson;
      return {
        json,
        suggestedReply: json.suggested_reply?.trim() ?? null,
        confidence: Number(json.confidence ?? 55),
      };
    } catch {
      return null;
    }
  }

  private mapIntentToLearnedKey(intent: AiCustomerIntent): string | null {
    switch (intent) {
      case AiCustomerIntent.GREETING:
      case AiCustomerIntent.PRESENCE:
        return 'greeting';
      case AiCustomerIntent.LOCATION_REQUEST:
        return 'location_question';
      case AiCustomerIntent.DELIVERY_REQUEST:
        return 'delivery_question';
      case AiCustomerIntent.INSTALLMENT_REQUEST:
        return 'installment_question';
      default:
        return null;
    }
  }
}
