import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupMessageTemplate } from '../../followup/entities/followup-message-template.entity';
import {
  WhatsAppMessageType,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';
import { WhatsAppOutboundService } from './whatsapp-outbound.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';
import { WhatsAppTemplateGuardService } from './whatsapp-template-guard.service';

const GRAPH_API_VERSION = 'v21.0';

export interface CloudTemplateSendParams {
  sessionId: string;
  chatId: string;
  templateId: string;
  bodyParameters?: string[];
}

export interface CloudTemplateSendResult {
  ok: boolean;
  blocked: boolean;
  queued: boolean;
  reason: string;
  messageId?: string;
  queueItemId?: string;
  error?: string;
}

interface MetaMessagesResponse {
  messages?: Array<{ id: string }>;
  error?: { message?: string; error_user_msg?: string };
}

@Injectable()
export class WhatsAppCloudOutboundService {
  private readonly logger = new Logger(WhatsAppCloudOutboundService.name);

  constructor(
    @InjectRepository(FollowupMessageTemplate, 'data')
    private readonly templateRepo: Repository<FollowupMessageTemplate>,
    private readonly outboundService: WhatsAppOutboundService,
    private readonly auditService: WhatsAppSendAuditService,
    private readonly templateGuard: WhatsAppTemplateGuardService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getAccessToken() && this.getPhoneNumberId());
  }

  async sendTemplate(params: CloudTemplateSendParams): Promise<CloudTemplateSendResult> {
    const token = this.getAccessToken();
    const phoneNumberId = this.getPhoneNumberId();
    if (!token) {
      throw new BadRequestException('WHATSAPP_CLOUD_ACCESS_TOKEN is not configured on the server.');
    }
    if (!phoneNumberId) {
      throw new BadRequestException(
        'WHATSAPP_CLOUD_PHONE_NUMBER_ID is not configured on the server.',
      );
    }

    const template = await this.templateRepo.findOne({ where: { id: params.templateId } });
    if (!template) {
      throw new BadRequestException('Template not found');
    }
    const metaName = template.whatsappTemplateName?.trim();
    if (!metaName) {
      throw new BadRequestException(
        `Local template "${template.name}" has no Meta template name configured`,
      );
    }
    if (!this.templateGuard.isTemplateApproved(template)) {
      throw new BadRequestException(`Template "${template.name}" is not approved for WhatsApp`);
    }

    const recipient = this.resolveRecipientPhone(params.chatId);
    const check = await this.outboundService.checkBeforeSend({
      sessionId: params.sessionId,
      chatId: params.chatId,
      body: template.body,
      options: {
        messageType: WhatsAppMessageType.UTILITY,
        source: WhatsAppSendSource.TESTER,
        templateId: params.templateId,
        isManualStaffSend: true,
      },
    });

    if (check.blocked) {
      return {
        ok: false,
        blocked: true,
        queued: false,
        reason: check.reason,
      };
    }
    if (check.queued) {
      return {
        ok: false,
        blocked: false,
        queued: true,
        reason: check.reason,
        queueItemId: check.queueItemId,
      };
    }

    try {
      const messageId = await this.postTemplateMessage({
        phoneNumberId,
        token,
        recipient,
        metaName,
        languageCode: template.language || 'en',
        bodyParameters: params.bodyParameters,
      });

      await this.auditService.log({
        sessionId: params.sessionId,
        chatId: params.chatId,
        phone: recipient,
        source: WhatsAppSendSource.TESTER,
        messageType: WhatsAppMessageType.UTILITY,
        decision: WhatsAppSendAuditDecision.SENT,
        reason: `Cloud API template "${metaName}" sent`,
        body: template.body,
      });

      this.logger.log(`Cloud template sent to ${recipient} (${metaName}) messageId=${messageId}`);
      return {
        ok: true,
        blocked: false,
        queued: false,
        reason: 'Template sent via WhatsApp Cloud API',
        messageId,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.auditService.log({
        sessionId: params.sessionId,
        chatId: params.chatId,
        phone: recipient,
        source: WhatsAppSendSource.TESTER,
        messageType: WhatsAppMessageType.UTILITY,
        decision: WhatsAppSendAuditDecision.FAILED,
        reason: `Cloud API send failed: ${error}`,
        body: template.body,
      });
      return {
        ok: false,
        blocked: false,
        queued: false,
        reason: 'Cloud API send failed',
        error,
      };
    }
  }

  private async postTemplateMessage(params: {
    phoneNumberId: string;
    token: string;
    recipient: string;
    metaName: string;
    languageCode: string;
    bodyParameters?: string[];
  }): Promise<string> {
    const templatePayload: Record<string, unknown> = {
      name: params.metaName,
      language: { code: params.languageCode },
    };

    if (params.bodyParameters?.length) {
      templatePayload.components = [
        {
          type: 'body',
          parameters: params.bodyParameters.map(text => ({ type: 'text', text })),
        },
      ];
    }

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(params.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: params.recipient,
          type: 'template',
          template: templatePayload,
        }),
      },
    );

    const json = (await res.json()) as MetaMessagesResponse;
    if (!res.ok) {
      const detail =
        json.error?.error_user_msg ?? json.error?.message ?? JSON.stringify(json).slice(0, 300);
      throw new BadRequestException(`Meta Graph API error (${res.status}): ${detail}`);
    }

    const messageId = json.messages?.[0]?.id;
    if (!messageId) {
      throw new BadRequestException('Meta Graph API returned no message id');
    }
    return messageId;
  }

  resolveRecipientPhone(chatId: string): string {
    const raw = chatId.replace(/@.*$/, '');
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      throw new BadRequestException('Invalid chat id — cannot resolve recipient phone');
    }
    if (digits.startsWith('0') && digits.length === 10) {
      return `255${digits.slice(1)}`;
    }
    return digits;
  }

  private getAccessToken(): string | undefined {
    return this.config.get<string>('WHATSAPP_CLOUD_ACCESS_TOKEN')?.trim() || undefined;
  }

  private getPhoneNumberId(): string | undefined {
    return this.config.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID')?.trim() || undefined;
  }
}
