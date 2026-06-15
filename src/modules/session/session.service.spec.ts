jest.mock('../../engine/adapters/baileys.adapter', () => ({
  BaileysAdapter: class MockBaileysAdapter {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { Session, SessionStatus } from './entities/session.entity';
import { EngineFactory } from '../../engine/engine.factory';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { HookManager } from '../../core/hooks';
import { MessageService } from '../message/message.service';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';
import { BackgroundSyncService } from './background-sync.service';
import { WhatsAppWarmupService } from '../whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppSessionHealthService } from '../whatsapp-safety/services/whatsapp-session-health.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { StorageService } from '../../common/storage/storage.service';

const flushPromises = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-uuid-1',
    name: 'test-session',
    status: SessionStatus.CREATED,
    phone: null,
    pushName: null,
    config: {},
    proxyUrl: null,
    proxyType: null,
    engineType: null,
    connectedAt: null,
    lastActiveAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let repository: jest.Mocked<Partial<Repository<Session>>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let engineFactory: jest.Mocked<Partial<EngineFactory>>;
  let eventsGateway: jest.Mocked<Partial<EventsGateway>>;
  let webhookService: jest.Mocked<Partial<WebhookService>>;
  let hookManager: jest.Mocked<Partial<HookManager>>;
  let mockEngine: Record<string, jest.Mock>;
  let messageServiceMock: {
    backfillUncachedMedia: jest.Mock;
    persistInboundFromEngine: jest.Mock;
    updateMessageStatusByWaId: jest.Mock;
    enrichInboundNotificationPayload: jest.Mock;
    syncUnreadFromEngine: jest.Mock;
  };
  let backgroundSyncMock: {
    scheduleAfterReady: jest.Mock;
    cancel: jest.Mock;
    isRunning: jest.Mock;
  };
  let storageServiceMock: {
    deleteFilesWithPrefix: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn().mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
          remove: jest.fn().mockResolvedValue(undefined),
          find: jest.fn().mockResolvedValue([]),
          findOne: jest.fn().mockResolvedValue(null),
          delete: jest.fn().mockResolvedValue({ affected: 0 }),
        };
        return cb(manager);
      }),
    };

    messageServiceMock = {
      backfillUncachedMedia: jest.fn().mockResolvedValue(undefined),
      persistInboundFromEngine: jest.fn().mockResolvedValue(null),
      updateMessageStatusByWaId: jest.fn().mockResolvedValue(null),
      enrichInboundNotificationPayload: jest.fn().mockResolvedValue({}),
      syncUnreadFromEngine: jest.fn().mockResolvedValue(undefined),
    };

    backgroundSyncMock = {
      scheduleAfterReady: jest.fn(),
      cancel: jest.fn(),
      isRunning: jest.fn().mockReturnValue(false),
    };

    storageServiceMock = {
      deleteFilesWithPrefix: jest.fn().mockResolvedValue(0),
    };

    mockEngine = {
      initialize: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      getQRCode: jest.fn().mockReturnValue(null),
      getGroups: jest.fn().mockResolvedValue([]),
      getStatus: jest.fn().mockReturnValue('ready'),
    };

    engineFactory = {
      create: jest.fn().mockReturnValue(mockEngine),
    };

    eventsGateway = {
      emitSessionStatus: jest.fn(),
      emitMessage: jest.fn(),
      emitQRCode: jest.fn(),
    };

    webhookService = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    hookManager = {
      execute: jest.fn().mockResolvedValue({ continue: true, data: {} }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getRepositoryToken(Session, 'data'),
          useValue: repository,
        },
        {
          provide: getDataSourceToken('data'),
          useValue: dataSource,
        },
        { provide: EngineFactory, useValue: engineFactory },
        { provide: EventsGateway, useValue: eventsGateway },
        { provide: WebhookService, useValue: webhookService },
        { provide: HookManager, useValue: hookManager },
        { provide: MessageService, useValue: messageServiceMock },
        {
          provide: AuditService,
          useValue: {
            logInfo: jest.fn().mockResolvedValue({}),
            logWarn: jest.fn().mockResolvedValue({}),
            log: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'session.autoStart') return false;
              if (key === 'session.maxReconnectAttempts') return 10;
              if (key === 'session.reconnectBaseDelayMs') return 5000;
              if (key === 'session.reconnectMaxDelayMs') return 300_000;
              if (key === 'session.reconnectInfinite') return false;
              if (key === 'engine.wa.slowConnectNoticeMs') return 60_000;
              if (key === 'engine.wa.sessionReadyTimeoutMs') return 0;
              if (key === 'session.connectMaxReconnectAttempts') return 20;
              if (key === 'engine.sessionDataPath') return './data/sessions';
              return defaultValue;
            }),
          },
        },
        { provide: BackgroundSyncService, useValue: backgroundSyncMock },
        {
          provide: WhatsAppWarmupService,
          useValue: { startWarmup: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: WhatsAppSessionHealthService,
          useValue: { enterStartupSafeMode: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: WhatsAppSafetySettingsService,
          useValue: { getForSession: jest.fn().mockResolvedValue({ startupSafeModeEnabled: false }) },
        },
        { provide: StorageService, useValue: storageServiceMock },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    jest.spyOn(service, 'getEngineAuthStatus').mockReturnValue({
      engineAuthPresent: true,
      requiresRelink: false,
    });
  });

  // ── create ────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a new session with CREATED status', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(null); // no duplicate
      (repository.create as jest.Mock).mockReturnValue(session);
      (repository.save as jest.Mock).mockResolvedValue(session);

      const result = await service.create({ name: 'test-session' });

      expect(result.name).toBe('test-session');
      expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ status: SessionStatus.CREATED }));
      expect(hookManager.execute).toHaveBeenCalledWith(
        'session:created',
        session,
        expect.objectContaining({ sessionId: session.id }),
      );
    });

    it('should throw ConflictException if session name already exists', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(createMockSession());

      await expect(service.create({ name: 'test-session' })).rejects.toThrow(ConflictException);
    });
  });

  // ── findAll / findOne / findByName ────────────────────────────────

  describe('findAll', () => {
    it('should return all sessions ordered by createdAt DESC', async () => {
      const sessions = [createMockSession(), createMockSession({ id: 'sess-2' })];
      (repository.find as jest.Mock).mockResolvedValue(sessions);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('findOne', () => {
    it('should return session by id', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);

      const result = await service.findOne('sess-uuid-1');
      expect(result.id).toBe('sess-uuid-1');
    });

    it('should throw NotFoundException if session not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByName', () => {
    it('should return session by name', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);

      const result = await service.findByName('test-session');
      expect(result.name).toBe('test-session');
    });

    it('should throw NotFoundException if name not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findByName('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── delete ────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should stop engine and remove session from DB', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.remove as jest.Mock).mockResolvedValue(session);

      await service.delete('sess-uuid-1');

      expect(hookManager.execute).toHaveBeenCalledWith(
        'session:deleted',
        expect.objectContaining({ id: 'sess-uuid-1', name: 'test-session' }),
        expect.any(Object),
      );
      expect(storageServiceMock.deleteFilesWithPrefix).toHaveBeenCalledWith('inbox/sess-uuid-1');
      expect(storageServiceMock.deleteFilesWithPrefix).toHaveBeenCalledWith('avatars/sess-uuid-1');
    });

    it('should destroy running engine before deleting', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.save as jest.Mock).mockImplementation(s => Promise.resolve(s));
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (repository.remove as jest.Mock).mockResolvedValue(session);

      // Start the session first to create an engine
      await service.start('sess-uuid-1');

      // Now delete
      await service.delete('sess-uuid-1');

      expect(mockEngine.destroy).toHaveBeenCalled();
      expect(mockEngine.logout).toHaveBeenCalled();
      expect(backgroundSyncMock.cancel).toHaveBeenCalledWith('sess-uuid-1');
      expect(eventsGateway.emitSessionStatus).toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.DISCONNECTED,
        expect.objectContaining({ deleted: true }),
      );
    });
  });

  // ── start ─────────────────────────────────────────────────────────

  describe('start', () => {
    it('should create engine and set status to INITIALIZING', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      await flushPromises();

      expect(engineFactory.create).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'test-session' }));
      expect(mockEngine.initialize).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('sess-uuid-1', {
        status: SessionStatus.INITIALIZING,
      });
    });

    it('should throw BadRequestException if session already started', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      await expect(service.start('sess-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should execute session:starting hook before initializing engine', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      expect(hookManager.execute).toHaveBeenCalledWith(
        'session:starting',
        expect.objectContaining({ sessionId: 'sess-uuid-1' }),
        expect.any(Object),
      );
    });
  });

  describe('restart', () => {
    it('should reject restart when session was never linked', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);

      await expect(service.restart('sess-uuid-1')).rejects.toThrow(BadRequestException);
    });

    it('should destroy engine and re-initialize for linked session', async () => {
      const session = createMockSession({ phone: '628123', status: SessionStatus.READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      mockEngine.destroy.mockClear();
      mockEngine.initialize.mockClear();

      await service.restart('sess-uuid-1');
      await flushPromises();

      expect(mockEngine.destroy).toHaveBeenCalled();
      expect(engineFactory.create).toHaveBeenCalledTimes(2);
      expect(mockEngine.initialize).toHaveBeenCalled();
      expect(eventsGateway.emitSessionStatus).toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.INITIALIZING,
        expect.objectContaining({ restarting: true }),
      );
    });
  });

  describe('stop', () => {
    it('should disconnect engine and set status to DISCONNECTED', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      // Start first
      await service.start('sess-uuid-1');

      // Stop
      await service.stop('sess-uuid-1');

      expect(mockEngine.disconnect).toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalledWith('sess-uuid-1', {
        status: SessionStatus.DISCONNECTED,
      });
    });
  });

  // ── getQRCode ─────────────────────────────────────────────────────

  describe('getQRCode', () => {
    it('should return empty QR when engine is not started', async () => {
      const session = createMockSession({ status: SessionStatus.INITIALIZING });
      (repository.findOne as jest.Mock).mockResolvedValue(session);

      const result = await service.getQRCode('sess-uuid-1');

      expect(result.qrCode).toBe('');
      expect(result.status).toBe(SessionStatus.INITIALIZING);
    });

    it('should return QR code from engine', async () => {
      const session = createMockSession({ status: SessionStatus.QR_READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      mockEngine.getQRCode.mockReturnValue('data:image/png;base64,iVBOR...');

      const result = await service.getQRCode('sess-uuid-1');

      expect(result.qrCode).toBe('data:image/png;base64,iVBOR...');
    });

    it('should return empty qr when session is READY (already authenticated)', async () => {
      const session = createMockSession({ status: SessionStatus.READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      await flushPromises();
      mockEngine.getQRCode.mockReturnValue(null);

      const result = await service.getQRCode('sess-uuid-1');

      expect(result.qrCode).toBe('');
      expect(result.status).toBe(SessionStatus.READY);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should return correct session statistics', async () => {
      const sessions = [
        createMockSession({ status: SessionStatus.READY }),
        createMockSession({ id: 'sess-2', status: SessionStatus.READY }),
        createMockSession({ id: 'sess-3', status: SessionStatus.DISCONNECTED }),
      ];
      (repository.find as jest.Mock).mockResolvedValue(sessions);

      const stats = await service.getStats();

      expect(stats.total).toBe(3);
      expect(stats.ready).toBe(2);
      expect(stats.disconnected).toBe(1);
      expect(stats.byStatus[SessionStatus.READY]).toBe(2);
      expect(stats.memoryUsage).toBeDefined();
    });
  });

  // ── getActiveCount / isActive ─────────────────────────────────────

  describe('getActiveCount', () => {
    it('should return 0 when no engines are running', () => {
      expect(service.getActiveCount()).toBe(0);
    });

    it('should return correct count after starting sessions', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      expect(service.getActiveCount()).toBe(1);
    });
  });

  describe('isActive', () => {
    it('should return false for inactive session', () => {
      expect(service.isActive('nonexistent')).toBe(false);
    });

    it('should return true for active session', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      expect(service.isActive('sess-uuid-1')).toBe(true);
    });
  });

  // ── onModuleInit ──────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should reset active sessions to DISCONNECTED on startup', async () => {
      (repository.update as jest.Mock).mockResolvedValue({ affected: 3 });
      (repository.find as jest.Mock).mockResolvedValue([]);

      await service.onModuleInit();

      expect(repository.update).toHaveBeenCalledWith(expect.objectContaining({ status: expect.anything() as string }), {
        status: SessionStatus.DISCONNECTED,
      });
    });
  });

  // ── onModuleDestroy ───────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should destroy all running engines on shutdown', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      await service.onModuleDestroy();

      expect(mockEngine.destroy).toHaveBeenCalled();
      expect(service.getActiveCount()).toBe(0);
    });
  });

  describe('engine callbacks', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('onAuthFailure marks session failed with auth_failure code', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onAuthFailure: (reason: string) => void;
      };
      initArg.onAuthFailure('Authentication failed');
      await flushPromises();

      expect(eventsGateway.emitSessionStatus).toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.FAILED,
        expect.objectContaining({ failureCode: 'auth_failure' }),
      );
    });

    it('onReady schedules background sync instead of immediate media backfill', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
      };
      initArg.onReady('628123', 'Test');
      await flushPromises();

      expect(messageServiceMock.backfillUncachedMedia).not.toHaveBeenCalled();
      expect(backgroundSyncMock.scheduleAfterReady).toHaveBeenCalledWith('sess-uuid-1');
    });

    it('transient disconnect during loading_chats schedules connect-phase reconnect', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onStateChanged: (state: string) => void;
        onDisconnected: (reason: string) => void;
      };
      initArg.onStateChanged('loading_chats');
      await flushPromises();
      initArg.onDisconnected('NAVIGATION');
      await flushPromises();

      expect(eventsGateway.emitSessionStatus).not.toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.FAILED,
        expect.anything(),
      );
      expect(eventsGateway.emitSessionStatus).toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.INITIALIZING,
        expect.objectContaining({ reconnecting: true }),
      );
    });

    it('terminal disconnect during loading_chats marks session failed', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onStateChanged: (state: string) => void;
        onDisconnected: (reason: string) => void;
      };
      initArg.onStateChanged('loading_chats');
      await flushPromises();
      initArg.onDisconnected('LOGOUT');
      await flushPromises();

      expect(eventsGateway.emitSessionStatus).toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.FAILED,
        expect.objectContaining({ failureCode: 'disconnected_before_ready' }),
      );
    });

    it('getQRCode returns live engine status when ahead of DB row', async () => {
      const session = createMockSession({ status: SessionStatus.QR_READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      mockEngine.getQRCode.mockReturnValue(null);
      mockEngine.getStatus.mockReturnValue('authenticating');

      const result = await service.getQRCode('sess-uuid-1');
      expect(result.status).toBe(SessionStatus.AUTHENTICATING);
    });

    it('updateStatus dispatches session lifecycle webhooks', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
        onDisconnected: (reason: string) => void;
        onStateChanged: (state: string) => void;
      };
      initArg.onStateChanged('loading_chats');
      await flushPromises();
      initArg.onReady('628123', 'Test User');
      await flushPromises();
      initArg.onDisconnected('NAVIGATION');
      await flushPromises();

      expect(webhookService.dispatch).toHaveBeenCalledWith(
        'sess-uuid-1',
        'session.ready',
        expect.objectContaining({ phone: '628123', pushName: 'Test User' }),
      );
      expect(webhookService.dispatch).toHaveBeenCalledWith(
        'sess-uuid-1',
        'session.disconnected',
        expect.objectContaining({ reason: 'NAVIGATION' }),
      );
    });

    it('restart init failure schedules reconnect instead of marking FAILED', async () => {
      const session = createMockSession({ phone: '628123', status: SessionStatus.READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      await flushPromises();
      mockEngine.initialize.mockRejectedValueOnce(new Error('browser crash'));

      await service.restart('sess-uuid-1');
      await flushPromises();

      expect(eventsGateway.emitSessionStatus).not.toHaveBeenCalledWith(
        'sess-uuid-1',
        SessionStatus.FAILED,
        expect.objectContaining({ failureCode: 'browser_crash' }),
      );
    });

    it('infinite reconnect resets attempt counter at max budget', async () => {
      const configGet = (service as unknown as { configService: { get: jest.Mock } }).configService
        .get;
      configGet.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'session.reconnectInfinite') return true;
        if (key === 'session.maxReconnectAttempts') return 1;
        if (key === 'session.reconnectBaseDelayMs') return 10;
        if (key === 'session.reconnectMaxDelayMs') return 100;
        if (key === 'session.connectMaxReconnectAttempts') return 20;
        if (key === 'engine.wa.slowConnectNoticeMs') return 60_000;
        if (key === 'engine.wa.sessionReadyTimeoutMs') return 0;
        if (key === 'engine.sessionDataPath') return './data/sessions';
        return defaultValue;
      });

      const session = createMockSession({ phone: '628123' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
      };
      initArg.onReady('628123', 'Test');
      await flushPromises();

      const reconnectStates = (
        service as unknown as { reconnectStates: Map<string, { attempts: number; timer: unknown }> }
      ).reconnectStates;
      const state = reconnectStates.get('sess-uuid-1');
      expect(state).toBeDefined();
      state!.attempts = 1;

      (
        service as unknown as { scheduleReconnect: (id: string, s: Session) => void }
      ).scheduleReconnect('sess-uuid-1', session);

      expect(state!.attempts).toBe(1);
      expect(state!.timer).not.toBeNull();
    });

    it('onReady clears pending runtime reconnect timer so reconnect does not destroy live engine', async () => {
      const session = createMockSession({ phone: '628123' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
        onDisconnected: (reason: string) => void;
      };
      initArg.onReady('628123', 'Test');
      await flushPromises();

      mockEngine.destroy.mockClear();
      engineFactory.create.mockClear();

      initArg.onDisconnected('440');
      await flushPromises();

      const reconnectStates = (
        service as unknown as { reconnectStates: Map<string, { attempts: number; timer: unknown }> }
      ).reconnectStates;
      const state = reconnectStates.get('sess-uuid-1');
      expect(state?.timer).not.toBeNull();

      initArg.onReady('628123', 'Test');
      await flushPromises();
      expect(state?.timer).toBeNull();

      await (
        service as unknown as {
          executeReconnect: (id: string, s: Session, st: { timer: unknown }) => Promise<void>;
        }
      ).executeReconnect('sess-uuid-1', session, state!);
      await flushPromises();

      expect(mockEngine.destroy).not.toHaveBeenCalled();
      expect(engineFactory.create).not.toHaveBeenCalled();
    });
  });

  describe('linking mode', () => {
    it('enables linking mode by default when session has no phone', async () => {
      const session = createMockSession({ phone: null });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      expect(service.isInLinkingMode('sess-uuid-1')).toBe(true);
    });

    it('disables linking mode for background start of linked session', async () => {
      const session = createMockSession({ phone: '628123' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1', { linkingMode: false });

      expect(service.isInLinkingMode('sess-uuid-1')).toBe(false);
    });

    it('clears linking mode when session becomes ready', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      expect(service.isInLinkingMode('sess-uuid-1')).toBe(true);

      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
      };
      initArg.onReady('628123', 'Test');
      await flushPromises();

      expect(service.isInLinkingMode('sess-uuid-1')).toBe(false);
    });

    it('relink enables linkingMode and onDisconnected does not schedule runtime reconnect', async () => {
      const session = createMockSession({ phone: '628123', status: SessionStatus.READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onReady: (phone: string, pushName: string) => void;
        onDisconnected: (reason: string) => void;
      };
      initArg.onReady('628123', 'Test');
      await flushPromises();

      await service.relink('sess-uuid-1');
      await flushPromises();

      expect(service.isInLinkingMode('sess-uuid-1')).toBe(true);

      (
        service as unknown as { initReconnectStates: (id: string, s: Session) => void }
      ).initReconnectStates('sess-uuid-1', session);

      initArg.onDisconnected('closed');
      await flushPromises();

      const reconnectStates = (
        service as unknown as { reconnectStates: Map<string, { attempts: number; timer: unknown }> }
      ).reconnectStates;
      expect(reconnectStates.has('sess-uuid-1')).toBe(false);
    });

    it('scheduleReconnect skips when linkingMode is active after relink', async () => {
      const session = createMockSession({ phone: '628123' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      await service.relink('sess-uuid-1');
      await flushPromises();

      (
        service as unknown as { initReconnectStates: (id: string, s: Session) => void }
      ).initReconnectStates('sess-uuid-1', session);

      (
        service as unknown as { scheduleReconnect: (id: string, s: Session) => void }
      ).scheduleReconnect('sess-uuid-1', session);

      const reconnectStates = (
        service as unknown as { reconnectStates: Map<string, { attempts: number; timer: unknown }> }
      ).reconnectStates;
      expect(reconnectStates.get('sess-uuid-1')?.timer).toBeNull();
    });

    it('onDisconnected during active relink linking (engine running) schedules reconnect', async () => {
      const session = createMockSession({ phone: '628123' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1', { linkingMode: true });
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onDisconnected: (reason: string) => void;
      };

      (
        service as unknown as { sessionStatuses: Map<string, SessionStatus> }
      ).sessionStatuses.set('sess-uuid-1', SessionStatus.DISCONNECTED);

      initArg.onDisconnected('515');
      await flushPromises();

      const reconnectStates = (
        service as unknown as {
          reconnectStates: Map<string, { attempts: number; timer: unknown }>;
        }
      ).reconnectStates;
      expect(reconnectStates.get('sess-uuid-1')?.timer).not.toBeNull();
    });

    it('onDisconnected during first-time QR linking schedules connect reconnect', async () => {
      const session = createMockSession({ phone: null });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      const initArg = mockEngine.initialize.mock.calls[0][0] as {
        onDisconnected: (reason: string) => void;
      };

      (
        service as unknown as { sessionStatuses: Map<string, SessionStatus> }
      ).sessionStatuses.set('sess-uuid-1', SessionStatus.DISCONNECTED);

      initArg.onDisconnected('515');
      await flushPromises();

      const connectStates = (
        service as unknown as {
          connectReconnectStates: Map<string, { attempts: number; timer: unknown }>;
        }
      ).connectReconnectStates;
      expect(connectStates.get('sess-uuid-1')?.timer).not.toBeNull();
    });
  });

  describe('resolveEngineType and updateEngineType', () => {
    it('inherits global ENGINE_TYPE when session override is null', () => {
      const session = createMockSession({ engineType: null });
      expect(service.resolveEngineType(session)).toBe('whatsapp-web.js');
    });

    it('ignores stored session override and uses global ENGINE_TYPE', () => {
      const session = createMockSession({ engineType: 'baileys' });
      expect(service.resolveEngineType(session)).toBe('whatsapp-web.js');
    });

    it('passes global engineType to engine factory on start', async () => {
      const session = createMockSession({ engineType: 'baileys' });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');

      expect(engineFactory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.name,
          engineType: 'whatsapp-web.js',
        }),
      );
    });

    it('updateEngineType clears override and stops running session', async () => {
      const session = createMockSession({
        phone: '628123',
        status: SessionStatus.READY,
        engineType: 'baileys',
      });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.save as jest.Mock).mockImplementation(async (s: Session) => s);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.start('sess-uuid-1');
      mockEngine.disconnect.mockClear();

      const result = await service.updateEngineType('sess-uuid-1', null);

      expect(mockEngine.disconnect).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ engineType: null }),
      );
      expect(result.engineType).toBeNull();
      expect(service.resolveEngineType(result)).toBe('whatsapp-web.js');
    });

    it('updateEngineType rejects non-null engine override', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);

      await expect(service.updateEngineType('sess-uuid-1', 'baileys')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateProxy', () => {
    it('should save proxy without restart when engine is not running', async () => {
      const session = createMockSession();
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.save as jest.Mock).mockImplementation(async (s: Session) => s);

      const restartSpy = jest.spyOn(service, 'restart');

      const result = await service.updateProxy('sess-uuid-1', {
        proxyUrl: 'socks5://user:pass@proxy:1080',
        proxyType: 'socks5',
      });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          proxyUrl: 'socks5://user:pass@proxy:1080',
          proxyType: 'socks5',
        }),
      );
      expect(restartSpy).not.toHaveBeenCalled();
      expect(result.proxyUrl).toBe('socks5://user:pass@proxy:1080');
    });

    it('should clear proxy when proxyUrl is empty', async () => {
      const session = createMockSession({
        proxyUrl: 'socks5://old:1080',
        proxyType: 'socks5',
      });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.save as jest.Mock).mockImplementation(async (s: Session) => s);

      const result = await service.updateProxy('sess-uuid-1', { proxyUrl: null });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ proxyUrl: null, proxyType: null }),
      );
      expect(result.proxyUrl).toBeNull();
    });

    it('should restart session when engine is running', async () => {
      const session = createMockSession({ phone: '628123', status: SessionStatus.READY });
      (repository.findOne as jest.Mock).mockResolvedValue(session);
      (repository.update as jest.Mock).mockResolvedValue({ affected: 1 });
      (repository.save as jest.Mock).mockImplementation(async (s: Session) => s);

      await service.start('sess-uuid-1');
      mockEngine.destroy.mockClear();
      mockEngine.initialize.mockClear();

      await service.updateProxy('sess-uuid-1', {
        proxyUrl: 'socks5://user:pass@proxy:1080',
        proxyType: 'socks5',
      });
      await flushPromises();

      expect(mockEngine.destroy).toHaveBeenCalled();
      expect(mockEngine.initialize).toHaveBeenCalled();
    });
  });
});
