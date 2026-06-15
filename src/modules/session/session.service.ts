import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, In, DataSource, Not, IsNull } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { CreateSessionDto } from './dto';
import { EngineFactory } from '../../engine/engine.factory';
import {
  IWhatsAppEngine,
  EngineStatus,
  IncomingMessage,
  ChatSummary,
} from '../../engine/interfaces/whatsapp-engine.interface';
import { MessageService } from '../message/message.service';
import { createLogger } from '../../common/services/logger.service';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { HookManager } from '../../core/hooks';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ConfigService } from '@nestjs/config';
import { isTerminalDisconnectReason } from './session-reconnect.util';
import { BackgroundSyncService } from './background-sync.service';
import { WhatsAppWarmupService } from '../whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppSessionHealthService } from '../whatsapp-safety/services/whatsapp-session-health.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import {
  isChromiumProfileLockError,
  releaseChromiumProfile,
  sessionProfileDir,
} from '../../common/utils/chromium-profile.util';
import {
  clearEngineAuth,
  hasEngineAuth,
  hasIncompleteBaileysAuth,
  migrateSessionAuthFromLegacy,
  sessionRelinkReason,
  sessionRequiresEngineRelink,
  type SessionRelinkReason,
} from '../../common/utils/engine-auth.util';
import { isDesktopMode } from '../../common/utils/production-security.util';
import { purgeSessionRelatedData } from './session-purge.util';
import { purgeSessionAuthAndProfiles } from './session-disk-cleanup.util';
import { StorageService } from '../../common/storage/storage.service';

interface ReconnectState {
  attempts: number;
  timer: NodeJS.Timeout | null;
  maxAttempts: number;
  baseDelay: number;
}

interface ConnectWatchdogState {
  startedAt: number;
  slowNoticeTimer: NodeJS.Timeout | null;
  readyTimeoutTimer: NodeJS.Timeout | null;
}

export interface SessionHealthOverview {
  sessionId: string;
  name: string;
  dbStatus: SessionStatus;
  liveStatus: SessionStatus;
  enginePresent: boolean;
  engineStatus?: EngineStatus;
  pendingReconnect: boolean;
  manuallyStopped: boolean;
  linkingMode: boolean;
  backgroundSyncing: boolean;
  requiresRelink: boolean;
}

@Injectable()
export class SessionService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = createLogger('SessionService');

  // In-memory map of active engine instances
  private engines: Map<string, IWhatsAppEngine> = new Map();

  // Reconnection state per session
  private reconnectStates: Map<string, ReconnectState> = new Map();
  /** Separate reconnect budget while session is still connecting (auth → ready) */
  private connectReconnectStates: Map<string, ReconnectState> = new Map();

  /** Avoid flooding audit logs when WhatsApp refreshes QR frequently */
  private lastQrAuditAt = new Map<string, number>();
  private connectWatchdogs = new Map<string, ConnectWatchdogState>();
  private lastActiveBumpAt = new Map<string, number>();
  private static readonly LAST_ACTIVE_DEBOUNCE_MS = 30_000;
  private sessionStatuses = new Map<string, SessionStatus>();
  private backgroundSyncing = new Map<string, boolean>();
  private statusMessages = new Map<string, string>();
  /** Sessions explicitly stopped by user — health monitor skips auto-restart */
  private manuallyStopped = new Set<string>();
  /** QR linking in progress — skip health monitor + connect auto-retry until ready/stop */
  private linkingMode = new Set<string>();
  /** Debounce health-monitor restarts per session */
  private lastHealthRestartAt = new Map<string, number>();
  private static readonly HEALTH_RESTART_DEBOUNCE_MS = 120_000;
  private static readonly QR_AUDIT_MIN_INTERVAL_MS = 60_000;
  private static readonly SLOW_CONNECT_MESSAGE =
    'Still loading WhatsApp account… large accounts may take longer';

  constructor(
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly engineFactory: EngineFactory,
    private readonly eventsGateway: EventsGateway,
    private readonly webhookService: WebhookService,
    private readonly hookManager: HookManager,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => BackgroundSyncService))
    private readonly backgroundSyncService: BackgroundSyncService,
    @Inject(forwardRef(() => WhatsAppWarmupService))
    private readonly whatsappWarmup: WhatsAppWarmupService,
    @Inject(forwardRef(() => WhatsAppSessionHealthService))
    private readonly whatsappHealth: WhatsAppSessionHealthService,
    @Inject(forwardRef(() => WhatsAppSafetySettingsService))
    private readonly whatsappSafetySettings: WhatsAppSafetySettingsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * On backend startup, reset all active session statuses to disconnected
   * because the engines are not running yet after restart
   */
  async onModuleInit(): Promise<void> {
    const activeStatuses = [
      SessionStatus.READY,
      SessionStatus.INITIALIZING,
      SessionStatus.QR_READY,
      SessionStatus.AUTHENTICATING,
      SessionStatus.LOADING_CHATS,
    ];

    const result = await this.sessionRepository.update(
      { status: In(activeStatuses) },
      { status: SessionStatus.DISCONNECTED },
    );

    if (result.affected && result.affected > 0) {
      this.logger.log(`Reset ${result.affected} session(s) to disconnected on startup`, {
        action: 'startup_reset',
        affected: result.affected,
      });
    }

    // Re-connect previously linked sessions (LocalAuth data on disk — no new QR scan)
    const autoStart = this.configService.get<boolean>('session.autoStart', true);
    if (!autoStart) return;

    const linkedSessions = await this.sessionRepository.find({
      where: {
        phone: Not(IsNull()),
        status: SessionStatus.DISCONNECTED,
      },
    });

    if (isDesktopMode()) {
      const sessionDataPath =
        this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
      for (const session of linkedSessions) {
        const engineType = this.resolveEngineType(session);
        if (migrateSessionAuthFromLegacy(engineType, sessionDataPath, session.name)) {
          this.logger.log(`Migrated legacy WhatsApp auth for session: ${session.name}`, {
            sessionId: session.id,
            action: 'legacy_auth_migrated',
          });
        }
      }
    }

    for (const session of linkedSessions) {
      if (this.getEngineAuthStatus(session).requiresRelink) {
        this.logger.log(`Skip auto-start (engine relink required): ${session.name}`, {
          sessionId: session.id,
          action: 'auto_start_skipped_relink',
        });
        continue;
      }
      void this.autoStartSession(session.id, session.name);
    }
  }

  private autoStartSession(id: string, name: string): void {
    void this.start(id).catch((err: unknown) => {
      this.logger.warn(`Auto-start failed for session: ${name}`, {
        sessionId: id,
        error: err instanceof Error ? err.message : String(err),
        action: 'auto_start_failed',
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    // Clean up all engines on shutdown
    for (const [sessionId, engine] of this.engines) {
      this.logger.log(`Destroying engine for session ${sessionId}`, {
        sessionId,
        action: 'shutdown',
      });
      await engine.destroy();
    }
    this.engines.clear();

    // Clear all reconnect timers
    for (const [, state] of this.reconnectStates) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
    }
    this.reconnectStates.clear();
    for (const [, state] of this.connectReconnectStates) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
    }
    this.connectReconnectStates.clear();
  }

  async create(dto: CreateSessionDto): Promise<Session> {
    // Check if session with same name exists
    const existing = await this.sessionRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Session with name '${dto.name}' already exists`);
    }

    const session = this.sessionRepository.create({
      name: dto.name,
      config: dto.config || {},
      proxyUrl: dto.proxyUrl || null,
      proxyType: dto.proxyType || null,
      engineType: dto.engineType?.trim() || null,
      status: SessionStatus.CREATED,
    });

    const saved = await this.dataSource.transaction(async manager => {
      return await manager.save(session);
    });
    this.logger.log(`Session created: ${saved.name}`, {
      sessionId: saved.id,
      action: 'create',
    });

    // Execute hook after session created (outside transaction since hooks do external I/O)
    await this.hookManager.execute('session:created', saved, {
      sessionId: saved.id,
      source: 'SessionService',
    });

    return saved;
  }

  async findAll(): Promise<Session[]> {
    return this.sessionRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session with id '${id}' not found`);
    }
    return session;
  }

  async findByName(name: string): Promise<Session> {
    const session = await this.sessionRepository.findOne({ where: { name } });
    if (!session) {
      throw new NotFoundException(`Session with name '${name}' not found`);
    }
    return session;
  }

  async delete(id: string): Promise<void> {
    const session = await this.findOne(id);
    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';

    this.clearSessionRuntimeState(id);

    const engine = this.engines.get(id);
    if (engine) {
      try {
        await engine.logout();
      } catch (err) {
        this.logger.warn(`Session logout failed during delete: ${session.name}`, {
          sessionId: id,
          error: err instanceof Error ? err.message : String(err),
          action: 'delete_logout_failed',
        });
      }
      try {
        await engine.destroy();
      } catch (err) {
        this.logger.warn(`Session engine destroy failed during delete: ${session.name}`, {
          sessionId: id,
          error: err instanceof Error ? err.message : String(err),
          action: 'delete_destroy_failed',
        });
      }
      this.engines.delete(id);
    }

    // Execute hook BEFORE delete so plugins can access session data
    await this.hookManager.execute(
      'session:deleted',
      {
        id: session.id,
        name: session.name,
        phone: session.phone,
        pushName: session.pushName,
      },
      {
        sessionId: id,
        source: 'SessionService',
      },
    );

    await this.dataSource.transaction(async manager => {
      await purgeSessionRelatedData(manager, id);
      await manager.remove(session);
    });

    purgeSessionAuthAndProfiles(sessionDataPath, session.name);
    await this.purgeSessionStoredMedia(id);

    this.eventsGateway.emitSessionStatus(id, SessionStatus.DISCONNECTED, {
      deleted: true,
      reason: 'session_deleted',
    });

    this.logger.log(`Session deleted: ${session.name}`, {
      sessionId: id,
      action: 'delete',
    });
  }

  private async purgeSessionStoredMedia(sessionId: string): Promise<void> {
    try {
      const inboxRemoved = await this.storageService.deleteFilesWithPrefix(`inbox/${sessionId}`);
      const avatarsRemoved = await this.storageService.deleteFilesWithPrefix(`avatars/${sessionId}`);
      if (inboxRemoved + avatarsRemoved > 0) {
        this.logger.log(`Removed stored media for deleted session`, {
          sessionId,
          inboxRemoved,
          avatarsRemoved,
          action: 'delete_media_purged',
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to purge stored media for deleted session`, {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
        action: 'delete_media_purge_failed',
      });
    }
  }

  private clearSessionRuntimeState(id: string): void {
    this.cancelReconnect(id);
    this.cancelConnectReconnect(id);
    this.backgroundSyncService.cancel(id);
    this.clearConnectWatchdog(id);
    this.linkingMode.delete(id);
    this.manuallyStopped.delete(id);
    this.sessionStatuses.delete(id);
    this.backgroundSyncing.delete(id);
    this.statusMessages.delete(id);
    this.lastQrAuditAt.delete(id);
    this.lastActiveBumpAt.delete(id);
    this.lastHealthRestartAt.delete(id);
  }

  async start(id: string, options?: { linkingMode?: boolean }): Promise<Session> {
    const session = await this.findOne(id);

    if (this.engines.has(id)) {
      throw new BadRequestException('Session is already started');
    }

    const desktopDeviceId = this.configService.get<string>('desktop.deviceId');
    if (this.configService.get<boolean>('desktop.enabled') && desktopDeviceId) {
      if (
        session.controlledByDeviceId &&
        session.controlledByDeviceId !== desktopDeviceId &&
        [SessionStatus.READY, SessionStatus.QR_READY, SessionStatus.INITIALIZING].includes(
          session.status,
        )
      ) {
        this.logger.warn(
          `Session ${session.name} may be active on another device (${session.controlledByDeviceId})`,
          { sessionId: id },
        );
      }
      await this.sessionRepository.update(id, {
        controlledByDeviceId: desktopDeviceId,
        controlledAt: new Date(),
      });
    }

    this.applyLinkingMode(id, session, options?.linkingMode);

    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    const engineType = this.resolveEngineType(session);
    if (engineType === 'baileys' && hasIncompleteBaileysAuth(sessionDataPath, session.name)) {
      this.logger.warn(`Clearing incomplete Baileys auth before link: ${session.name}`, {
        sessionId: id,
        action: 'clear_incomplete_auth',
      });
      clearEngineAuth(engineType, sessionDataPath, session.name);
    }

    this.releaseSessionChromiumProfile(sessionDataPath, session.name, session);

    // Execute hook before starting
    await this.hookManager.execute(
      'session:starting',
      { sessionId: id },
      {
        sessionId: id,
        source: 'SessionService',
      },
    );

    // Initialize reconnect state
    this.initReconnectStates(id, session);
    this.manuallyStopped.delete(id);

    const engine = this.engineFactory.create({
      sessionId: session.name,
      engineType: this.resolveEngineType(session),
      proxyUrl: session.proxyUrl || undefined,
      proxyType: session.proxyType || undefined,
    });
    this.engines.set(id, engine);
    await this.updateStatus(id, SessionStatus.INITIALIZING);
    this.startConnectWatchdog(id);

    void this.bootstrapEngine(id, session, engine).catch(() => undefined);

    return this.findOne(id);
  }

  /**
   * Soft restart: destroy engine and re-initialize from LocalAuth (no QR if linked).
   */
  /**
   * Clear on-disk auth for the current engine and stop the runtime (fresh QR required).
   */
  async relink(id: string): Promise<Session> {
    const session = await this.findOne(id);

    this.cancelReconnect(id);
    this.cancelConnectReconnect(id);
    this.backgroundSyncService.cancel(id);
    this.clearConnectWatchdog(id);
    this.linkingMode.add(id);

    const engine = this.engines.get(id);
    if (engine) {
      await engine.destroy();
      this.engines.delete(id);
    }

    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    const engineType = this.resolveEngineType(session);
    clearEngineAuth(engineType, sessionDataPath, session.name);
    this.releaseSessionChromiumProfile(sessionDataPath, session.name, session);

    this.manuallyStopped.delete(id);
    await this.sessionRepository.update(id, {
      phone: null,
      pushName: null,
      connectedAt: null,
    });
    await this.updateStatus(id, SessionStatus.DISCONNECTED);

    this.logger.log(`Session auth cleared for relink: ${session.name}`, {
      sessionId: id,
      action: 'session_relink',
      engineType,
    });

    return this.findOne(id);
  }

  async restart(id: string): Promise<Session> {
    const session = await this.findOne(id);
    const hasEngine = this.engines.has(id);

    if (!session.phone && !hasEngine) {
      throw new BadRequestException(
        'Session has not been linked yet. Start the session and scan QR first.',
      );
    }

    this.logger.log(`Restarting session: ${session.name}`, {
      sessionId: id,
      action: 'restart',
    });

    this.cancelReconnect(id);
    this.cancelConnectReconnect(id);
    this.backgroundSyncService.cancel(id);
    this.clearConnectWatchdog(id);
    this.manuallyStopped.delete(id);
    this.linkingMode.delete(id);

    const engine = this.engines.get(id);
    if (engine) {
      await engine.destroy();
      this.engines.delete(id);
    }

    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    this.releaseSessionChromiumProfile(sessionDataPath, session.name, session);

    this.initReconnectStates(id, session);
    await this.updateStatus(id, SessionStatus.INITIALIZING, { restarting: true });
    this.startConnectWatchdog(id);

    void this.initializeEngine(id, session).catch(() => undefined);

    return this.findOne(id);
  }

  private initReconnectStates(id: string, session: Session): void {
    const config = session.config as {
      maxReconnectAttempts?: number;
      reconnectBaseDelay?: number;
    } | null;
    this.reconnectStates.set(id, {
      attempts: 0,
      timer: null,
      maxAttempts:
        config?.maxReconnectAttempts ??
        this.configService.get<number>('session.maxReconnectAttempts', 10),
      baseDelay:
        config?.reconnectBaseDelay ??
        this.configService.get<number>('session.reconnectBaseDelayMs', 5000),
    });
    this.connectReconnectStates.set(id, {
      attempts: 0,
      timer: null,
      maxAttempts: this.configService.get<number>('session.connectMaxReconnectAttempts', 20),
      baseDelay: this.configService.get<number>('session.reconnectBaseDelayMs', 5000),
    });
  }

  private async initializeEngine(id: string, session: Session): Promise<void> {
    this.logger.log(`Initializing engine for session: ${session.name}`, {
      sessionId: id,
      action: 'engine_init',
      proxyEnabled: !!session.proxyUrl,
    });

    const engine = this.engineFactory.create({
      sessionId: session.name,
      engineType: this.resolveEngineType(session),
      proxyUrl: session.proxyUrl || undefined,
      proxyType: session.proxyType || undefined,
    });
    this.engines.set(id, engine);
    await this.updateStatus(id, SessionStatus.INITIALIZING);
    await this.bootstrapEngine(id, session, engine, { isReconnectAttempt: true });
  }

  private async bootstrapEngine(
    id: string,
    session: Session,
    engine: IWhatsAppEngine,
    options?: { isReconnectAttempt?: boolean },
  ): Promise<void> {
    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    this.releaseSessionChromiumProfile(sessionDataPath, session.name, session);

    try {
      await engine.initialize(this.buildEngineCallbacks(id, session));
    } catch (error: unknown) {
      await this.handleEngineInitFailure(id, session, engine, error, options?.isReconnectAttempt);
      throw error;
    }
  }

  private async handleEngineInitFailure(
    id: string,
    session: Session,
    engine: IWhatsAppEngine,
    error: unknown,
    isReconnectAttempt = false,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Engine initialization failed for session ${id}`, message, {
      sessionId: id,
      action: 'engine_init_failed',
      isReconnectAttempt,
    });

    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    this.releaseSessionChromiumProfile(sessionDataPath, session.name, session);

    try {
      await engine.destroy();
    } catch {
      // ignore cleanup errors
    }
    this.engines.delete(id);

    if (isReconnectAttempt) {
      this.clearConnectWatchdog(id);
      if (this.isAwaitingManualRelink(id, session)) {
        await this.updateStatus(id, SessionStatus.FAILED, {
          failureCode: this.engineInitFailureCode(session, message),
          reason: message,
        });
        return;
      }
      if (this.connectReconnectStates.has(id)) {
        const connectState = this.connectReconnectStates.get(id);
        if (connectState) connectState.timer = null;
        this.scheduleConnectReconnect(id, session);
      } else if (this.reconnectStates.has(id)) {
        const reconnectState = this.reconnectStates.get(id);
        if (reconnectState) reconnectState.timer = null;
        this.scheduleReconnect(id, session);
      }
      return;
    }

    this.cancelReconnect(id);
    this.clearConnectWatchdog(id);
    await this.updateStatus(id, SessionStatus.FAILED, {
      failureCode: this.engineInitFailureCode(session, message),
      reason: message,
    });
  }

  private engineInitFailureCode(session: Session, message: string): string {
    if (this.resolveEngineType(session) === 'baileys') return 'engine_init_failed';
    return isChromiumProfileLockError(message) ? 'browser_profile_locked' : 'browser_crash';
  }

  resolveEngineType(session: Session): string {
    return this.configService.get<string>('engine.type') ?? 'whatsapp-web.js';
  }

  async clearAllEngineOverrides(): Promise<number> {
    const result = await this.sessionRepository
      .createQueryBuilder()
      .update(Session)
      .set({ engineType: null })
      .where('engineType IS NOT NULL')
      .execute();
    return result.affected ?? 0;
  }

  private buildEngineCallbacks(id: string, session: Session): Parameters<IWhatsAppEngine['initialize']>[0] {
    return {
      onQRCode: (qrCode: string): void => {
        this.logger.log('QR code generated', {
          sessionId: id,
          action: 'qr_generated',
        });

        const now = Date.now();
        const lastQrAudit = this.lastQrAuditAt.get(id) ?? 0;
        if (now - lastQrAudit >= SessionService.QR_AUDIT_MIN_INTERVAL_MS) {
          this.lastQrAuditAt.set(id, now);
          void this.auditService.logInfo(AuditAction.SESSION_QR_GENERATED, {
            sessionId: id,
            sessionName: session.name,
          });
        }

        void this.hookManager.execute(
          'session:qr',
          { sessionId: id },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        this.eventsGateway.emitQRCode(id, qrCode);
        void this.updateStatus(id, SessionStatus.QR_READY);
      },
      onReady: (phone: string, pushName: string): void => {
        const isFreshLink = this.linkingMode.has(id);
        this.linkingMode.delete(id);
        this.sessionStatuses.set(id, SessionStatus.READY);

        this.logger.log(`Session ready: ${phone}`, {
          sessionId: id,
          phone,
          pushName,
          action: 'ready',
        });

        void this.hookManager.execute(
          'session:ready',
          { phone, pushName },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        this.clearPendingReconnectTimer(id);
        this.clearPendingConnectReconnectTimer(id);

        void this.sessionRepository.update(id, {
          phone,
          pushName,
          connectedAt: new Date(),
          lastActiveAt: new Date(),
        });

        void this.updateStatus(id, SessionStatus.READY, { phone, pushName });

        void this.auditService.logInfo(AuditAction.SESSION_CONNECTED, {
          sessionId: id,
          sessionName: session.name,
        });

        void this.whatsappWarmup.startWarmup(id).catch(err =>
          this.logger.debug(`Warm-up start failed: ${String(err)}`),
        );
        void this.whatsappSafetySettings.getForSession(id).then(settings => {
          if (settings.startupSafeModeEnabled && isFreshLink) {
            return this.whatsappHealth.enterStartupSafeMode(id, settings.startupInitialDelayMinutes);
          }
          return undefined;
        }).catch(err => this.logger.debug(`Startup safe mode failed: ${String(err)}`));

        this.backgroundSyncService.scheduleAfterReady(id);
      },
      onLoadingProgress: (percent: number, message: string): void => {
        const statusMessage =
          percent > 0
            ? `Loading chats ${Math.round(percent)}%…`
            : message?.trim() || SessionService.SLOW_CONNECT_MESSAGE;
        this.setStatusMessage(id, statusMessage);
        const current = this.sessionStatuses.get(id);
        if (current === SessionStatus.READY) {
          this.eventsGateway.emitSessionStatus(id, SessionStatus.READY, { statusMessage });
          return;
        }
        if (current !== SessionStatus.LOADING_CHATS) {
          void this.updateStatus(id, SessionStatus.LOADING_CHATS);
        } else {
          this.eventsGateway.emitSessionStatus(id, SessionStatus.LOADING_CHATS, {
            statusMessage,
          });
        }
      },
      onAuthFailure: (reason: string): void => {
        this.logger.warn(`Session auth failure: ${reason}`, {
          sessionId: id,
          reason,
          action: 'auth_failure',
        });
        this.clearConnectWatchdog(id);
        this.cancelReconnect(id);
        this.linkingMode.delete(id);
        void this.updateStatus(id, SessionStatus.FAILED, {
          failureCode: 'auth_failure',
          reason,
        });
      },
      onMessage: (message): void => {
        this.logger.debug(`Message received from ${message.from}`, {
          sessionId: id,
          messageId: message.id,
          from: message.from,
          action: 'message_received',
        });
        this.bumpLastActiveAt(id);
        // Convert IncomingMessage to plain object for dispatch
        const messageData = { ...message };

        // Execute hook for message received - plugins can modify or stop processing
        void this.hookManager
          .execute('message:received', messageData, {
            sessionId: id,
            source: 'Engine',
          })
          .then(async ({ continue: shouldContinue, data: finalMessage }) => {
            if (!shouldContinue) {
              // Plugin stopped processing (e.g., auto-reply handled it)
              return;
            }

            const payload = finalMessage as IncomingMessage;

            try {
              await this.messageService.persistInboundFromEngine(id, payload);
            } catch (err) {
              this.logger.warn('Failed to persist inbound message', {
                sessionId: id,
                error: String(err),
              });
            }

            // Dispatch to webhooks with potentially modified message
            const payloadRecord = payload as unknown as Record<string, unknown>;
            void this.webhookService.dispatch(id, 'message.received', payloadRecord);
            const enriched = await this.messageService.enrichInboundNotificationPayload(
              id,
              payload.chatId,
              payloadRecord,
            );
            this.eventsGateway.emitMessage(id, enriched);
          });
      },
      onMessageAck: (messageId: string, ack: number): void => {
        void this.messageService.updateMessageStatusByWaId(id, messageId, ack);
      },
      onUnreadCountChanged: (chatId: string, unreadCount: number): void => {
        void this.messageService.syncUnreadFromEngine(id, chatId, unreadCount);
      },
      onDisconnected: (reason: string): void => {
        this.logger.warn(`Session disconnected: ${reason}`, {
          sessionId: id,
          reason,
          action: 'disconnected',
        });

        void this.auditService.logWarn(AuditAction.SESSION_DISCONNECTED, {
          sessionId: id,
          sessionName: session.name,
          metadata: { reason },
        });

        void this.hookManager.execute(
          'session:disconnected',
          { reason },
          {
            sessionId: id,
            source: 'Engine',
          },
        );

        this.clearConnectWatchdog(id);
        const priorStatus = this.sessionStatuses.get(id);
        const connectingStatuses: SessionStatus[] = [
          SessionStatus.INITIALIZING,
          SessionStatus.QR_READY,
          SessionStatus.AUTHENTICATING,
          SessionStatus.LOADING_CHATS,
        ];
        if (priorStatus && connectingStatuses.includes(priorStatus)) {
          if (isTerminalDisconnectReason(reason)) {
            void this.updateStatus(id, SessionStatus.FAILED, {
              failureCode: 'disconnected_before_ready',
              reason,
            });
            this.cancelReconnect(id);
            this.cancelConnectReconnect(id);
            return;
          }

          this.logger.warn(`Transient disconnect during connect — scheduling reconnect`, {
            sessionId: id,
            reason,
            priorStatus,
            action: 'connect_reconnect',
          });
          void this.updateStatus(id, SessionStatus.INITIALIZING, { reason, reconnecting: true });
          this.scheduleConnectReconnect(id, session);
          return;
        }

        // First-time QR linking: engine may flip to disconnected before this handler runs
        if (
          this.linkingMode.has(id) &&
          !session.phone?.trim() &&
          !isTerminalDisconnectReason(reason)
        ) {
          if (!this.connectReconnectStates.has(id)) {
            this.initReconnectStates(id, session);
          }
          this.logger.warn(`Transient disconnect during QR linking — scheduling reconnect`, {
            sessionId: id,
            reason,
            priorStatus,
            action: 'connect_reconnect',
          });
          void this.updateStatus(id, SessionStatus.INITIALIZING, { reason, reconnecting: true });
          this.scheduleConnectReconnect(id, session);
          return;
        }

        this.backgroundSyncService.cancel(id);

        void this.updateStatus(id, SessionStatus.DISCONNECTED, { reason });

        if (isTerminalDisconnectReason(reason)) {
          this.logger.warn(
            `Skipping auto-reconnect for terminal disconnect reason: ${reason}`,
            {
              sessionId: id,
              reason,
              action: 'reconnect_skipped',
            },
          );
          this.cancelReconnect(id);
          return;
        }

        if (this.shouldSkipAutoReconnect(id, session)) {
          this.logger.warn(`Skipping auto-reconnect — linking or relink required`, {
            sessionId: id,
            reason,
            linkingMode: this.linkingMode.has(id),
            action: 'reconnect_skipped',
          });
          this.cancelReconnect(id);
          return;
        }

        // Attempt to reconnect for transient failures (network, browser crash, etc.)
        this.scheduleReconnect(id, session);
      },
      onStateChanged: (engineState: EngineStatus): void => {
        const statusMap: Record<EngineStatus, SessionStatus> = {
          [EngineStatus.DISCONNECTED]: SessionStatus.DISCONNECTED,
          [EngineStatus.INITIALIZING]: SessionStatus.INITIALIZING,
          [EngineStatus.QR_READY]: SessionStatus.QR_READY,
          [EngineStatus.AUTHENTICATING]: SessionStatus.AUTHENTICATING,
          [EngineStatus.LOADING_CHATS]: SessionStatus.LOADING_CHATS,
          [EngineStatus.READY]: SessionStatus.READY,
          [EngineStatus.FAILED]: SessionStatus.FAILED,
        };
        const newStatus = statusMap[engineState];
        if (newStatus) {
          void this.updateStatus(id, newStatus);
        }
      },
    };
  }

  private computeReconnectDelay(state: ReconnectState): number {
    const maxDelay = this.configService.get<number>('session.reconnectMaxDelayMs', 300_000);
    const raw = state.baseDelay * Math.pow(2, state.attempts) + Math.random() * 1000;
    return Math.min(raw, maxDelay);
  }

  private handleReconnectBudgetExceeded(
    id: string,
    session: Session,
    state: ReconnectState,
    kind: 'connect' | 'runtime',
  ): boolean {
    if (state.attempts < state.maxAttempts) {
      return true;
    }

    const infinite = this.configService.get<boolean>('session.reconnectInfinite', false);
    if (!infinite) {
      if (kind === 'connect') {
        this.logger.error(
          `Max connect-phase reconnect attempts reached for session: ${session.name}`,
          undefined,
          {
            sessionId: id,
            attempts: state.attempts,
            action: 'connect_reconnect_failed',
          },
        );
        void this.updateStatus(id, SessionStatus.FAILED, {
          failureCode: 'disconnected_before_ready',
          reason: 'Max connect-phase reconnect attempts reached',
        });
        this.cancelConnectReconnect(id);
      } else {
        this.logger.error(`Max reconnect attempts reached for session: ${session.name}`, undefined, {
          sessionId: id,
          attempts: state.attempts,
          action: 'reconnect_failed',
        });
      }
      return false;
    }

    this.logger.log(`Infinite reconnect: resetting attempt counter for ${session.name}`, {
      sessionId: id,
      kind,
      action: 'reconnect_infinite_retry',
    });
    state.attempts = 0;
    return true;
  }

  private scheduleConnectReconnect(id: string, session: Session): void {
    if (this.shouldSkipAutoReconnect(id, session)) return;

    const state = this.connectReconnectStates.get(id);
    if (!state) return;

    if (state.timer) {
      return;
    }

    if (!this.handleReconnectBudgetExceeded(id, session, state, 'connect')) {
      return;
    }

    const delay = this.computeReconnectDelay(state);
    state.attempts++;

    this.logger.log(
      `Scheduling connect-phase reconnect ${state.attempts}/${state.maxAttempts} in ${Math.round(delay / 1000)}s`,
      {
        sessionId: id,
        attempt: state.attempts,
        delayMs: delay,
        action: 'connect_reconnect_scheduled',
      },
    );

    state.timer = setTimeout(() => {
      void this.executeConnectReconnect(id, session, state);
    }, delay);
  }

  private async executeConnectReconnect(
    id: string,
    session: Session,
    state: ReconnectState,
  ): Promise<void> {
    state.timer = null;
    if (this.isSessionOperational(id)) {
      return;
    }
    try {
      const oldEngine = this.engines.get(id);
      if (oldEngine) {
        await oldEngine.destroy();
        this.engines.delete(id);
      }
      this.startConnectWatchdog(id);
      await this.initializeEngine(id, session);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connect-phase reconnect attempt ${state.attempts} failed`, errorMessage, {
        sessionId: id,
        action: 'connect_reconnect_error',
      });
      // handleEngineInitFailure already schedules the next connect retry when isReconnectAttempt=true
    }
  }

  private cancelConnectReconnect(id: string): void {
    const state = this.connectReconnectStates.get(id);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.connectReconnectStates.delete(id);
  }

  private scheduleReconnect(id: string, session: Session): void {
    if (this.shouldSkipAutoReconnect(id, session)) return;

    const state = this.reconnectStates.get(id);
    if (!state) return;

    if (state.timer) {
      return;
    }

    if (!this.handleReconnectBudgetExceeded(id, session, state, 'runtime')) {
      return;
    }

    const delay = this.computeReconnectDelay(state);
    state.attempts++;

    this.logger.log(
      `Scheduling reconnect attempt ${state.attempts}/${state.maxAttempts} in ${Math.round(delay / 1000)}s`,
      {
        sessionId: id,
        attempt: state.attempts,
        delayMs: delay,
        action: 'reconnect_scheduled',
      },
    );

    state.timer = setTimeout(() => {
      void this.executeReconnect(id, session, state);
    }, delay);
  }

  private async executeReconnect(id: string, session: Session, state: ReconnectState): Promise<void> {
    state.timer = null;
    if (this.isSessionOperational(id)) {
      return;
    }
    try {
      // Clean up old engine
      const oldEngine = this.engines.get(id);
      if (oldEngine) {
        await oldEngine.destroy();
        this.engines.delete(id);
      }

      // Re-initialize
      await this.initializeEngine(id, session);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Reconnect attempt ${state.attempts} failed`, errorMessage, {
        sessionId: id,
        action: 'reconnect_error',
      });
      // handleEngineInitFailure already schedules the next retry when isReconnectAttempt=true
    }
  }

  private bumpLastActiveAt(sessionId: string): void {
    const now = Date.now();
    const last = this.lastActiveBumpAt.get(sessionId) ?? 0;
    if (now - last < SessionService.LAST_ACTIVE_DEBOUNCE_MS) return;
    this.lastActiveBumpAt.set(sessionId, now);
    void this.sessionRepository.update(sessionId, { lastActiveAt: new Date() });
  }

  private isSessionOperational(id: string): boolean {
    return (
      this.sessionStatuses.get(id) === SessionStatus.READY && this.engines.has(id)
    );
  }

  /** Relink cleared auth but phone remains in DB — user must click Start (no engine running). */
  private isAwaitingManualRelink(id: string, session: Session): boolean {
    return (
      this.linkingMode.has(id) && !!session.phone?.trim() && !this.engines.has(id)
    );
  }

  private shouldSkipAutoReconnect(id: string, session: Session): boolean {
    if (this.isManuallyStopped(id)) return true;
    if (this.isAwaitingManualRelink(id, session)) return true;
    return this.getEngineAuthStatus(session).requiresRelink;
  }

  private clearPendingReconnectTimer(id: string): void {
    const state = this.reconnectStates.get(id);
    if (!state) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.attempts = 0;
  }

  private clearPendingConnectReconnectTimer(id: string): void {
    const state = this.connectReconnectStates.get(id);
    if (!state) return;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.attempts = 0;
  }

  private cancelReconnect(id: string): void {
    const state = this.reconnectStates.get(id);
    if (state?.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.reconnectStates.delete(id);
  }

  async stop(id: string): Promise<Session> {
    const session = await this.findOne(id);

    this.cancelReconnect(id);
    this.cancelConnectReconnect(id);
    this.backgroundSyncService.cancel(id);
    this.clearConnectWatchdog(id);

    const engine = this.engines.get(id);

    if (engine) {
      await engine.disconnect();
      this.engines.delete(id);
    }

    this.manuallyStopped.add(id);
    this.linkingMode.delete(id);

    this.logger.log(`Session stopped: ${session.name}`, {
      sessionId: id,
      action: 'stop',
    });
    await this.updateStatus(id, SessionStatus.DISCONNECTED);
    return this.findOne(id);
  }

  async getQRCode(id: string): Promise<{
    qrCode: string;
    status: SessionStatus;
    statusMessage?: string;
    failureCode?: string;
  }> {
    const session = await this.findOne(id);
    const engine = this.engines.get(id);

    if (!engine) {
      return {
        qrCode: '',
        status: session.status,
        ...this.getStatusExtras(id),
      };
    }

    const qrCode = engine.getQRCode();
    const liveStatus = this.getLiveStatus(id) ?? session.status;
    const extra = this.sanitizeQrResponseExtras(liveStatus, Boolean(qrCode), this.getStatusExtras(id));

    if (!qrCode) {
      return {
        qrCode: '',
        status: liveStatus,
        ...extra,
      };
    }

    return {
      qrCode,
      status: liveStatus,
      ...extra,
    };
  }

  /** Drop stale loading/sync messages while the client is still on the QR scan step. */
  private sanitizeQrResponseExtras(
    status: SessionStatus,
    hasQr: boolean,
    extras: { statusMessage?: string; failureCode?: string; backgroundSyncing?: boolean },
  ): { statusMessage?: string; failureCode?: string; backgroundSyncing?: boolean } {
    if (
      hasQr &&
      (status === SessionStatus.QR_READY || status === SessionStatus.INITIALIZING)
    ) {
      return { failureCode: extras.failureCode };
    }
    if (status === SessionStatus.QR_READY || status === SessionStatus.AUTHENTICATING) {
      return { failureCode: extras.failureCode, backgroundSyncing: extras.backgroundSyncing };
    }
    return extras;
  }

  getLiveStatus(id: string): SessionStatus | undefined {
    const engine = this.engines.get(id);
    if (engine) {
      const statusMap: Record<EngineStatus, SessionStatus> = {
        [EngineStatus.DISCONNECTED]: SessionStatus.DISCONNECTED,
        [EngineStatus.INITIALIZING]: SessionStatus.INITIALIZING,
        [EngineStatus.QR_READY]: SessionStatus.QR_READY,
        [EngineStatus.AUTHENTICATING]: SessionStatus.AUTHENTICATING,
        [EngineStatus.LOADING_CHATS]: SessionStatus.LOADING_CHATS,
        [EngineStatus.READY]: SessionStatus.READY,
        [EngineStatus.FAILED]: SessionStatus.FAILED,
      };
      const mapped = statusMap[engine.getStatus()];
      if (mapped) return mapped;
    }
    return this.sessionStatuses.get(id);
  }

  isBackgroundSyncing(id: string): boolean {
    return this.backgroundSyncing.get(id) === true;
  }

  setBackgroundSyncing(id: string, value: boolean, statusMessage?: string): void {
    this.backgroundSyncing.set(id, value);
    if (statusMessage !== undefined) {
      this.setStatusMessage(id, statusMessage);
    } else if (!value) {
      this.backgroundSyncing.delete(id);
    }
    const status = this.getLiveStatus(id) ?? SessionStatus.READY;
    this.eventsGateway.emitSessionStatus(id, status, {
      backgroundSyncing: value,
      statusMessage: this.statusMessages.get(id),
    });
  }

  setStatusMessage(id: string, message: string | undefined): void {
    if (message) {
      this.statusMessages.set(id, message);
    } else {
      this.statusMessages.delete(id);
    }
  }

  getRuntimeExtras(id: string): {
    statusMessage?: string;
    backgroundSyncing?: boolean;
    linkingMode?: boolean;
  } {
    return {
      ...this.getStatusExtras(id),
      linkingMode: this.isInLinkingMode(id),
    };
  }

  getEngine(id: string): IWhatsAppEngine | undefined {
    return this.engines.get(id);
  }

  async listChats(sessionId: string): Promise<ChatSummary[]> {
    await this.findOne(sessionId);
    const engine = this.engines.get(sessionId);
    if (!engine) {
      throw new BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
    }
    return engine.listChats();
  }

  async getGroups(id: string): Promise<{ id: string; name: string }[]> {
    await this.findOne(id); // Verify session exists
    const engine = this.engines.get(id);

    if (!engine) {
      throw new BadRequestException('Session is not started');
    }

    const groups = await engine.getGroups();
    return groups.map(g => ({
      id: g.id,
      name: g.name,
    }));
  }

  private static readonly CONNECT_STATUS_RANK: Record<SessionStatus, number> = {
    [SessionStatus.CREATED]: 0,
    [SessionStatus.DISCONNECTED]: 0,
    [SessionStatus.FAILED]: 0,
    [SessionStatus.INITIALIZING]: 1,
    [SessionStatus.QR_READY]: 2,
    [SessionStatus.AUTHENTICATING]: 3,
    [SessionStatus.LOADING_CHATS]: 4,
    [SessionStatus.READY]: 5,
  };

  private shouldApplyStatusTransition(
    current: SessionStatus | undefined,
    next: SessionStatus,
  ): boolean {
    if (
      next === SessionStatus.FAILED ||
      next === SessionStatus.DISCONNECTED ||
      next === SessionStatus.CREATED
    ) {
      return true;
    }
    const currentRank = SessionService.CONNECT_STATUS_RANK[current ?? SessionStatus.CREATED] ?? 0;
    const nextRank = SessionService.CONNECT_STATUS_RANK[next] ?? 0;
    return nextRank >= currentRank;
  }

  private async updateStatus(
    id: string,
    status: SessionStatus,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    const current = this.sessionStatuses.get(id);
    if (!this.shouldApplyStatusTransition(current, status)) {
      return;
    }
    if (
      status === SessionStatus.QR_READY ||
      status === SessionStatus.AUTHENTICATING ||
      status === SessionStatus.READY
    ) {
      this.setStatusMessage(id, undefined);
    }
    this.sessionStatuses.set(id, status);
    await this.sessionRepository.update(id, { status });
    this.logger.debug(`Session status updated to ${status}`, {
      sessionId: id,
      status,
      action: 'status_update',
    });
    if (status === SessionStatus.READY || status === SessionStatus.FAILED || status === SessionStatus.DISCONNECTED) {
      this.clearConnectWatchdog(id);
    }
    this.eventsGateway.emitSessionStatus(id, status, extra);

    const webhookPayload = { status, ...extra };
    void this.webhookService.dispatch(id, 'session.status', webhookPayload);
    if (status === SessionStatus.DISCONNECTED) {
      void this.webhookService.dispatch(id, 'session.disconnected', {
        reason: extra?.reason,
        ...extra,
      });
    }
    if (status === SessionStatus.READY) {
      void this.webhookService.dispatch(id, 'session.ready', {
        phone: extra?.phone,
        pushName: extra?.pushName,
        ...extra,
      });
    }
  }

  private startConnectWatchdog(id: string): void {
    this.clearConnectWatchdog(id);
    const slowNoticeMs = this.configService.get<number>('engine.wa.slowConnectNoticeMs', 60_000);
    const readyTimeoutMs = this.configService.get<number>('engine.wa.sessionReadyTimeoutMs', 0);
    const state: ConnectWatchdogState = {
      startedAt: Date.now(),
      slowNoticeTimer: null,
      readyTimeoutTimer: null,
    };
    state.slowNoticeTimer = setTimeout(() => {
      const current = this.sessionStatuses.get(id);
      if (
        current === SessionStatus.AUTHENTICATING ||
        current === SessionStatus.LOADING_CHATS ||
        current === SessionStatus.INITIALIZING ||
        current === SessionStatus.QR_READY
      ) {
        void this.eventsGateway.emitSessionStatus(id, current, {
          statusMessage: SessionService.SLOW_CONNECT_MESSAGE,
        });
      }
    }, slowNoticeMs);
    if (readyTimeoutMs > 0) {
      state.readyTimeoutTimer = setTimeout(() => {
        const current = this.sessionStatuses.get(id);
        if (current !== SessionStatus.READY) {
          void this.updateStatus(id, SessionStatus.FAILED, {
            failureCode: 'timeout',
            reason: `Session did not become ready within ${readyTimeoutMs}ms`,
          });
          const engine = this.engines.get(id);
          if (engine) {
            void engine.destroy().finally(() => this.engines.delete(id));
          }
          this.cancelReconnect(id);
        }
      }, readyTimeoutMs);
    }
    this.connectWatchdogs.set(id, state);
  }

  private releaseSessionChromiumProfile(
    sessionDataPath: string,
    sessionName: string,
    session: Session,
  ): void {
    if (this.resolveEngineType(session) === 'baileys') return;
    releaseChromiumProfile(sessionProfileDir(sessionDataPath, sessionName));
  }

  private clearConnectWatchdog(id: string): void {
    const state = this.connectWatchdogs.get(id);
    if (!state) return;
    if (state.slowNoticeTimer) clearTimeout(state.slowNoticeTimer);
    if (state.readyTimeoutTimer) clearTimeout(state.readyTimeoutTimer);
    this.connectWatchdogs.delete(id);
  }

  private getStatusExtras(id: string): {
    statusMessage?: string;
    failureCode?: string;
    backgroundSyncing?: boolean;
  } {
    const extras: {
      statusMessage?: string;
      failureCode?: string;
      backgroundSyncing?: boolean;
    } = {};
    const msg = this.statusMessages.get(id);
    if (msg) extras.statusMessage = msg;
    if (this.backgroundSyncing.get(id)) extras.backgroundSyncing = true;
    return extras;
  }

  /**
   * Get overall session statistics for multi-session monitoring
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    ready: number;
    disconnected: number;
    byStatus: Record<string, number>;
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
    health?: SessionHealthOverview[];
  }> {
    const sessions = await this.findAll();
    const byStatus: Record<string, number> = {};

    for (const session of sessions) {
      byStatus[session.status] = (byStatus[session.status] || 0) + 1;
    }

    const memory = process.memoryUsage();

    return {
      total: sessions.length,
      active: this.engines.size,
      ready: byStatus[SessionStatus.READY] || 0,
      disconnected: byStatus[SessionStatus.DISCONNECTED] || 0,
      byStatus,
      memoryUsage: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024),
      },
      health: await this.getHealthOverview(),
    };
  }

  async getHealthOverview(): Promise<SessionHealthOverview[]> {
    const sessions = await this.findAll();
    return sessions
      .filter(s => s.phone)
      .map(s => this.buildHealthEntry(s));
  }

  hasPendingReconnect(id: string): boolean {
    const runtime = this.reconnectStates.get(id);
    const connect = this.connectReconnectStates.get(id);
    return !!(runtime?.timer || connect?.timer);
  }

  isManuallyStopped(id: string): boolean {
    return this.manuallyStopped.has(id);
  }

  isInLinkingMode(id: string): boolean {
    return this.linkingMode.has(id);
  }

  setLinkingMode(id: string, enabled: boolean): void {
    if (enabled) {
      this.linkingMode.add(id);
    } else {
      this.linkingMode.delete(id);
    }
  }

  getEngineAuthStatus(session: Session): {
    engineAuthPresent: boolean;
    requiresRelink: boolean;
    relinkReason: SessionRelinkReason | null;
  } {
    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    const engineType = this.resolveEngineType(session);
    const engineAuthPresent = hasEngineAuth(engineType, sessionDataPath, session.name);
    const requiresRelink = sessionRequiresEngineRelink(
      engineType,
      sessionDataPath,
      session.name,
      session.phone,
    );
    const relinkReason = sessionRelinkReason(
      engineType,
      sessionDataPath,
      session.name,
      session.phone,
    );
    return { engineAuthPresent, requiresRelink, relinkReason };
  }

  private applyLinkingMode(id: string, session: Session, explicit?: boolean): void {
    const { engineAuthPresent, requiresRelink } = this.getEngineAuthStatus(session);
    const needsLink = !session.phone || !engineAuthPresent || requiresRelink;
    const enable = explicit === true || (explicit !== false && needsLink);
    if (enable) {
      this.linkingMode.add(id);
      this.logger.log(`Linking mode enabled for session: ${session.name}`, {
        sessionId: id,
        action: 'linking_mode_enabled',
        requiresRelink,
        engineAuthPresent,
      });
    } else {
      this.linkingMode.delete(id);
    }
  }

  canAcceptHealthRestart(id: string): boolean {
    const last = this.lastHealthRestartAt.get(id) ?? 0;
    return Date.now() - last >= SessionService.HEALTH_RESTART_DEBOUNCE_MS;
  }

  markHealthRestart(id: string): void {
    this.lastHealthRestartAt.set(id, Date.now());
  }

  getConnectWatchdogAgeMs(id: string): number | null {
    const state = this.connectWatchdogs.get(id);
    if (!state) return null;
    return Date.now() - state.startedAt;
  }

  private buildHealthEntry(session: Session): SessionHealthOverview {
    const liveStatus = this.getLiveStatus(session.id) ?? session.status;
    const engine = this.engines.get(session.id);
    const engineStatus = engine?.getStatus();
    const auth = this.getEngineAuthStatus(session);
    return {
      sessionId: session.id,
      name: session.name,
      dbStatus: session.status,
      liveStatus,
      enginePresent: !!engine,
      engineStatus,
      pendingReconnect: this.hasPendingReconnect(session.id),
      manuallyStopped: this.isManuallyStopped(session.id),
      linkingMode: this.isInLinkingMode(session.id),
      backgroundSyncing: this.isBackgroundSyncing(session.id),
      requiresRelink: auth.requiresRelink,
    };
  }

  /**
   * Get count of currently active (running) sessions
   */
  getActiveCount(): number {
    return this.engines.size;
  }

  /**
   * Check if session is currently active (engine running)
   */
  isActive(id: string): boolean {
    return this.engines.has(id);
  }

  isAiAutoReplyEnabledForSession(session: Session): boolean {
    const flag = session.config?.aiAutoReplyEnabled;
    if (flag === false) return false;
    return true;
  }

  async setAiAutoReplyEnabled(sessionId: string, enabled: boolean): Promise<Session> {
    const session = await this.findOne(sessionId);
    session.config = { ...(session.config ?? {}), aiAutoReplyEnabled: enabled };
    return this.sessionRepository.save(session);
  }

  isFollowupAutopilotEnabledForSession(session: Session): boolean {
    return session.config?.followupAutopilotEnabled === true;
  }

  async setFollowupAutopilotEnabled(sessionId: string, enabled: boolean): Promise<Session> {
    const session = await this.findOne(sessionId);
    session.config = { ...(session.config ?? {}), followupAutopilotEnabled: enabled };
    return this.sessionRepository.save(session);
  }

  getStaffAiAllowedNumbers(session: Session): string[] {
    const raw = session.config?.staffAiAllowedNumbers;
    if (!Array.isArray(raw)) return [];
    return raw.map(n => String(n).trim()).filter(Boolean);
  }

  async setStaffAiAllowedNumbers(sessionId: string, numbers: string[]): Promise<Session> {
    const session = await this.findOne(sessionId);
    session.config = {
      ...(session.config ?? {}),
      staffAiAllowedNumbers: numbers.map(n => n.trim()).filter(Boolean),
    };
    return this.sessionRepository.save(session);
  }

  async updateProxy(
    sessionId: string,
    dto: { proxyUrl?: string | null; proxyType?: 'http' | 'https' | 'socks4' | 'socks5' },
  ): Promise<Session> {
    const session = await this.findOne(sessionId);
    const trimmed = dto.proxyUrl?.trim() ?? '';
    session.proxyUrl = trimmed ? trimmed : null;
    session.proxyType = trimmed ? (dto.proxyType ?? session.proxyType ?? 'socks5') : null;
    await this.sessionRepository.save(session);

    this.logger.log(`Session proxy updated: ${session.name}`, {
      sessionId,
      proxyEnabled: !!session.proxyUrl,
      action: 'proxy_updated',
    });

    if (this.engines.has(sessionId)) {
      return this.restart(sessionId);
    }

    return this.findOne(sessionId);
  }

  async updateEngineType(sessionId: string, engineType: string | null | undefined): Promise<Session> {
    const session = await this.findOne(sessionId);

    if (engineType !== null && engineType !== undefined) {
      throw new BadRequestException(
        'Only one engine is active globally. Change the engine in Settings → Plugins.',
      );
    }

    if (this.engines.has(sessionId)) {
      await this.stop(sessionId);
    }

    session.engineType = null;
    await this.sessionRepository.save(session);

    this.logger.log(`Session engine override cleared: ${session.name}`, {
      sessionId,
      effectiveEngineType: this.resolveEngineType(session),
      action: 'session_engine_updated',
    });

    return this.findOne(sessionId);
  }
}
