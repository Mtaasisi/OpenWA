import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMemoryService } from './ai-memory.service';

@Injectable()
export class AiMemoryDreamScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMemoryDreamScheduler.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly memoryService: AiMemoryService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const hours = this.configService.get<number>('ai.memoryDreamIntervalHours', 0);
    if (!hours || hours <= 0) return;

    const ms = hours * 60 * 60 * 1000;
    this.timer = setInterval(() => void this.runDream(), ms);
    this.logger.log(`Memory dream scheduled every ${hours} hour(s)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runDream(): Promise<void> {
    try {
      const result = await this.memoryService.runDreaming();
      if (result.promoted > 0) {
        this.logger.log(`Scheduled memory dream promoted ${result.promoted} snippet(s)`);
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Scheduled memory dream failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
