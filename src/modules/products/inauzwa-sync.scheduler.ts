import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';

@Injectable()
export class InauzwaSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InauzwaSyncScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly syncService: InauzwaSyncService,
    private readonly preferences: InauzwaSyncPreferencesService,
  ) {}

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

    const prefs = await this.preferences.get();
    if (!prefs.autoSyncEnabled) return;

    if (!(await this.syncService.isConfigured())) return;

    const branchId = await this.preferences.resolveEffectiveBranchId();
    if (!branchId) return;

    const intervalMs = prefs.autoSyncIntervalMinutes * 60_000;
    if (prefs.lastSyncAt) {
      const elapsed = Date.now() - prefs.lastSyncAt.getTime();
      if (elapsed < intervalMs) return;
    }

    this.running = true;
    try {
      this.logger.log(`Auto-sync INAUZWA branch ${branchId}`);
      await this.syncService.sync({
        branchId,
        vendorId: await this.preferences.resolveEffectiveVendorId(),
        mode: 'merge',
        activeOnly: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`INAUZWA auto-sync failed: ${msg}`);
    } finally {
      this.running = false;
    }
  }
}
