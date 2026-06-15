import { Injectable, Logger } from '@nestjs/common';
import { isGroupChatId } from '../../followup/utils/followup-risk.util';
import { WhatsAppWarmupStatus } from '../enums/whatsapp-safety.enums';
import { isSafeExemptContent } from '../utils/safe-content-exempt.util';
import { WhatsAppConsentService } from './whatsapp-consent.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { WhatsAppSessionHealthService } from './whatsapp-session-health.service';
import { WhatsAppWarmupService } from './whatsapp-warmup.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';

export enum AiSendPermission {
  ALLOW_SEND = 'ALLOW_SEND',
  QUEUE_WITH_DELAY = 'QUEUE_WITH_DELAY',
  REQUIRE_ADMIN_APPROVAL = 'REQUIRE_ADMIN_APPROVAL',
  BLOCK_SEND = 'BLOCK_SEND',
}

export interface AiSendPermissionInput {
  sessionId: string;
  chatId: string;
  proposedReply: string;
  aiConfidence?: number;
  isHighRiskIntent?: boolean;
  detectedIntent?: string | null;
  isGroup?: boolean;
  recentMessages?: Array<{ direction: string; body?: string | null }>;
  customerLastInboundAt?: Date | null;
  customerLastOutboundAt?: Date | null;
  isOptedOut?: boolean;
  /** When true, bypass caps, approval gates, and pacing delays. */
  aiUnrestrictedMode?: boolean;
}

export interface AiSendPermissionResult {
  permission: AiSendPermission;
  reason: string;
  delayMs?: number;
  suggestedStaffReply?: string;
}

const RISKY_INTENTS = new Set([
  'refund',
  'warranty',
  'payment_dispute',
  'angry',
  'second_discount',
  'legal',
  'damaged_product',
  'unknown_question',
  'high_value_negotiation',
  'group_message',
]);

@Injectable()
export class AiSendPermissionService {
  private readonly logger = new Logger(AiSendPermissionService.name);

  constructor(
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly consentService: WhatsAppConsentService,
    private readonly healthService: WhatsAppSessionHealthService,
    private readonly warmupService: WhatsAppWarmupService,
    private readonly auditService: WhatsAppSendAuditService,
  ) {}

  async evaluate(input: AiSendPermissionInput): Promise<AiSendPermissionResult> {
    if (input.aiUnrestrictedMode) {
      if (input.isOptedOut) {
        return {
          permission: AiSendPermission.BLOCK_SEND,
          reason: 'Customer opted out of AI messages',
        };
      }
      return {
        permission: AiSendPermission.ALLOW_SEND,
        reason: 'Unrestricted AI auto-reply',
      };
    }

    const settings = await this.settingsService.getForSession(input.sessionId);

    if (!settings.aiSafetyEnabled || !settings.aiAutoReplyEnabled) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'AI safety or auto-reply disabled in settings',
      };
    }

    if (input.isOptedOut) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Customer opted out of AI messages',
      };
    }

    if (input.isGroup || isGroupChatId(input.chatId)) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Group AI auto-reply is blocked',
      };
    }

    if (await this.healthService.isStartupSafeMode(input.sessionId)) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Session just linked — AI auto-reply paused briefly',
      };
    }

    if (await this.healthService.isAutomationPaused(input.sessionId)) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Session automation paused due to health alerts',
      };
    }

    const phone = input.chatId.replace(/@.*$/, '');
    const consent = await this.consentService.findConsent(input.sessionId, phone);
    if (this.consentService.isOptedOut(consent)) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Customer opted out',
      };
    }

    if (!consent?.lastUserMessageAt && !input.customerLastInboundAt) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Customer has not initiated conversation',
      };
    }

    if (settings.warmupEnabled) {
      const warmup = await this.warmupService.getWarmup(input.sessionId);
      if (warmup?.status === WhatsAppWarmupStatus.PAUSED) {
        return {
          permission: AiSendPermission.BLOCK_SEND,
          reason: 'Account warm-up is paused',
        };
      }
      if (
        warmup &&
        warmup.status === WhatsAppWarmupStatus.ACTIVE &&
        warmup.autoReplySentToday >= warmup.maxAutoRepliesToday
      ) {
        return {
          permission: AiSendPermission.BLOCK_SEND,
          reason: 'Warm-up daily AI reply limit reached',
        };
      }
    }

    const aiCount = await this.auditService.countAutoRepliesTodayForContact(
      input.sessionId,
      input.chatId,
    );
    if (aiCount >= settings.maxAutoRepliesPerCustomerPerDay) {
      return {
        permission: AiSendPermission.BLOCK_SEND,
        reason: 'Max AI replies per customer per day reached',
      };
    }

    const intent = (input.detectedIntent ?? '').toLowerCase();
    if (input.isHighRiskIntent || RISKY_INTENTS.has(intent)) {
      if (settings.riskyIntentRequiresApproval) {
        return {
          permission: AiSendPermission.REQUIRE_ADMIN_APPROVAL,
          reason: `Risky intent detected: ${intent || 'high_risk'}`,
          suggestedStaffReply: input.proposedReply,
        };
      }
    }

    if (intent === 'unknown_question' && settings.unknownQuestionRequiresApproval) {
      return {
        permission: AiSendPermission.REQUIRE_ADMIN_APPROVAL,
        reason: 'Unknown question — staff review required',
        suggestedStaffReply: input.proposedReply,
      };
    }

    if (input.aiConfidence != null && input.aiConfidence < 0.6) {
      return {
        permission: AiSendPermission.REQUIRE_ADMIN_APPROVAL,
        reason: 'AI confidence too low for auto-send',
        suggestedStaffReply: input.proposedReply,
      };
    }

    if (isSafeExemptContent(input.proposedReply)) {
      return {
        permission: AiSendPermission.ALLOW_SEND,
        reason: 'Safe profile/opt-out template reply',
      };
    }

    const replyLen = input.proposedReply.trim().length;
    const delayMs =
      replyLen > 280
        ? settings.minAiReplyDelayMs + Math.floor((settings.maxAiReplyDelayMs - settings.minAiReplyDelayMs) * 0.7)
        : settings.minAiReplyDelayMs + Math.floor(Math.random() * (settings.maxAiReplyDelayMs - settings.minAiReplyDelayMs) * 0.4);

    return {
      permission: AiSendPermission.QUEUE_WITH_DELAY,
      reason: 'AI reply queued with human-like delay',
      delayMs,
    };
  }
}
