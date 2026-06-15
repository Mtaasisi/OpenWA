import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackupService } from './backup.service';
import type { BackupSettings } from './entities/backup-settings.entity';
import type { BackupRecord } from './entities/backup-record.entity';

@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastRunKey: string | null = null;

  constructor(private readonly backupService: BackupService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
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
      const settings = await this.backupService.getSettings();
      if (settings.schedule === 'manual') return;

      const last = await this.backupService.getLastSuccessfulBackup();
      if (!this.isDue(settings, last)) return;

      const runKey = this.runKey(settings, new Date());
      if (this.lastRunKey === runKey) return;

      this.logger.log(`Running scheduled backup (${settings.schedule})`);
      await this.backupService.create(
        {
          backupType: 'full',
          mediaScope: settings.mediaScope,
          includeMedia: settings.includeMedia,
        },
        'scheduler',
      );
      this.lastRunKey = runKey;
    } catch (err) {
      this.logger.warn(`Scheduled backup failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private runKey(settings: BackupSettings, now: Date): string {
    return `${settings.schedule}:${now.toISOString().slice(0, 10)}:${settings.backupTime}`;
  }

  private isDue(settings: BackupSettings, last: BackupRecord | null): boolean {
    const now = new Date();
    const slot = this.parseSlot(now, settings.backupTime);
    if (now < slot) return false;

    if (!last) return true;

    const lastAt = new Date(last.createdAt);
    switch (settings.schedule) {
      case 'daily':
        return lastAt < slot;
      case 'weekly': {
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        return now.getTime() - lastAt.getTime() >= weekMs && lastAt < slot;
      }
      case 'monthly':
        return (
          lastAt.getFullYear() < now.getFullYear() ||
          lastAt.getMonth() < now.getMonth() ||
          lastAt < slot
        );
      default:
        return false;
    }
  }

  private parseSlot(reference: Date, backupTime: string): Date {
    const [hhRaw, mmRaw] = backupTime.split(':');
    const hh = Number(hhRaw) || 2;
    const mm = Number(mmRaw) || 0;
    const slot = new Date(reference);
    slot.setHours(hh, mm, 0, 0);
    return slot;
  }
}
