import { Injectable } from '@nestjs/common';
import { AiSettingsService } from '../ai-settings.service';
import { AiModelTier, AiUsageFeature } from './ai-cost.types';
import { resolveModelRoute, type ResolvedModelRoute } from './ai-model-router.util';

@Injectable()
export class AiModelRouterService {
  constructor(private readonly aiSettings: AiSettingsService) {}

  async resolveForFeature(
    feature: AiUsageFeature,
    tierOverride?: AiModelTier,
  ): Promise<ResolvedModelRoute | null> {
    const config = await this.aiSettings.getActiveConfig();
    if (!config) return null;
    return resolveModelRoute(config, feature, tierOverride);
  }
}
