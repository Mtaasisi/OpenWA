import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { MessageService } from '../message/message.service';
import { EventsGateway } from '../events/events.gateway';
import { SessionStatus } from './entities/session.entity';
import { createLogger } from '../../common/services/logger.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { InboxThreadSummaryService } from '../message/inbox-thread-summary.service';
import {
  readLargeAccountHotTierSize,
  readLargeAccountSyncMaxChats,
  readLargeAccountThreshold,
} from '../message/large-account.util';

interface SyncJobState {
  cancelled: boolean;
  timer: NodeJS.Timeout | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

@Injectable()
export class BackgroundSyncService {
  private readonly logger = createLogger('BackgroundSyncService');
  private readonly jobs = new Map<string, SyncJobState>();
  /** Bumped on each schedule/cancel so async scheduling cannot resurrect cancelled jobs. */
  private readonly scheduleGeneration = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly eventsGateway: EventsGateway,
    @Inject(forwardRef(() => WhatsAppSafetySettingsService))
    private readonly safetySettings: WhatsAppSafetySettingsService,
    private readonly inboxThreadSummaryService: InboxThreadSummaryService,
  ) {}

  scheduleAfterReady(sessionId: string): void {
    this.cancel(sessionId);
    const generation = (this.scheduleGeneration.get(sessionId) ?? 0) + 1;
    this.scheduleGeneration.set(sessionId, generation);
    void this.scheduleWithSafetySettings(sessionId, generation);
  }

  private async scheduleWithSafetySettings(sessionId: string, generation: number): Promise<void> {
    const settings = await this.safetySettings.getForSession(sessionId);
    if (this.scheduleGeneration.get(sessionId) !== generation) return;

    const configDelay = this.configService.get<number>('engine.wa.backgroundSyncDelayMs', 60_000);
    const startupDelay = settings.startupSafeModeEnabled
      ? settings.startupInitialDelayMinutes * 60 * 1000
      : 0;
    const delayMs = Math.max(configDelay, startupDelay);
    const state: SyncJobState = { cancelled: false, timer: null };
    this.jobs.set(sessionId, state);
    if (this.scheduleGeneration.get(sessionId) !== generation) {
      state.cancelled = true;
      this.jobs.delete(sessionId);
      return;
    }
    state.timer = setTimeout(() => {
      if (this.scheduleGeneration.get(sessionId) !== generation) {
        state.cancelled = true;
        return;
      }
      void this.run(sessionId, state, settings);
    }, delayMs);
  }

  cancel(sessionId: string): void {
    this.scheduleGeneration.set(sessionId, (this.scheduleGeneration.get(sessionId) ?? 0) + 1);
    const state = this.jobs.get(sessionId);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    if (state) {
      state.cancelled = true;
    }
    this.jobs.delete(sessionId);
    this.sessionService.setBackgroundSyncing(sessionId, false);
  }

  isRunning(sessionId: string): boolean {
    return this.jobs.has(sessionId);
  }

  private async run(
    sessionId: string,
    state: SyncJobState,
    settings?: Awaited<ReturnType<WhatsAppSafetySettingsService['getForSession']>>,
  ): Promise<void> {
    if (state.cancelled) return;

    this.sessionService.setBackgroundSyncing(sessionId, true, 'Importing chat history in background…');

    try {
      const safety = settings ?? (await this.safetySettings.getForSession(sessionId));
      const mediaDelay = this.configService.get<number>('engine.wa.mediaBackfillDelayMs', 500);
      const batchSize = safety.syncBatchSize || this.configService.get<number>('engine.wa.backgroundChatBatchSize', 20);
      const batchDelay = safety.syncBatchDelayMs || this.configService.get<number>('engine.wa.backgroundChatBatchDelayMs', 30_000);
      const profileDelay = this.configService.get<number>('engine.wa.backgroundProfileDelayMs', 2000);
      const historyMessages = this.configService.get<number>('engine.wa.historyBackfillMessages', 40);
      const historyDelay = this.configService.get<number>('engine.wa.historyBackfillDelayMs', 3000);
      const threadTotal = await this.inboxThreadSummaryService.countThreads([sessionId]);
      const largeAccount = threadTotal > readLargeAccountThreshold(this.configService);
      const defaultMaxChats = safety.maxChatsToSyncInitially || 50;
      const maxChats = largeAccount
        ? Math.max(defaultMaxChats, readLargeAccountSyncMaxChats(this.configService))
        : defaultMaxChats;

      this.emitProgress(sessionId, 'Importing recent chat history…');
      const hotTierBudget = largeAccount ? readLargeAccountHotTierSize(this.configService) : 0;
      let historyOffset = 0;
      let historyHasMore = true;
      let historyProcessed = 0;
      let hotPhase = largeAccount;

      while (historyHasMore && !state.cancelled && historyProcessed < maxChats) {
        const history = await this.messageService.runBackgroundHistoryBatch(
          sessionId,
          batchSize,
          historyOffset,
          historyMessages,
          historyDelay,
          hotPhase ? { hotTierOnly: true } : undefined,
        );
        const processed = Math.min(historyOffset + batchSize, history.total);
        this.emitProgress(
          sessionId,
          history.total > 0
            ? `Importing history ${processed}/${history.total}…`
            : 'Importing chat history…',
        );
        historyHasMore = history.hasMore;
        historyOffset += batchSize;
        historyProcessed += batchSize;

        if (hotPhase && (!historyHasMore || historyProcessed >= hotTierBudget)) {
          hotPhase = false;
          historyOffset = 0;
          historyHasMore = true;
        }

        if (historyHasMore && !state.cancelled) {
          await sleep(batchDelay);
        }
      }

      if (state.cancelled) return;

      if (safety.autoDownloadMediaOnStartup) {
        this.emitProgress(sessionId, 'Caching recent media…');
        await this.messageService.backfillUncachedMedia(sessionId, undefined, mediaDelay);
      }

      if (state.cancelled) return;

      let offset = 0;
      let hasMore = true;
      let chatsProcessed = 0;
      while (hasMore && !state.cancelled && chatsProcessed < maxChats) {
        const result = await this.messageService.runBackgroundEnrichmentBatch(
          sessionId,
          batchSize,
          offset,
          profileDelay,
        );
        const processed = Math.min(offset + batchSize, result.total);
        this.emitProgress(
          sessionId,
          result.total > 0 ? `Syncing chats ${processed}/${result.total}…` : 'Syncing chats…',
        );
        hasMore = result.hasMore;
        offset += batchSize;
        chatsProcessed += batchSize;
        if (hasMore && !state.cancelled) {
          await sleep(batchDelay);
        }
      }
    } catch (err) {
      this.logger.debug(`Background sync failed for ${sessionId}: ${String(err)}`);
    } finally {
      if (!state.cancelled) {
        this.sessionService.setBackgroundSyncing(sessionId, false);
        this.sessionService.setStatusMessage(sessionId, undefined);
        const status = this.sessionService.getLiveStatus(sessionId) ?? SessionStatus.READY;
        this.eventsGateway.emitSessionStatus(sessionId, status, { backgroundSyncing: false });
      }
      this.jobs.delete(sessionId);
    }
  }

  private emitProgress(sessionId: string, statusMessage: string): void {
    this.sessionService.setStatusMessage(sessionId, statusMessage);
    const status = this.sessionService.getLiveStatus(sessionId) ?? SessionStatus.READY;
    this.eventsGateway.emitSessionStatus(sessionId, status, {
      backgroundSyncing: true,
      statusMessage,
    });
  }
}
