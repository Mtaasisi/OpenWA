import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { SessionStatus } from './entities/session.entity';
import { EngineStatus } from '../../engine/interfaces/whatsapp-engine.interface';
import { createLogger } from '../../common/services/logger.service';

@Injectable()
export class SessionHealthMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createLogger('SessionHealthMonitor');
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastScheduledRestartKey: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get<boolean>('session.healthMonitorEnabled', true);
    if (!enabled) {
      this.logger.log('Session health monitor disabled', { action: 'health_monitor_disabled' });
      return;
    }

    const intervalMs = this.configService.get<number>('session.healthMonitorIntervalMs', 60_000);
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
    void this.tick();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.maybeRunScheduledRestart();

      const autoRestart = this.configService.get<boolean>('session.healthAutoRestart', true);
      const overview = await this.sessionService.getHealthOverview();
      const readyTimeoutMs = this.configService.get<number>('engine.wa.sessionReadyTimeoutMs', 0);

      for (const entry of overview) {
        if (entry.manuallyStopped) continue;
        if (entry.linkingMode) continue;
        if (entry.requiresRelink) continue;
        if (entry.pendingReconnect) continue;
        if (!autoRestart) continue;
        if (!this.sessionService.canAcceptHealthRestart(entry.sessionId)) continue;

        const reason = this.detectIssue(entry, readyTimeoutMs);
        if (!reason) continue;

        this.logger.warn(`Health monitor restarting session ${entry.name}: ${reason}`, {
          sessionId: entry.sessionId,
          reason,
          action: 'health_monitor_restart',
        });

        try {
          this.sessionService.markHealthRestart(entry.sessionId);
          await this.sessionService.restart(entry.sessionId);
        } catch (err) {
          this.logger.warn(`Health monitor restart failed for ${entry.name}`, {
            sessionId: entry.sessionId,
            error: err instanceof Error ? err.message : String(err),
            action: 'health_monitor_restart_failed',
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Health monitor tick failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private detectIssue(
    entry: Awaited<ReturnType<SessionService['getHealthOverview']>>[number],
    readyTimeoutMs: number,
  ): string | null {
    const connecting: SessionStatus[] = [
      SessionStatus.INITIALIZING,
      SessionStatus.QR_READY,
      SessionStatus.AUTHENTICATING,
      SessionStatus.LOADING_CHATS,
    ];

    if (
      (entry.liveStatus === SessionStatus.READY || entry.dbStatus === SessionStatus.READY) &&
      !entry.enginePresent
    ) {
      return 'ghost_ready_no_engine';
    }

    if (
      entry.enginePresent &&
      entry.engineStatus === EngineStatus.DISCONNECTED &&
      (entry.liveStatus === SessionStatus.READY || entry.dbStatus === SessionStatus.READY)
    ) {
      return 'engine_disconnected_status_drift';
    }

    if (connecting.includes(entry.liveStatus) || connecting.includes(entry.dbStatus)) {
      return null;
    }

    if (entry.dbStatus === SessionStatus.FAILED) {
      return null;
    }

    if (entry.dbStatus === SessionStatus.DISCONNECTED) {
      return 'linked_session_disconnected';
    }

    if (readyTimeoutMs > 0 && connecting.includes(entry.liveStatus)) {
      const ageMs = this.sessionService.getConnectWatchdogAgeMs(entry.sessionId);
      if (ageMs != null && ageMs > readyTimeoutMs) {
        return 'connect_phase_stuck';
      }
    }

    return null;
  }

  private async maybeRunScheduledRestart(): Promise<void> {
    const enabled = this.configService.get<boolean>('session.scheduledRestartEnabled', false);
    if (!enabled) return;

    const day = this.configService.get<number>('session.scheduledRestartDay', 0);
    const time = this.configService.get<string>('session.scheduledRestartTime', '03:00');
    const now = new Date();
    if (now.getDay() !== day) return;

    const slot = this.parseTimeSlot(now, time);
    if (now < slot) return;

    const runKey = `weekly:${day}:${now.toISOString().slice(0, 10)}:${time}`;
    if (this.lastScheduledRestartKey === runKey) return;

    const overview = await this.sessionService.getHealthOverview();
    let restarted = 0;

    for (const entry of overview) {
      if (entry.manuallyStopped) continue;
      if (entry.linkingMode) continue;
      if (entry.pendingReconnect) continue;
      if (entry.liveStatus !== SessionStatus.READY && entry.dbStatus !== SessionStatus.READY) {
        continue;
      }
      if (!this.sessionService.canAcceptHealthRestart(entry.sessionId)) continue;

      try {
        this.sessionService.markHealthRestart(entry.sessionId);
        await this.sessionService.restart(entry.sessionId);
        restarted++;
      } catch (err) {
        this.logger.warn(`Scheduled restart failed for ${entry.name}`, {
          sessionId: entry.sessionId,
          error: err instanceof Error ? err.message : String(err),
          action: 'scheduled_restart_failed',
        });
      }
    }

    this.lastScheduledRestartKey = runKey;
    if (restarted > 0) {
      this.logger.log(`Scheduled weekly restart completed for ${restarted} session(s)`, {
        action: 'scheduled_restart',
        restarted,
        runKey,
      });
    }
  }

  private parseTimeSlot(reference: Date, time: string): Date {
    const [hhRaw, mmRaw] = time.split(':');
    const hh = Number(hhRaw) || 3;
    const mm = Number(mmRaw) || 0;
    const slot = new Date(reference);
    slot.setHours(hh, mm, 0, 0);
    return slot;
  }
}
