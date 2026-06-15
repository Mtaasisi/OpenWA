import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FollowupEngineService } from './followup-engine.service';
import { FollowupQueueService } from './followup-queue.service';
import { FollowupKpiService } from './followup-kpi.service';

@Injectable()
export class FollowupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowupSchedulerService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly engine: FollowupEngineService,
    private readonly queue: FollowupQueueService,
    private readonly kpi: FollowupKpiService,
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
    this.running = true;
    try {
      await this.engine.evaluateNoReplyRules();
      await this.engine.evaluateStaleConversations();
      await this.queue.processEscalations();
      await this.kpi.refreshDailyMetrics();
    } catch (err) {
      this.logger.warn(`Follow-up scheduler tick failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
