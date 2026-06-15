import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BackgroundSyncService } from './background-sync.service';
import { SessionService } from './session.service';
import { MessageService } from '../message/message.service';
import { EventsGateway } from '../events/events.gateway';
import { SessionStatus } from './entities/session.entity';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { InboxThreadSummaryService } from '../message/inbox-thread-summary.service';

describe('BackgroundSyncService', () => {
  let service: BackgroundSyncService;
  let messageService: { backfillUncachedMedia: jest.Mock; runBackgroundEnrichmentBatch: jest.Mock };
  let sessionService: {
    setBackgroundSyncing: jest.Mock;
    setStatusMessage: jest.Mock;
    getLiveStatus: jest.Mock;
  };
  let eventsGateway: { emitSessionStatus: jest.Mock };
  let safetySettings: { getForSession: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers();
    messageService = {
      backfillUncachedMedia: jest.fn().mockResolvedValue(undefined),
      runBackgroundEnrichmentBatch: jest.fn().mockResolvedValue({ hasMore: false, total: 0 }),
      runBackgroundHistoryBatch: jest.fn().mockResolvedValue({ hasMore: false, total: 0, imported: 0 }),
    };
    sessionService = {
      setBackgroundSyncing: jest.fn(),
      setStatusMessage: jest.fn(),
      getLiveStatus: jest.fn().mockReturnValue(SessionStatus.READY),
    };
    eventsGateway = { emitSessionStatus: jest.fn() };
    safetySettings = {
      getForSession: jest.fn().mockResolvedValue({
        startupSafeModeEnabled: false,
        startupInitialDelayMinutes: 5,
        maxChatsToSyncInitially: 50,
        backgroundChatBatchSize: 20,
        autoDownloadMediaOnStartup: true,
        fetchGroupInfoOnStartup: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackgroundSyncService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'engine.wa.backgroundSyncDelayMs') return 1000;
              if (key === 'engine.wa.mediaBackfillDelayMs') return 10;
              if (key === 'engine.wa.backgroundChatBatchSize') return 20;
              if (key === 'engine.wa.backgroundChatBatchDelayMs') return 100;
              if (key === 'engine.wa.backgroundProfileDelayMs') return 10;
              if (key === 'engine.wa.historyBackfillMessages') return 40;
              if (key === 'engine.wa.historyBackfillDelayMs') return 10;
              if (key === 'engine.wa.largeAccountThreshold') return 2000;
              if (key === 'engine.wa.largeAccountSyncMaxChats') return 200;
              return defaultValue;
            }),
          },
        },
        { provide: SessionService, useValue: sessionService },
        { provide: MessageService, useValue: messageService },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: WhatsAppSafetySettingsService, useValue: safetySettings },
        {
          provide: InboxThreadSummaryService,
          useValue: { countThreads: jest.fn().mockResolvedValue(100) },
        },
      ],
    }).compile();

    service = module.get(BackgroundSyncService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts background sync after configured delay', async () => {
    service.scheduleAfterReady('sess-1');
    await jest.advanceTimersByTimeAsync(1000);

    expect(messageService.runBackgroundHistoryBatch).toHaveBeenCalled();
    expect(messageService.backfillUncachedMedia).toHaveBeenCalledWith('sess-1', undefined, 10);
    expect(sessionService.setBackgroundSyncing).toHaveBeenCalledWith(
      'sess-1',
      true,
      'Importing chat history in background…',
    );
    expect(sessionService.setBackgroundSyncing).toHaveBeenCalledWith('sess-1', false);
  });

  it('cancel prevents sync from running', async () => {
    service.scheduleAfterReady('sess-1');
    await Promise.resolve();
    service.cancel('sess-1');
    await jest.advanceTimersByTimeAsync(5000);
    expect(messageService.backfillUncachedMedia).not.toHaveBeenCalled();
  });

  it('uses startup safe mode delay when enabled', async () => {
    safetySettings.getForSession.mockResolvedValueOnce({
      startupSafeModeEnabled: true,
      startupInitialDelayMinutes: 5,
      maxChatsToSyncInitially: 50,
      backgroundChatBatchSize: 20,
      autoDownloadMediaOnStartup: true,
      fetchGroupInfoOnStartup: true,
    });

    service.scheduleAfterReady('sess-1');
    await jest.advanceTimersByTimeAsync(1000);
    expect(messageService.backfillUncachedMedia).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(messageService.runBackgroundHistoryBatch).toHaveBeenCalled();
  });
});
