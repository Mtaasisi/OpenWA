jest.mock('../../engine/engine.factory', () => ({
  EngineFactory: class MockEngineFactory {},
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionHealthMonitorService } from './session-health-monitor.service';
import { SessionService } from './session.service';
import { SessionStatus } from './entities/session.entity';
import { EngineStatus } from '../../engine/interfaces/whatsapp-engine.interface';

const flushPromises = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

describe('SessionHealthMonitorService', () => {
  let service: SessionHealthMonitorService;
  let sessionService: {
    getHealthOverview: jest.Mock;
    canAcceptHealthRestart: jest.Mock;
    markHealthRestart: jest.Mock;
    restart: jest.Mock;
    getConnectWatchdogAgeMs: jest.Mock;
  };

  beforeEach(async () => {
    sessionService = {
      getHealthOverview: jest.fn(),
      canAcceptHealthRestart: jest.fn().mockReturnValue(true),
      markHealthRestart: jest.fn(),
      restart: jest.fn().mockResolvedValue({}),
      getConnectWatchdogAgeMs: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionHealthMonitorService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'session.healthMonitorEnabled') return true;
              if (key === 'session.healthMonitorIntervalMs') return 60_000;
              if (key === 'session.healthAutoRestart') return true;
              if (key === 'engine.wa.sessionReadyTimeoutMs') return 0;
              return defaultValue;
            }),
          },
        },
        { provide: SessionService, useValue: sessionService },
      ],
    }).compile();

    service = module.get(SessionHealthMonitorService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('auto-restarts ghost ready session with no engine', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.READY,
        liveStatus: SessionStatus.READY,
        enginePresent: false,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).toHaveBeenCalledWith('s1');
  });

  it('skips sessions in linking mode', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.DISCONNECTED,
        liveStatus: SessionStatus.INITIALIZING,
        enginePresent: false,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: true,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).not.toHaveBeenCalled();
  });

  it('skips sessions that need engine relink after switch', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.DISCONNECTED,
        liveStatus: SessionStatus.DISCONNECTED,
        enginePresent: false,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: true,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).not.toHaveBeenCalled();
  });

  it('skips failed sessions (ban/auth failure needs manual QR)', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.FAILED,
        liveStatus: SessionStatus.FAILED,
        enginePresent: false,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).not.toHaveBeenCalled();
  });

  it('skips sessions still in connect phase', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.DISCONNECTED,
        liveStatus: SessionStatus.QR_READY,
        enginePresent: true,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).not.toHaveBeenCalled();
  });

  it('skips manually stopped sessions', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.DISCONNECTED,
        liveStatus: SessionStatus.DISCONNECTED,
        enginePresent: false,
        pendingReconnect: false,
        manuallyStopped: true,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).not.toHaveBeenCalled();
  });

  it('restarts when engine status drifted to disconnected', async () => {
    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.READY,
        liveStatus: SessionStatus.READY,
        enginePresent: true,
        engineStatus: EngineStatus.DISCONNECTED,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await service.onModuleInit();
    await flushPromises();

    expect(sessionService.restart).toHaveBeenCalledWith('s1');
  });

  it('runs weekly scheduled restart for ready linked sessions', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-07T04:00:00.000Z'));

    const configGet = (service as unknown as { configService: { get: jest.Mock } }).configService
      .get;
    configGet.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'session.healthMonitorEnabled') return true;
      if (key === 'session.healthMonitorIntervalMs') return 60_000;
      if (key === 'session.healthAutoRestart') return false;
      if (key === 'session.scheduledRestartEnabled') return true;
      if (key === 'session.scheduledRestartDay') return 0;
      if (key === 'session.scheduledRestartTime') return '03:00';
      if (key === 'engine.wa.sessionReadyTimeoutMs') return 0;
      return defaultValue;
    });

    sessionService.getHealthOverview.mockResolvedValue([
      {
        sessionId: 's1',
        name: 'sales',
        dbStatus: SessionStatus.READY,
        liveStatus: SessionStatus.READY,
        enginePresent: true,
        engineStatus: EngineStatus.READY,
        pendingReconnect: false,
        manuallyStopped: false,
        linkingMode: false,
        requiresRelink: false,
        backgroundSyncing: false,
      },
    ]);

    await (service as unknown as { tick: () => Promise<void> }).tick();

    expect(sessionService.restart).toHaveBeenCalledWith('s1');
    jest.useRealTimers();
  });
});
