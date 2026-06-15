import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WhatsAppConsentService } from './whatsapp-consent.service';
import { WhatsAppContactConsent } from '../entities/whatsapp-contact-consent.entity';
import { WhatsAppOptInStatus } from '../enums/whatsapp-safety.enums';

describe('WhatsAppConsentService', () => {
  let service: WhatsAppConsentService;

  const repo = {
    findOne: jest.fn(),
    save: jest.fn(async (row: unknown) => row),
    create: jest.fn((data: unknown) => data),
    find: jest.fn(async () => []),
    count: jest.fn(async () => 0),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppConsentService,
        { provide: getRepositoryToken(WhatsAppContactConsent, 'data'), useValue: repo },
      ],
    }).compile();
    service = module.get(WhatsAppConsentService);
  });

  it('detects opt-out keywords from inbound messages', () => {
    expect(service.processInboundForOptOut('stop')).toBe(true);
    expect(service.processInboundForOptOut('sitaki tena')).toBe(true);
    expect(service.processInboundForOptOut('hello there')).toBe(false);
  });

  it('treats opted-out contacts as blocked', () => {
    expect(
      service.isOptedOut({
        optInStatus: WhatsAppOptInStatus.OPTED_OUT,
      } as never),
    ).toBe(true);
    expect(service.isOptedOut(null)).toBe(false);
  });

  it('blocks marketing for contacts without explicit marketing consent', () => {
    expect(service.canSendMarketing(null)).toBe(false);
    expect(
      service.canSendMarketing({
        optInStatus: WhatsAppOptInStatus.OPTED_IN,
        canMarketing: true,
      } as never),
    ).toBe(true);
  });

  it('lists opted-in contacts missing marketing consent', async () => {
    await service.listMarketingGaps(25);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { optInStatus: WhatsAppOptInStatus.OPTED_IN, canMarketing: false },
        take: 25,
      }),
    );
  });
});
