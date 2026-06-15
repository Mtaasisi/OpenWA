import { Injectable } from '@nestjs/common';
import type { AiConfig } from '../entities/ai-config.entity';
import { AiSettingsService } from '../ai-settings.service';

/** Short-lived cache to avoid repeated getActiveConfig() calls within one auto-reply burst. */
@Injectable()
export class AiConfigCacheService {
  private cached: AiConfig | null = null;
  private cachedAt = 0;
  private readonly ttlMs = 5000;

  constructor(private readonly aiSettings: AiSettingsService) {}

  async getActiveConfig(): Promise<AiConfig | null> {
    const now = Date.now();
    if (this.cached && now - this.cachedAt < this.ttlMs) {
      return this.cached;
    }
    this.cached = await this.aiSettings.getActiveConfig();
    this.cachedAt = now;
    return this.cached;
  }

  invalidate(): void {
    this.cached = null;
    this.cachedAt = 0;
  }
}
