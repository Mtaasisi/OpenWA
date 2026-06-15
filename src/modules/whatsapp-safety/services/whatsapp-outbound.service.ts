import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  GuardRequiredAction,
  WhatsAppMessageType,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';
import { WhatsAppPolicyGuardService, type GuardContext } from './whatsapp-policy-guard.service';
import { WhatsAppSendQueueService } from './whatsapp-send-queue.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';
import { WhatsAppSessionHealthService } from './whatsapp-session-health.service';

export interface OutboundCheckResult {
  proceed: boolean;
  queued: boolean;
  blocked: boolean;
  reason: string;
  queueItemId?: string;
}

export interface OutboundSafetyOptions {
  messageType?: WhatsAppMessageType;
  source?: WhatsAppSendSource;
  templateId?: string | null;
  isManualStaffSend?: boolean;
  skipGuard?: boolean;
  aiConfidence?: number;
  isHighRiskIntent?: boolean;
  detectedIntent?: string | null;
  actorStaffId?: string;
  mediaUrls?: string[] | null;
  mediaPayload?: Record<string, unknown> | null;
  aiUnrestrictedMode?: boolean;
}

@Injectable()
export class WhatsAppOutboundService {
  private readonly logger = new Logger(WhatsAppOutboundService.name);

  constructor(
    private readonly guard: WhatsAppPolicyGuardService,
    private readonly queueService: WhatsAppSendQueueService,
    private readonly auditService: WhatsAppSendAuditService,
    private readonly healthService: WhatsAppSessionHealthService,
  ) {}

  resolveMessageType(options?: OutboundSafetyOptions): WhatsAppMessageType {
    if (options?.messageType) return options.messageType;
    if (options?.source === WhatsAppSendSource.AI) return WhatsAppMessageType.AI_AUTO_REPLY;
    if (options?.source === WhatsAppSendSource.FOLLOWUP) return WhatsAppMessageType.FOLLOW_UP;
    if (options?.source === WhatsAppSendSource.CAMPAIGN) return WhatsAppMessageType.CAMPAIGN;
    if (options?.source === WhatsAppSendSource.PRODUCT_SEND) return WhatsAppMessageType.PRODUCT_SEND;
    if (options?.source === WhatsAppSendSource.TESTER) return WhatsAppMessageType.TEST_MESSAGE;
    if (options?.isManualStaffSend) return WhatsAppMessageType.MANUAL;
    return WhatsAppMessageType.CUSTOMER_REPLY;
  }

  resolveSource(options?: OutboundSafetyOptions): WhatsAppSendSource {
    return options?.source ?? (options?.isManualStaffSend ? WhatsAppSendSource.MANUAL : WhatsAppSendSource.API);
  }

  async checkBeforeSend(params: {
    sessionId: string;
    chatId: string;
    body: string;
    options?: OutboundSafetyOptions;
  }): Promise<OutboundCheckResult> {
    return this.runGuard({
      sessionId: params.sessionId,
      chatId: params.chatId,
      body: params.body,
      options: params.options,
    });
  }

  async checkBeforeMediaSend(params: {
    sessionId: string;
    chatId: string;
    caption?: string;
    options?: OutboundSafetyOptions;
  }): Promise<OutboundCheckResult> {
    return this.runGuard({
      sessionId: params.sessionId,
      chatId: params.chatId,
      body: params.caption ?? '[media]',
      options: params.options,
    });
  }

  private async runGuard(params: {
    sessionId: string;
    chatId: string;
    body: string;
    options?: OutboundSafetyOptions;
  }): Promise<OutboundCheckResult> {
    const { sessionId, chatId, body, options } = params;

    if (options?.skipGuard) {
      return { proceed: true, queued: false, blocked: false, reason: 'Guard skipped' };
    }

    const ctx: GuardContext = {
      sessionId,
      chatId,
      phone: chatId.replace(/@.*$/, ''),
      messageType: this.resolveMessageType(options),
      source: this.resolveSource(options),
      body,
      templateId: options?.templateId,
      isManualStaffSend: options?.isManualStaffSend,
      aiConfidence: options?.aiConfidence,
      isHighRiskIntent: options?.isHighRiskIntent,
      detectedIntent: options?.detectedIntent,
      aiUnrestrictedMode: options?.aiUnrestrictedMode,
    };

    const decision = await this.guard.evaluate(ctx);

    if (decision.requiredAction === GuardRequiredAction.BLOCK) {
      await this.auditService.log({
        sessionId,
        chatId,
        phone: ctx.phone,
        source: ctx.source,
        messageType: ctx.messageType,
        decision: WhatsAppSendAuditDecision.BLOCKED,
        reason: decision.reason,
        guardDecision: decision,
        riskLevel: decision.riskLevel,
        body,
      });
      await this.healthService.recordSendBlocked(sessionId, decision.reason);
      if (decision.shouldPauseAutomation) {
        await this.healthService.pauseAutomation(sessionId, decision.reason);
      }
      return { proceed: false, queued: false, blocked: true, reason: decision.reason };
    }

    if (
      decision.requiredAction === GuardRequiredAction.QUEUE ||
      decision.requiredAction === GuardRequiredAction.REQUIRE_APPROVAL ||
      decision.requiredAction === GuardRequiredAction.DELAY
    ) {
      const scheduledAt = decision.delayMs
        ? new Date(Date.now() + decision.delayMs)
        : new Date();
      const item = await this.queueService.enqueue({
        sessionId,
        chatId,
        phone: ctx.phone,
        messageType: ctx.messageType,
        source: ctx.source,
        messageBody: body,
        templateId: options?.templateId,
        mediaUrls: options?.mediaUrls ?? null,
        payload: options?.mediaPayload ?? null,
        guardDecision: decision,
        createdBy: options?.actorStaffId ?? null,
        scheduledAt,
      });
      await this.auditService.log({
        sessionId,
        chatId,
        phone: ctx.phone,
        source: ctx.source,
        messageType: ctx.messageType,
        decision:
          decision.requiredAction === GuardRequiredAction.REQUIRE_APPROVAL
            ? WhatsAppSendAuditDecision.APPROVAL_REQUIRED
            : decision.requiredAction === GuardRequiredAction.DELAY
              ? WhatsAppSendAuditDecision.DELAYED
              : WhatsAppSendAuditDecision.QUEUED,
        reason: decision.reason,
        guardDecision: decision,
        queueItemId: item.id,
        riskLevel: decision.riskLevel,
        body,
      });
      return {
        proceed: false,
        queued: true,
        blocked: false,
        reason: decision.reason,
        queueItemId: item.id,
      };
    }

    await this.auditService.log({
      sessionId,
      chatId,
      phone: ctx.phone,
      source: ctx.source,
      messageType: ctx.messageType,
      decision: WhatsAppSendAuditDecision.ALLOWED,
      reason: decision.reason,
      guardDecision: decision,
      riskLevel: decision.riskLevel,
      body,
    });

    return { proceed: true, queued: false, blocked: false, reason: decision.reason };
  }

  assertCanSend(check: OutboundCheckResult): void {
    if (check.blocked) {
      throw new BadRequestException(`WhatsApp send blocked: ${check.reason}`);
    }
    if (check.queued) {
      throw new BadRequestException(`WhatsApp send queued for safe delivery: ${check.reason}`);
    }
  }
}
