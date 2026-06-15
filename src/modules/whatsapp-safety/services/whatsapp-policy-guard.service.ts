import { Injectable } from '@nestjs/common';
import { isInboxChat } from '../../../common/utils/inbox-chat.util';
import { isGroupChatId } from '../../followup/utils/followup-risk.util';
import {
  GuardRequiredAction,
  WhatsAppMessageType,
  WhatsAppOptInSource,
  WhatsAppRiskLevel,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';
import { analyzeMessageContent } from '../utils/whatsapp-content-safety.util';
import { isSafeExemptContent } from '../utils/safe-content-exempt.util';
import { hashMessageBody } from '../utils/message-body-hash.util';
import {
  classifyAiReplyDelay,
  computeAiReplyDelayMs,
} from '../utils/ai-reply-delay.util';
import { WhatsAppConsentService, WhatsAppServiceWindowService } from './whatsapp-consent.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';
import { WhatsAppSessionHealthService } from './whatsapp-session-health.service';
import { WhatsAppTemplateGuardService } from './whatsapp-template-guard.service';
import { WhatsAppWarmupService } from './whatsapp-warmup.service';

export interface GuardContext {
  sessionId: string;
  chatId: string;
  phone?: string | null;
  messageType: WhatsAppMessageType;
  source: WhatsAppSendSource;
  body?: string;
  templateId?: string | null;
  isManualStaffSend?: boolean;
  skipGuard?: boolean;
  aiConfidence?: number;
  isHighRiskIntent?: boolean;
  detectedIntent?: string | null;
  isGroup?: boolean;
  /** When true, allow immediate AI sends without delay/caps/approval. */
  aiUnrestrictedMode?: boolean;
}

export interface GuardDecision {
  allowed: boolean;
  reason: string;
  requiredAction: GuardRequiredAction;
  decision: 'allow' | 'delay' | 'queue' | 'require_admin_approval' | 'block' | 'require_template';
  riskLevel: WhatsAppRiskLevel;
  suggestedFix?: string;
  suggestedAction?: string;
  delayMs?: number;
  shouldCreateDashboardAlert?: boolean;
  shouldPauseAutomation?: boolean;
  guardChecks: Record<string, boolean | string | number>;
}

const AUTOMATED_SOURCES = new Set([
  WhatsAppSendSource.AI,
  WhatsAppSendSource.FOLLOWUP,
  WhatsAppSendSource.CAMPAIGN,
  WhatsAppSendSource.BULK,
  WhatsAppSendSource.PRODUCT_SEND,
]);

const MARKETING_TYPES = new Set([
  WhatsAppMessageType.CAMPAIGN,
  WhatsAppMessageType.MARKETING,
]);

function mapAction(action: GuardRequiredAction): GuardDecision['decision'] {
  switch (action) {
    case GuardRequiredAction.ALLOW:
      return 'allow';
    case GuardRequiredAction.DELAY:
      return 'delay';
    case GuardRequiredAction.QUEUE:
      return 'queue';
    case GuardRequiredAction.REQUIRE_APPROVAL:
      return 'require_admin_approval';
    case GuardRequiredAction.REQUIRE_TEMPLATE:
      return 'require_template';
    default:
      return 'block';
  }
}

@Injectable()
export class WhatsAppPolicyGuardService {
  constructor(
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly consentService: WhatsAppConsentService,
    private readonly windowService: WhatsAppServiceWindowService,
    private readonly templateGuard: WhatsAppTemplateGuardService,
    private readonly warmupService: WhatsAppWarmupService,
    private readonly healthService: WhatsAppSessionHealthService,
    private readonly auditService: WhatsAppSendAuditService,
  ) {}

  async evaluate(ctx: GuardContext): Promise<GuardDecision> {
    if (ctx.skipGuard) {
      return this.decision(true, 'Guard skipped (queue worker)', GuardRequiredAction.ALLOW, WhatsAppRiskLevel.LOW, {});
    }

    const checks: Record<string, boolean | string | number> = {};
    const settings = await this.settingsService.getForSession(ctx.sessionId);

    if (!settings.globalEnabled) {
      return this.block('WhatsApp safety guard is disabled globally', checks, WhatsAppRiskLevel.LOW);
    }

    checks.globalEnabled = true;

    if (await this.healthService.isAutomationPaused(ctx.sessionId)) {
      if (!ctx.isManualStaffSend) {
        return this.block(
          'Session automation is paused due to health alerts',
          checks,
          WhatsAppRiskLevel.HIGH,
          undefined,
          true,
        );
      }
    }

    if (await this.healthService.isStartupSafeMode(ctx.sessionId)) {
      const blockedBySafeMode =
        !ctx.aiUnrestrictedMode &&
        (AUTOMATED_SOURCES.has(ctx.source) || MARKETING_TYPES.has(ctx.messageType));
      if (blockedBySafeMode) {
        return this.block(
          'Startup safe mode — automated sends blocked',
          checks,
          WhatsAppRiskLevel.MEDIUM,
          'Wait for startup safe mode to complete',
        );
      }
    }

    if (!isInboxChat(ctx.chatId)) {
      return this.block('Cannot send to this chat type', checks, WhatsAppRiskLevel.HIGH);
    }

    if (isGroupChatId(ctx.chatId)) {
      checks.isGroup = true;
      if (
        ctx.messageType === WhatsAppMessageType.AI_AUTO_REPLY ||
        ctx.source === WhatsAppSendSource.AI
      ) {
        return this.block(
          'AI auto-reply is disabled in group chats (lead detection only)',
          checks,
          WhatsAppRiskLevel.MEDIUM,
        );
      }
      if (
        ctx.messageType === WhatsAppMessageType.PRODUCT_SEND &&
        !ctx.isManualStaffSend
      ) {
        return this.requireApproval(
          'Group product send requires manual staff confirmation',
          checks,
          WhatsAppRiskLevel.HIGH,
        );
      }
    }

    const phone = ctx.phone ?? ctx.chatId.replace(/@.*$/, '');
    const consent = await this.consentService.findConsent(ctx.sessionId, phone);
    checks.optInStatus = consent?.optInStatus ?? 'unknown';

    if (this.consentService.isOptedOut(consent)) {
      if (ctx.messageType !== WhatsAppMessageType.OPT_OUT_ACK) {
        return this.block(
          'Customer has opted out',
          checks,
          WhatsAppRiskLevel.HIGH,
          'Remove from campaign or follow-up lists',
          true,
        );
      }
    }

    const isAutomatedSource =
      AUTOMATED_SOURCES.has(ctx.source) ||
      ctx.messageType === WhatsAppMessageType.AI_AUTO_REPLY ||
      ctx.messageType === WhatsAppMessageType.FOLLOW_UP ||
      ctx.messageType === WhatsAppMessageType.CAMPAIGN;

    if (isAutomatedSource && !ctx.isManualStaffSend) {
      const customerInitiated =
        Boolean(consent?.lastUserMessageAt) ||
        consent?.optInSource === WhatsAppOptInSource.CUSTOMER_INITIATED;
      checks.customerInitiated = customerInitiated;
      if (!customerInitiated) {
        return this.block(
          'Automated send blocked — customer has not initiated conversation',
          checks,
          WhatsAppRiskLevel.HIGH,
          'Wait for customer to message first',
          true,
        );
      }
    }

    if (MARKETING_TYPES.has(ctx.messageType) || ctx.source === WhatsAppSendSource.CAMPAIGN) {
      if (!settings.campaignsEnabled) {
        return this.block(
          'WhatsApp campaigns are disabled in safety settings',
          checks,
          WhatsAppRiskLevel.HIGH,
          'Enable campaigns in Settings → WhatsApp Safety',
        );
      }
      if (!this.consentService.canSendMarketing(consent)) {
        return this.block('Marketing requires explicit opt-in', checks, WhatsAppRiskLevel.HIGH);
      }
      const campaignHourly = await this.auditService.countCampaignSendsInLastHour(ctx.sessionId);
      const campaignDaily = await this.auditService.countCampaignSendsToday(ctx.sessionId);
      checks.campaignSendsLastHour = campaignHourly;
      checks.campaignSendsToday = campaignDaily;
      if (campaignHourly >= settings.maxCampaignMessagesPerHour) {
        return this.queue('Campaign hourly limit reached — queued', checks, WhatsAppRiskLevel.MEDIUM);
      }
      if (campaignDaily >= settings.maxCampaignMessagesPerDay) {
        return this.block('Campaign daily limit reached', checks, WhatsAppRiskLevel.HIGH);
      }
    }

    if (ctx.messageType === WhatsAppMessageType.FOLLOW_UP && ctx.source === WhatsAppSendSource.FOLLOWUP) {
      if (!settings.followupAutoSendEnabled && !ctx.isManualStaffSend) {
        return this.requireApproval('Follow-up auto-send is disabled', checks, WhatsAppRiskLevel.MEDIUM);
      }
      if (!this.consentService.canSendFollowup(consent)) {
        return this.block('Customer cannot receive follow-ups', checks, WhatsAppRiskLevel.HIGH);
      }
      if (!ctx.isManualStaffSend && consent?.lastUserMessageAt && consent.lastOutboundMessageAt) {
        if (consent.lastOutboundMessageAt > consent.lastUserMessageAt) {
          return this.block(
            'Follow-up blocked — customer has not replied since last outbound',
            checks,
            WhatsAppRiskLevel.MEDIUM,
          );
        }
      }
    }

    if (ctx.messageType === WhatsAppMessageType.AI_AUTO_REPLY) {
      if (!settings.aiAutoReplyEnabled || !settings.aiSafetyEnabled) {
        return this.block('AI auto-reply is disabled in safety settings', checks, WhatsAppRiskLevel.MEDIUM);
      }
      if (ctx.aiUnrestrictedMode) {
        return this.decision(true, 'Unrestricted AI auto-reply allowed', GuardRequiredAction.ALLOW, WhatsAppRiskLevel.LOW, checks);
      }
      if (ctx.aiConfidence != null && ctx.aiConfidence < 0.6) {
        return this.requireApproval(
          'AI confidence too low for auto-send',
          checks,
          WhatsAppRiskLevel.HIGH,
          'Escalate to staff',
        );
      }
      if (ctx.isHighRiskIntent && settings.riskyIntentRequiresApproval) {
        return this.requireApproval(
          'High-risk conversation — AI auto-reply blocked',
          checks,
          WhatsAppRiskLevel.CRITICAL,
          'Review and send manually',
          true,
        );
      }
      const aiCount = await this.auditService.countAutoRepliesTodayForContact(ctx.sessionId, ctx.chatId);
      checks.aiRepliesToday = aiCount;
      if (aiCount >= settings.maxAutoRepliesPerCustomerPerDay) {
        return this.block('Max AI replies per customer per day reached', checks, WhatsAppRiskLevel.MEDIUM);
      }
      const aiHourly = await this.auditService.countAutoRepliesInLastHour(ctx.sessionId);
      checks.aiRepliesLastHour = aiHourly;
      if (aiHourly >= settings.maxAutoRepliesPerHour) {
        return this.queue('AI hourly reply limit reached — queued', checks, WhatsAppRiskLevel.MEDIUM);
      }
    }

    if (ctx.source === WhatsAppSendSource.BULK && !settings.productBulkSendEnabled) {
      return this.requireApproval('Bulk send requires admin approval', checks, WhatsAppRiskLevel.HIGH);
    }

    const window = await this.windowService.getCustomerServiceWindow(ctx.sessionId, phone);
    checks.within24h = window.within24h;
    checks.requiresTemplate = window.requiresTemplate;

    if (window.requiresTemplate && settings.outside24hRequiresTemplate) {
      if (!ctx.isManualStaffSend || AUTOMATED_SOURCES.has(ctx.source)) {
        const templateCheck = await this.templateGuard.validateOutsideWindow(ctx.templateId);
        if (!templateCheck.ok) {
          return {
            allowed: false,
            reason: templateCheck.reason,
            requiredAction: GuardRequiredAction.REQUIRE_TEMPLATE,
            decision: 'require_template',
            riskLevel: WhatsAppRiskLevel.HIGH,
            suggestedFix: 'Use an approved WhatsApp template or wait for customer reply',
            guardChecks: checks,
          };
        }
      }
    }

    if (settings.warmupEnabled) {
      const warmup = await this.warmupService.getWarmup(ctx.sessionId);
      await this.warmupService.advanceDayIfNeeded(ctx.sessionId);
      const warmupCheck = this.warmupService.checkWarmupAllows({
        warmup,
        messageType: ctx.messageType,
        isManualStaffSend: ctx.isManualStaffSend,
      });
      checks.warmup = warmupCheck.reason;
      if (!warmupCheck.allowed) {
        return this.block(warmupCheck.reason, checks, WhatsAppRiskLevel.MEDIUM);
      }
    }

    const hourly = await this.auditService.countSendsInLastHour(ctx.sessionId);
    const daily = await this.auditService.countSendsToday(ctx.sessionId);
    checks.sendsLastHour = hourly;
    checks.sendsToday = daily;

    if (hourly >= settings.maxOutboundPerHour) {
      return this.queue('Hourly send limit reached — queued', checks, WhatsAppRiskLevel.MEDIUM);
    }
    if (daily >= settings.maxOutboundPerDay) {
      return this.queue('Daily send limit reached — queued', checks, WhatsAppRiskLevel.MEDIUM);
    }

    if (ctx.body && !isSafeExemptContent(ctx.body)) {
      const content = analyzeMessageContent(ctx.body);
      checks.contentFlags = content.flags.join(',');
      if (!content.safe && !ctx.isManualStaffSend) {
        return this.requireApproval(
          `Content flagged: ${content.flags.join(', ')}`,
          checks,
          WhatsAppRiskLevel.HIGH,
        );
      }
    }

    if (ctx.body && !ctx.isManualStaffSend) {
      const dupCount = await this.auditService.countRecentIdenticalBody(
        ctx.sessionId,
        ctx.body,
        24,
      );
      checks.duplicateBodyCount24h = dupCount;
      if (dupCount >= 5) {
        return this.requireApproval(
          'Same message sent to many contacts recently',
          checks,
          WhatsAppRiskLevel.HIGH,
          'Vary message or get admin approval',
        );
      }
    }

    if (isAutomatedSource && !ctx.isManualStaffSend) {
      if (ctx.messageType === WhatsAppMessageType.AI_AUTO_REPLY) {
        if (settings.minAiReplyDelayMs === 0) {
          return this.queue('Automated send queued for safe delivery', checks, WhatsAppRiskLevel.LOW);
        }
        const category = classifyAiReplyDelay({
          messageType: ctx.messageType,
          body: ctx.body,
          detectedIntent: ctx.detectedIntent,
        });
        const delayMs = computeAiReplyDelayMs(
          category,
          settings.minAiReplyDelayMs,
          settings.maxAiReplyDelayMs,
        );
        return this.delay(
          'AI reply delayed for human-like pacing',
          checks,
          WhatsAppRiskLevel.LOW,
          delayMs,
        );
      }
      return this.queue('Automated send queued for safe delivery', checks, WhatsAppRiskLevel.LOW);
    }

    return this.decision(true, 'Send allowed', GuardRequiredAction.ALLOW, WhatsAppRiskLevel.LOW, checks);
  }

  private decision(
    allowed: boolean,
    reason: string,
    action: GuardRequiredAction,
    risk: WhatsAppRiskLevel,
    checks: Record<string, boolean | string | number>,
    suggestedFix?: string,
    shouldCreateDashboardAlert?: boolean,
    delayMs?: number,
  ): GuardDecision {
    return {
      allowed,
      reason,
      requiredAction: action,
      decision: mapAction(action),
      riskLevel: risk,
      suggestedFix,
      suggestedAction: suggestedFix,
      delayMs,
      shouldCreateDashboardAlert,
      guardChecks: checks,
    };
  }

  private block(
    reason: string,
    checks: Record<string, boolean | string | number>,
    risk: WhatsAppRiskLevel,
    suggestedFix?: string,
    shouldCreateDashboardAlert?: boolean,
  ): GuardDecision {
    return this.decision(
      false,
      reason,
      GuardRequiredAction.BLOCK,
      risk,
      checks,
      suggestedFix,
      shouldCreateDashboardAlert,
    );
  }

  private queue(
    reason: string,
    checks: Record<string, boolean | string | number>,
    risk: WhatsAppRiskLevel,
  ): GuardDecision {
    return this.decision(false, reason, GuardRequiredAction.QUEUE, risk, checks);
  }

  private delay(
    reason: string,
    checks: Record<string, boolean | string | number>,
    risk: WhatsAppRiskLevel,
    delayMs: number,
  ): GuardDecision {
    return this.decision(false, reason, GuardRequiredAction.DELAY, risk, checks, undefined, false, delayMs);
  }

  private requireApproval(
    reason: string,
    checks: Record<string, boolean | string | number>,
    risk: WhatsAppRiskLevel,
    suggestedFix?: string,
    shouldCreateDashboardAlert?: boolean,
  ): GuardDecision {
    return this.decision(
      false,
      reason,
      GuardRequiredAction.REQUIRE_APPROVAL,
      risk,
      checks,
      suggestedFix,
      shouldCreateDashboardAlert,
    );
  }
}

export { hashMessageBody } from '../utils/message-body-hash.util';
