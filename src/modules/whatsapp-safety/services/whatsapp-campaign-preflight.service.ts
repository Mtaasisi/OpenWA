import { Injectable } from '@nestjs/common';
import { WhatsAppConsentService, WhatsAppServiceWindowService } from './whatsapp-consent.service';
import { WhatsAppPolicyGuardService } from './whatsapp-policy-guard.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { WhatsAppMessageType, WhatsAppSendSource } from '../enums/whatsapp-safety.enums';

export interface CampaignPreflightRecipient {
  phone: string;
  chatId: string;
  skipped: boolean;
  skipReason?: string;
  requiresTemplate?: boolean;
}

export interface CampaignPreflightResult {
  totalRecipients: number;
  optedInRecipients: number;
  blockedSkipped: number;
  outside24hCount: number;
  templateRequiredCount: number;
  estimatedSendMinutes: number;
  riskScore: number;
  launchAllowed: boolean;
  requiredFixes: string[];
  recipients: CampaignPreflightRecipient[];
}

@Injectable()
export class WhatsAppCampaignPreflightService {
  constructor(
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly consentService: WhatsAppConsentService,
    private readonly windowService: WhatsAppServiceWindowService,
    private readonly guard: WhatsAppPolicyGuardService,
  ) {}

  async preflight(params: {
    sessionId: string;
    recipients: Array<{ phone: string; chatId: string }>;
    messageBody: string;
    templateId?: string | null;
  }): Promise<CampaignPreflightResult> {
    const settings = await this.settingsService.getForSession(params.sessionId);
    const requiredFixes: string[] = [];
    let optedIn = 0;
    let blockedSkipped = 0;
    let outside24h = 0;
    let templateRequired = 0;
    let riskScore = 0;

    if (!settings.campaignsEnabled) {
      requiredFixes.push('Enable campaigns in WhatsApp Safety settings');
      riskScore += 50;
    }

    const recipientResults: CampaignPreflightRecipient[] = [];

    for (const r of params.recipients) {
      const consent = await this.consentService.findConsent(params.sessionId, r.phone);
      const window = await this.windowService.getCustomerServiceWindow(params.sessionId, r.phone);

      if (this.consentService.isOptedOut(consent)) {
        blockedSkipped += 1;
        recipientResults.push({ ...r, skipped: true, skipReason: 'opted_out' });
        continue;
      }

      if (!this.consentService.canSendMarketing(consent)) {
        blockedSkipped += 1;
        recipientResults.push({ ...r, skipped: true, skipReason: 'no_marketing_opt_in' });
        continue;
      }

      optedIn += 1;

      if (window.requiresTemplate) {
        outside24h += 1;
        if (!params.templateId) {
          templateRequired += 1;
          recipientResults.push({ ...r, skipped: false, requiresTemplate: true });
        } else {
          recipientResults.push({ ...r, skipped: false, requiresTemplate: true });
        }
      } else {
        recipientResults.push({ ...r, skipped: false, requiresTemplate: false });
      }
    }

    if (templateRequired > 0) {
      requiredFixes.push(`${templateRequired} recipients outside 24h window need approved template`);
      riskScore += 30;
    }

    if (blockedSkipped > params.recipients.length * 0.3) {
      requiredFixes.push('Too many recipients lack consent');
      riskScore += 20;
    }

    const sampleDecision = await this.guard.evaluate({
      sessionId: params.sessionId,
      chatId: params.recipients[0]?.chatId ?? '',
      phone: params.recipients[0]?.phone,
      messageType: WhatsAppMessageType.CAMPAIGN,
      source: WhatsAppSendSource.CAMPAIGN,
      body: params.messageBody,
      templateId: params.templateId,
    });

    if (!sampleDecision.allowed && sampleDecision.requiredAction === 'block') {
      requiredFixes.push(sampleDecision.reason);
      riskScore += 40;
    }

    const sendable = recipientResults.filter(r => !r.skipped).length;
    const estimatedSendMinutes = Math.ceil(
      (sendable * settings.minDelayBetweenMessagesMs) / 60000,
    );

    return {
      totalRecipients: params.recipients.length,
      optedInRecipients: optedIn,
      blockedSkipped,
      outside24hCount: outside24h,
      templateRequiredCount: templateRequired,
      estimatedSendMinutes,
      riskScore: Math.min(100, riskScore),
      launchAllowed: requiredFixes.length === 0 && settings.campaignsEnabled,
      requiredFixes,
      recipients: recipientResults,
    };
  }
}
