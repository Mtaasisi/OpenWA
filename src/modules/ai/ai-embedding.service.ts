import { Injectable, Logger, Optional } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiProvider } from './ai.enums';
import { normalizeEmbeddingDim } from './utils/ai-embedding.util';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';
import { AiUsageFeature, AiUsageSource, AiUsageStatus } from './cost/ai-cost.types';

@Injectable()
export class AiEmbeddingService {
  private readonly logger = new Logger(AiEmbeddingService.name);

  constructor(
    private readonly aiSettings: AiSettingsService,
    @Optional() private readonly costTracker?: AiCostTrackerService,
  ) {}

  /** Returns null when embeddings are unavailable (no key or unsupported provider). */
  async embed(text: string, feature: AiUsageFeature = AiUsageFeature.MEMORY_UPDATE): Promise<number[] | null> {
    const trimmed = text.trim().slice(0, 8000);
    if (!trimmed) return null;

    const config = await this.aiSettings.getActiveConfig();
    if (!config?.enabled) return null;

    let apiKey: string;
    try {
      apiKey = this.aiSettings.decryptKey(config);
    } catch {
      return null;
    }
    if (!apiKey) return null;

    try {
      let result: number[] | null = null;
      let embeddingModel = 'text-embedding-3-small';
      switch (config.provider) {
        case AiProvider.OPENAI:
          embeddingModel = 'text-embedding-3-small';
          result = await this.embedOpenAi(trimmed, apiKey, 'https://api.openai.com/v1', embeddingModel);
          break;
        case AiProvider.GEMINI:
          embeddingModel = 'text-embedding-004';
          result = await this.embedOpenAi(
            trimmed,
            apiKey,
            'https://generativelanguage.googleapis.com/v1beta/openai',
            embeddingModel,
          );
          break;
        case AiProvider.OPENROUTER:
          embeddingModel = 'text-embedding-3-small';
          result = await this.embedOpenAi(trimmed, apiKey, 'https://openrouter.ai/api/v1', embeddingModel);
          break;
        case AiProvider.CUSTOM:
          if (config.baseUrl) {
            embeddingModel = 'text-embedding-3-small';
            result = await this.embedOpenAi(trimmed, apiKey, config.baseUrl, embeddingModel);
          }
          break;
        default:
          return null;
      }
      if (result && this.costTracker) {
        const estInput = Math.ceil(trimmed.length / 4);
        await this.costTracker.recordUsage({
          context: { feature, source: AiUsageSource.BACKGROUND_JOB },
          provider: config.provider,
          model: embeddingModel,
          inputTokens: estInput,
          outputTokens: 0,
          status: AiUsageStatus.SUCCESS,
        });
      }
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Embedding failed: ${msg}`);
      return null;
    }
  }

  private async embedOpenAi(
    text: string,
    apiKey: string,
    baseUrl: string,
    model: string,
  ): Promise<number[]> {
    const url = `${baseUrl.replace(/\/$/, '')}/embeddings`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: text }),
    });
    if (!res.ok) {
      throw new Error(`Embedding HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const vector = json.data?.[0]?.embedding;
    if (!vector?.length) throw new Error('Empty embedding vector');
    return normalizeEmbeddingDim(vector);
  }
}
