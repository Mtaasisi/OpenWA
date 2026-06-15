import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { WhatsAppCloudOutboundService } from './whatsapp-cloud-outbound.service';
import { WhatsAppOutboundService } from './whatsapp-outbound.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';
import { WhatsAppTemplateGuardService } from './whatsapp-template-guard.service';
import { FollowupMessageTemplate } from '../../followup/entities/followup-message-template.entity';
import { WhatsAppTemplateStatus } from '../../followup/followup.enums';

describe('WhatsAppCloudOutboundService', () => {
  let service: WhatsAppCloudOutboundService;

  const templateRepo = {
    findOne: jest.fn(),
  };

  const outboundService = {
    checkBeforeSend: jest.fn(async () => ({
      proceed: true,
      queued: false,
      blocked: false,
      reason: 'Allowed',
    })),
  };

  const auditService = {
    log: jest.fn(async (row: unknown) => row),
  };

  const templateGuard = {
    isTemplateApproved: jest.fn(() => true),
  };

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'WHATSAPP_CLOUD_ACCESS_TOKEN') return 'token-abc';
      if (key === 'WHATSAPP_CLOUD_PHONE_NUMBER_ID') return 'phone-123';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.test' }] }),
    })) as unknown as typeof fetch;

    templateRepo.findOne.mockResolvedValue({
      id: 'tpl-1',
      name: 'Order update',
      body: 'Your order is ready',
      language: 'en',
      whatsappTemplateName: 'order_update',
      whatsappTemplateStatus: WhatsAppTemplateStatus.APPROVED,
      requiresWhatsappApproval: true,
    } satisfies Partial<FollowupMessageTemplate>);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppCloudOutboundService,
        { provide: getRepositoryToken(FollowupMessageTemplate, 'data'), useValue: templateRepo },
        { provide: WhatsAppOutboundService, useValue: outboundService },
        { provide: WhatsAppSendAuditService, useValue: auditService },
        { provide: WhatsAppTemplateGuardService, useValue: templateGuard },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(WhatsAppCloudOutboundService);
  });

  it('resolveRecipientPhone normalizes local TZ numbers', () => {
    expect(service.resolveRecipientPhone('0712345678@c.us')).toBe('255712345678');
    expect(service.resolveRecipientPhone('255712345678@c.us')).toBe('255712345678');
  });

  it('sendTemplate returns blocked when policy guard blocks', async () => {
    outboundService.checkBeforeSend.mockResolvedValueOnce({
      proceed: false,
      queued: false,
      blocked: true,
      reason: 'Customer opted out',
    });

    const result = await service.sendTemplate({
      sessionId: 'sess-1',
      chatId: '255712345678@c.us',
      templateId: 'tpl-1',
    });

    expect(result.ok).toBe(false);
    expect(result.blocked).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sendTemplate posts to Meta Cloud API when guard allows', async () => {
    const result = await service.sendTemplate({
      sessionId: 'sess-1',
      chatId: '255712345678@c.us',
      templateId: 'tpl-1',
      bodyParameters: ['Alice'],
    });

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('wamid.test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/phone-123/messages'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'sent' }),
    );
  });

  it('sendTemplate throws when token is missing', async () => {
    configService.get.mockImplementation(() => undefined);
    await expect(
      service.sendTemplate({
        sessionId: 'sess-1',
        chatId: '255712345678@c.us',
        templateId: 'tpl-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
