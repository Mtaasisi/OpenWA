import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventsGateway } from '../events/events.gateway';
import { StorageUsageService } from './storage-usage.service';

const POLL_MS = 5 * 60_000;

@Injectable()
export class StorageWarningWatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageWarningWatcher.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private knownWarningIds = new Set<string>();

  constructor(
    private readonly usageService: StorageUsageService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const warnings = await this.usageService.getWarnings();
      const nextIds = new Set(warnings.map(w => w.id));
      for (const warning of warnings) {
        if (!this.knownWarningIds.has(warning.id)) {
          this.eventsGateway.emitStorageWarning({
            id: warning.id,
            message: warning.message,
            severity: warning.severity,
          });
        }
      }
      this.knownWarningIds = nextIds;
    } catch (err) {
      this.logger.debug(
        `Storage warning poll failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
