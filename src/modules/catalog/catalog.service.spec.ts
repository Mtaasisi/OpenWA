import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SessionService } from '../session/session.service';
import { WhatsAppOutboundService } from '../whatsapp-safety/services/whatsapp-outbound.service';
import { WhatsAppSendAuditService } from '../whatsapp-safety/services/whatsapp-send-audit.service';
import { WhatsAppWarmupService } from '../whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppConsentService } from '../whatsapp-safety/services/whatsapp-consent.service';
import { WhatsAppSendAuditDecision } from '../whatsapp-safety/enums/whatsapp-safety.enums';

describe('CatalogService', () => {
  let service: CatalogService;

  const engine = {
    sendProduct: jest.fn(),
    sendCatalog: jest.fn(),
  };

  const sessionService = {
    getEngine: jest.fn(() => engine),
  };

  const whatsappOutbound = {
    checkBeforeSend: jest.fn(async () => ({
      proceed: true,
      queued: false,
      blocked: false,
      reason: 'ok',
    })),
    assertCanSend: jest.fn(),
  };

  const auditService = { log: jest.fn() };
  const warmupService = { recordOutbound: jest.fn() };
  const consentService = { recordOutbound: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: SessionService, useValue: sessionService },
        { provide: WhatsAppOutboundService, useValue: whatsappOutbound },
        { provide: WhatsAppSendAuditService, useValue: auditService },
        { provide: WhatsAppWarmupService, useValue: warmupService },
        { provide: WhatsAppConsentService, useValue: consentService },
      ],
    }).compile();
    service = module.get(CatalogService);
  });

  it('runs safety guard before native catalog send', async () => {
    engine.sendProduct.mockRejectedValueOnce(new Error('sendProduct not yet implemented'));

    await expect(
      service.sendProduct('sess-1', '123@c.us', 'prod-1', 'Hello'),
    ).rejects.toThrow(BadRequestException);

    expect(whatsappOutbound.checkBeforeSend).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        chatId: '123@c.us',
        body: 'Hello',
      }),
    );
    expect(whatsappOutbound.assertCanSend).toHaveBeenCalled();
  });

  it('rejects invalid chat targets before guard', async () => {
    await expect(
      service.sendProduct('sess-1', 'status@broadcast', 'prod-1'),
    ).rejects.toThrow(BadRequestException);

    expect(whatsappOutbound.checkBeforeSend).not.toHaveBeenCalled();
  });

  it('records audit and warmup when native catalog send succeeds', async () => {
    engine.sendProduct.mockResolvedValueOnce({ id: 'msg-1', timestamp: 123 });

    await service.sendProduct('sess-1', '123@c.us', 'prod-1', 'Hello');

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        chatId: '123@c.us',
        decision: WhatsAppSendAuditDecision.SENT,
        body: 'Hello',
      }),
    );
    expect(warmupService.recordOutbound).toHaveBeenCalled();
    expect(consentService.recordOutbound).toHaveBeenCalledWith('sess-1', '123');
  });

  it('throws when session engine is missing', async () => {
    sessionService.getEngine.mockReturnValueOnce(null);

    await expect(service.sendProduct('sess-1', '123@c.us', 'prod-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
