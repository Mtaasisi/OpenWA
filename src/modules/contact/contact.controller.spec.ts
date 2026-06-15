import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ContactController } from './contact.controller';
import { SessionService } from '../session/session.service';
import { ProfilePictureCacheService } from './profile-picture-cache.service';
import { InboxThreadSummaryService } from '../message/inbox-thread-summary.service';
import { MessageService } from '../message/message.service';

describe('ContactController large account guard', () => {
  let controller: ContactController;
  let engine: { getContacts: jest.Mock };
  let countThreads: jest.Mock;

  beforeEach(async () => {
    engine = { getContacts: jest.fn().mockResolvedValue([{ id: '1@c.us', name: 'Alice' }]) };
    countThreads = jest.fn().mockResolvedValue(100);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [
        {
          provide: SessionService,
          useValue: { getEngine: jest.fn().mockReturnValue(engine) },
        },
        { provide: ProfilePictureCacheService, useValue: {} },
        {
          provide: InboxThreadSummaryService,
          useValue: { countThreads },
        },
        {
          provide: MessageService,
          useValue: { resolveThreadPhoneHint: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'engine.wa.largeAccountThreshold') return 50;
              return fallback;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(ContactController);
  });

  it('returns contacts for small accounts', async () => {
    countThreads.mockResolvedValue(30);
    const result = await controller.findAll('sess-a');
    expect(engine.getContacts).toHaveBeenCalled();
    expect(result).toEqual({
      contacts: [{ id: '1@c.us', name: 'Alice' }],
      largeAccountMode: false,
      threadTotal: 30,
    });
  });

  it('blocks full contact sync for large accounts', async () => {
    countThreads.mockResolvedValue(5000);
    const result = await controller.findAll('sess-a');
    expect(engine.getContacts).not.toHaveBeenCalled();
    expect(result.largeAccountMode).toBe(true);
    expect(result.contacts).toEqual([]);
    expect(result.threadTotal).toBe(5000);
  });
});
