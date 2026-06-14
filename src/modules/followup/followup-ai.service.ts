import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AiChatService } from '../ai/ai-chat.service';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupRule } from './entities/followup-rule.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import { Message, MessageDirection } from '../message/entities/message.entity';
import {
  FollowUpCustomerMood,
  FollowUpDetectedReason,
  FollowUpRiskLevel,
  FollowUpSendChannel,
} from './followup.enums';
import {
  detectRiskFromText,
  mapStageToReason,
  mapTriggerToReason,
  reasonToRiskLevel,
} from './utils/followup-risk.util';
import { FollowupConversationService } from './followup-conversation.service';
import { renderTemplate, TemplateVariables } from './utils/template.util';
import { AiUsageFeature, AiUsageSource } from '../ai/cost/ai-cost.types';

export interface FollowupAiAnalysis {
  detectedReason: FollowUpDetectedReason;
  customerMood: FollowUpCustomerMood;
  intent: string;
  riskLevel: FollowUpRiskLevel;
  confidenceScore: number;
  suggestedChannel: FollowUpSendChannel;
  suggestedTemplateId: string | null;
  suggestedMessage: string;
  shouldAutoSend: boolean;
  shouldRequireApproval: boolean;
  stopReason?: string;
  originalCustomerMessage: string | null;
  lastStaffMessage: string | null;
}

@Injectable()
export class FollowupAiService {
  private readonly logger = new Logger(FollowupAiService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly aiChat: AiChatService,
    private readonly conversationService: FollowupConversationService,
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
  ) {}

  async analyze(params: {
    conv: FollowupConversation;
    rule: FollowupRule;
    template: FollowupMessageTemplate | null;
    variables: TemplateVariables;
  }): Promise<FollowupAiAnalysis> {
    const { conv, rule, template, variables } = params;
    const messages = await this.loadRecentMessages(conv.sessionId, conv.chatId, 12);
    const lastCustomer = [...messages].reverse().find(m => m.direction === MessageDirection.INCOMING);
    const lastStaff = [...messages].reverse().find(m => m.direction === MessageDirection.OUTGOING);
    const lastCustomerText = lastCustomer?.body ?? '';
    const lastStaffText = lastStaff?.body ?? '';

    const heuristicReason =
      mapTriggerToReason(rule.triggerEvent) !== FollowUpDetectedReason.UNKNOWN
        ? mapTriggerToReason(rule.triggerEvent)
        : mapStageToReason(conv.stage);

    let detectedReason = heuristicReason;
    let customerMood = FollowUpCustomerMood.NEUTRAL;
    let riskLevel = reasonToRiskLevel(heuristicReason);
    let confidenceScore = 0.65;

    if (lastCustomerText) {
      const textRisk = detectRiskFromText(lastCustomerText);
      if (textRisk === FollowUpRiskLevel.HIGH) {
        riskLevel = FollowUpRiskLevel.HIGH;
        detectedReason = FollowUpDetectedReason.COMPLAINT;
        customerMood = FollowUpCustomerMood.ANGRY;
      } else if (textRisk === FollowUpRiskLevel.MEDIUM) {
        riskLevel = FollowUpRiskLevel.MEDIUM;
      }
    }

    let suggestedMessage = '';
    let suggestedTemplateId = template?.id ?? rule.templateId ?? null;

    if (template) {
      suggestedMessage = renderTemplate(template.body, variables);
      if (template.smsBody) {
        // WhatsApp body is primary; SMS variant stored separately
      }
    }

    const config = await this.aiSettings.getActiveConfig();
    if (config && suggestedMessage) {
      try {
        const polished = await this.polishMessage(suggestedMessage, conv, lastCustomerText);
        if (polished) suggestedMessage = polished;
        confidenceScore = 0.82;
      } catch (err) {
        this.logger.debug(`AI polish skipped: ${String(err)}`);
      }
    }

    if (config && !suggestedMessage) {
      try {
        const aiResult = await this.runAiAnalysis(conv, rule, messages);
        if (aiResult) {
          detectedReason = aiResult.detectedReason ?? detectedReason;
          customerMood = aiResult.customerMood ?? customerMood;
          riskLevel = aiResult.riskLevel ?? riskLevel;
          confidenceScore = aiResult.confidenceScore ?? confidenceScore;
        }
      } catch (err) {
        this.logger.debug(`AI analysis fallback: ${String(err)}`);
      }
    }

    const shouldRequireApproval =
      riskLevel === FollowUpRiskLevel.HIGH ||
      riskLevel === FollowUpRiskLevel.MEDIUM ||
      riskLevel === FollowUpRiskLevel.BLOCKED;

    return {
      detectedReason,
      customerMood,
      intent: detectedReason,
      riskLevel,
      confidenceScore,
      suggestedChannel: (template?.channel as FollowUpSendChannel) ?? FollowUpSendChannel.WHATSAPP,
      suggestedTemplateId,
      suggestedMessage,
      shouldAutoSend: riskLevel === FollowUpRiskLevel.LOW && confidenceScore >= 0.7,
      shouldRequireApproval,
      originalCustomerMessage: lastCustomerText || null,
      lastStaffMessage: lastStaffText || null,
    };
  }

  isAiConfigured(): Promise<boolean> {
    return this.aiSettings.getActiveConfig().then(c => c !== null);
  }

  private async loadRecentMessages(sessionId: string, chatId: string, limit: number): Promise<Message[]> {
    return this.messageRepo.find({
      where: { sessionId, chatId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  private async polishMessage(
    rendered: string,
    conv: FollowupConversation,
    customerLast: string,
  ): Promise<string | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return null;

    const identity = await this.conversationService.resolveIdentityForThread(
      conv.sessionId,
      conv.chatId,
      conv,
    );

    const result = await this.aiChat.runAssistantWithTools({
      systemContent: [
        'You lightly polish a follow-up message for WhatsApp.',
        'Rules: keep all prices, amounts, dates, and commitments EXACTLY as in the template.',
        'Do not add new offers. Return ONLY the polished message text, no JSON.',
        `Customer name: ${identity.customerName ?? 'Customer'}`,
      ].join('\n'),
      thread: [
        { role: 'user', content: `Template message:\n${rendered}\n\nCustomer last said:\n${customerLast || '(no reply)'}` },
      ],
      tools: [],
      executeTool: async () => '',
      maxIterations: 1,
      maxTokens: 256,
      temperature: 0.3,
      callContext: {
        feature: AiUsageFeature.FOLLOWUP,
        source: AiUsageSource.BACKGROUND_JOB,
      },
    });
    return result.content?.trim() || null;
  }

  private async runAiAnalysis(
    conv: FollowupConversation,
    rule: FollowupRule,
    messages: Message[],
  ): Promise<Partial<FollowupAiAnalysis> | null> {
    const thread = messages
      .slice()
      .reverse()
      .map(m => ({
        role: (m.direction === MessageDirection.OUTGOING ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.body ?? '',
      }));

    const result = await this.aiChat.runAssistantWithTools({
      systemContent: [
        'Analyze this sales follow-up conversation. Reply with JSON only:',
        '{ "detectedReason": "asked_price|...", "customerMood": "interested|...", "riskLevel": "low|medium|high", "confidenceScore": 0.0-1.0 }',
        `Rule trigger: ${rule.triggerEvent}, stage: ${conv.stage}`,
      ].join('\n'),
      thread,
      tools: [],
      executeTool: async () => '',
      maxIterations: 1,
      maxTokens: 200,
      temperature: 0.2,
      callContext: {
        feature: AiUsageFeature.FOLLOWUP,
        source: AiUsageSource.BACKGROUND_JOB,
      },
    });

    if (!result.content) return null;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]) as Partial<FollowupAiAnalysis>;
      return parsed;
    } catch {
      return null;
    }
  }
}
