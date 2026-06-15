import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';
import { AiStatusService } from '../ai/ai-status.service';
import { AiAutoReplyMasterService } from '../ai/ai-auto-reply-master.service';
import { AiLearningItemsService } from '../ai/ai-learning-items.service';
import { AiProfileService } from '../ai/ai-profile.service';
import { WhatsAppSendQueueService } from '../whatsapp-safety/services/whatsapp-send-queue.service';
import { WhatsAppQueueStatus } from '../whatsapp-safety/enums/whatsapp-safety.enums';
import { InauzwaSyncService } from '../products/inauzwa-sync.service';
import { FollowupQueueService } from '../followup/followup-queue.service';
import { DesktopService } from '../desktop/desktop.service';
import { isDesktopMode } from '../../common/utils/desktop-paths.util';
import { User } from '../auth/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import type { AppStatusResponse, AppStatusSessionItem, AppStatusWarning } from './app-status.types';
import {
  computeAiStatus,
  computeDatabaseStatus,
  computeOverallStatus,
  computeQueueStatus,
  computeSyncStatus,
  computeWhatsAppStatus,
  computeWorkEfficiency,
} from './app-status.utils';

const CACHE_TTL_MS = 20_000;

@Injectable()
export class AppStatusService {
  private readonly logger = new Logger(AppStatusService.name);
  private cacheExpiresAt = 0;
  private cachedPayload: Omit<AppStatusResponse, 'user'> | null = null;

  constructor(
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly aiStatusService: AiStatusService,
    private readonly autoReplyMaster: AiAutoReplyMasterService,
    private readonly learningItems: AiLearningItemsService,
    private readonly aiProfile: AiProfileService,
    private readonly sendQueue: WhatsAppSendQueueService,
    private readonly inauzwaSync: InauzwaSyncService,
    private readonly followupQueue: FollowupQueueService,
    private readonly desktopService: DesktopService,
  ) {}

  async getStatus(user?: User, apiKey?: ApiKey): Promise<AppStatusResponse> {
    const now = Date.now();
    if (!this.cachedPayload || now >= this.cacheExpiresAt) {
      this.cachedPayload = await this.buildCachedPayload();
      this.cacheExpiresAt = now + CACHE_TTL_MS;
    }

    return {
      ...this.cachedPayload,
      user: this.buildUser(user, apiKey),
      updatedAt: new Date().toISOString(),
    };
  }

  private buildUser(user?: User, apiKey?: ApiKey): AppStatusResponse['user'] {
    if (user) {
      return {
        id: user.id,
        name: user.name,
        role: this.formatRole(user.role),
      };
    }
    if (apiKey) {
      return {
        id: apiKey.id,
        name: apiKey.name,
        role: this.formatRole(apiKey.role),
      };
    }
    return { id: 'unknown', name: 'Unknown', role: 'Viewer' };
  }

  private formatRole(role: string): string {
    if (!role) return 'Viewer';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  private async buildCachedPayload(): Promise<Omit<AppStatusResponse, 'user'>> {
    const warnings: AppStatusWarning[] = [];
    const partial = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        this.logger.warn(`App status partial failure (${label}): ${err instanceof Error ? err.message : err}`);
        warnings.push({
          id: `partial-${label}`,
          level: 'warning',
          title: `${label} check failed`,
          message: err instanceof Error ? err.message : String(err),
          createdAt: new Date().toISOString(),
        });
        return fallback;
      }
    };

    const [
      dbPing,
      sessions,
      aiStatus,
      autoReplyHealth,
      learningOverview,
      queueStats,
      inauzwa,
      followupCounts,
      profiles,
      hasPayment,
    ] = await Promise.all([
      partial('database', () => this.pingDatabase(), { ok: false, latencyMs: 0, lastPingAt: new Date().toISOString() }),
      partial('sessions', () => this.sessionService.findAll(), []),
      partial('ai', () => this.aiStatusService.getStatus(), null),
      partial('autoReply', () => this.autoReplyMaster.getHealth(), null),
      partial('learning', () => this.learningItems.getOverview(), null),
      partial('queue', () => this.sendQueue.stats(), {} as Record<string, number>),
      partial('sync', () => this.inauzwaSync.getStatus(), null),
      partial('followups', () => this.followupQueue.getFilterCounts(), null),
      partial('profiles', () => this.aiProfile.listProfiles(), []),
      partial('payment', () => this.aiProfile.hasActivePaymentAccount(), false),
    ]);

    const aiStatusResolved = aiStatus ?? {
      enabled: false,
      apiKeySet: false,
      autoReplyEnabled: false,
      testStatus: null,
      provider: 'openai',
      model: '',
      knowledge: { chunks: 0, vectorSearch: false, database: '' },
    };

    const autoReplyHealthResolved = autoReplyHealth ?? {
      masterEnabled: false,
      ready: false,
      checks: [],
      sessions: [],
      stats: { aiReplies24h: 0, openEscalations: 0, knowledgeChunks: 0, knowledgeFiles: 0 },
    };

    const learningOverviewResolved = learningOverview ?? {
      pendingLearning: 0,
      unknownQuestionsToday: 0,
      mostAskedProduct: null,
      outOfStockDemand: 0,
      installmentDemand: 0,
      aiPausedChats: 0,
    };

    const inauzwaResolved = inauzwa ?? {
      configured: false,
      database: false,
      api: false,
      branchId: null,
      vendorId: null,
      currency: 'TZS',
      defaultApiUrl: null,
      defaultSupabaseUrl: null,
      hasDefaultSupabaseAnonKey: false,
      hasSupabaseConfig: false,
      lastSyncAt: null,
      lastSyncError: null,
      preferences: { branchId: null } as Awaited<ReturnType<InauzwaSyncService['getStatus']>>['preferences'],
    };

    const followupCountsResolved = followupCounts ?? ({} as Record<string, number>);

    const whatsappComputed = computeWhatsAppStatus(
      sessions.map(s => ({
        id: s.id,
        name: s.name,
        status: s.status,
        lastActiveAt: s.lastActiveAt,
      })),
    );

    const sessionItems: AppStatusSessionItem[] = sessions.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      connected: s.status === SessionStatus.READY,
      qrNeeded: [SessionStatus.QR_READY, SessionStatus.AUTHENTICATING, SessionStatus.INITIALIZING].includes(
        s.status,
      ),
      lastActiveAt: s.lastActiveAt ? new Date(s.lastActiveAt).toISOString() : null,
    }));

    if (whatsappComputed.qrNeeded > 0) {
      const qrSession = sessions.find(s => s.status === SessionStatus.QR_READY);
      warnings.push({
        id: 'wa-qr-needed',
        level: 'warning',
        title: 'QR scan needed',
        message: qrSession
          ? `${qrSession.name} needs QR scan`
          : `${whatsappComputed.qrNeeded} session(s) need QR scan`,
        createdAt: new Date().toISOString(),
        action: { label: 'Open channels', route: '/channels' },
      });
    }

    const aiComputed = computeAiStatus({
      enabled: aiStatusResolved.enabled === true,
      apiKeySet: aiStatusResolved.apiKeySet === true,
      testStatus: aiStatusResolved.testStatus,
      autoReplyEnabled: aiStatusResolved.autoReplyEnabled === true,
      autoReplyReady: autoReplyHealthResolved.ready,
      masterEnabled: autoReplyHealthResolved.masterEnabled,
      pendingLearning: learningOverviewResolved.pendingLearning,
      knowledgeIndexed: (aiStatusResolved.knowledge?.chunks ?? 0) >= 15,
      safetyEnabled: autoReplyHealthResolved.checks.find(c => c.id === 'safetyMaster')?.ok !== false,
    });

    const pendingQueue =
      (queueStats[WhatsAppQueueStatus.PENDING] ?? 0) +
      (queueStats[WhatsAppQueueStatus.APPROVAL_REQUIRED] ?? 0) +
      (queueStats[WhatsAppQueueStatus.SCHEDULED] ?? 0);
    const delayedQueue = queueStats[WhatsAppQueueStatus.SCHEDULED] ?? 0;
    const failedQueue =
      (queueStats[WhatsAppQueueStatus.FAILED] ?? 0) + (queueStats[WhatsAppQueueStatus.BLOCKED] ?? 0);

    const queueStatus = computeQueueStatus({
      pending: pendingQueue,
      delayed: delayedQueue,
      failed: failedQueue,
    });

    const dbComputed = computeDatabaseStatus(dbPing);

    const anyBackgroundSync = sessions.some(s => this.sessionService.isBackgroundSyncing(s.id));
    const syncFailed = inauzwaResolved.lastSyncError ? 1 : 0;
    const syncComputed = computeSyncStatus({
      syncing: anyBackgroundSync,
      unsynced: inauzwaResolved.configured && !inauzwaResolved.lastSyncAt ? 1 : 0,
      failed: syncFailed,
      lastSyncAt: inauzwaResolved.lastSyncAt,
    });

    if (inauzwaResolved.lastSyncError) {
      warnings.push({
        id: 'sync-error',
        level: 'error',
        title: 'Product sync failed',
        message: inauzwaResolved.lastSyncError,
        createdAt: new Date().toISOString(),
        action: { label: 'Open products', route: '/settings/integrations/products' },
      });
    }

    if (failedQueue > 0) {
      warnings.push({
        id: 'queue-failed',
        level: 'error',
        title: 'Send queue failures',
        message: `${failedQueue} message(s) failed in send queue`,
        createdAt: new Date().toISOString(),
        action: { label: 'Open automations', route: '/automations' },
      });
    }

    const branchId =
      inauzwaResolved.preferences?.branchId ?? inauzwaResolved.branchId ?? profiles[0]?.branchId ?? 'default';
    const branchProfile = profiles.find(p => p.branchId === branchId) ?? profiles[0];
    const branchName = branchProfile?.branchName ?? branchProfile?.businessName ?? branchId;

    const followupPending = (followupCountsResolved.overdue ?? 0) + (followupCountsResolved.due_now ?? 0);
    const workSummary = {
      pending: followupPending,
      efficiency: computeWorkEfficiency(followupPending, followupCountsResolved.due_today ?? 0),
    };

    const overall = computeOverallStatus({
      database: dbComputed.status,
      whatsapp: whatsappComputed.status,
      ai: aiComputed.status,
      queue: queueStatus,
      sync: syncComputed.status,
    });

    let desktop: AppStatusResponse['desktop'];
    if (isDesktopMode()) {
      try {
        const dh = await this.desktopService.getDesktopHealth();
        desktop = {
          localBackendRunning: dh.backend === 'ok' && dh.database?.connected === true,
          whatsAppEngineRunning: (dh.whatsapp?.connectedCount ?? 0) > 0,
          sessionPathAccessible: dh.paths?.sessions?.ok === true,
          version: dh.appVersion ?? this.desktopService.getAppVersion(),
        };
      } catch {
        desktop = undefined;
      }
    }

    return {
      overall,
      updatedAt: new Date().toISOString(),
      workSummary,
      ai: {
        status: aiComputed.status,
        label: aiComputed.label,
        autoReply: aiComputed.autoReply,
        provider: String(aiStatusResolved.provider ?? 'unknown'),
        model: String(aiStatusResolved.model ?? ''),
        knowledgeIndexed: (aiStatusResolved.knowledge?.chunks ?? 0) >= 15,
        pendingLearning: learningOverviewResolved.pendingLearning,
        lastError: aiStatusResolved.testStatus === 'failed' ? 'Provider test failed' : null,
      },
      whatsapp: {
        ...whatsappComputed,
        sessions: sessionItems,
      },
      queue: {
        status: queueStatus,
        pending: pendingQueue,
        delayed: delayedQueue,
        failed: failedQueue,
      },
      database: {
        ...dbComputed,
        latencyMs: dbPing.latencyMs,
        lastPingAt: dbPing.lastPingAt,
      },
      sync: {
        ...syncComputed,
        unsynced: syncComputed.status === 'warning' ? 1 : 0,
        failed: syncFailed,
        lastSyncAt: inauzwaResolved.lastSyncAt,
      },
      branch: {
        id: branchId,
        name: branchName,
        status: branchProfile ? 'success' : 'neutral',
        paymentProfileConfigured: hasPayment,
      },
      warnings: warnings.slice(0, 10),
      desktop,
    };
  }

  private async pingDatabase(): Promise<{ ok: boolean; latencyMs: number; lastPingAt: string }> {
    const start = Date.now();
    if (!this.dataSource.isInitialized) {
      return { ok: false, latencyMs: 0, lastPingAt: new Date().toISOString() };
    }
    await this.dataSource.query('SELECT 1');
    return {
      ok: true,
      latencyMs: Date.now() - start,
      lastPingAt: new Date().toISOString(),
    };
  }
}
