import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLog } from '../entities/ai-usage-log.entity';
import { AiModelPricing } from '../entities/ai-model-pricing.entity';
import {
  AiCallContext,
  AiUsageFeature,
  AiUsageStatus,
  DEFAULT_FEATURE_LIMITS,
  type AiFeatureLimits,
} from './ai-cost.types';

const DEFAULT_PRICING_SEED: Array<{
  provider: string;
  model: string;
  input: number;
  output: number;
}> = [
  { provider: 'OPENAI', model: 'gpt-4o-mini', input: 0.15, output: 0.6 },
  { provider: 'OPENAI', model: 'gpt-4o', input: 2.5, output: 10 },
  { provider: 'OPENAI', model: 'gpt-4.1', input: 2, output: 8 },
  { provider: 'ANTHROPIC', model: 'claude-haiku-4-5-20251001', input: 0.8, output: 4 },
  { provider: 'ANTHROPIC', model: 'claude-sonnet-4-6', input: 3, output: 15 },
  { provider: 'ANTHROPIC', model: 'claude-opus-4-6', input: 15, output: 75 },
  { provider: 'GEMINI', model: 'gemini-2.5-flash-lite', input: 0.075, output: 0.3 },
  { provider: 'GEMINI', model: 'gemini-2.5-flash', input: 0.15, output: 0.6 },
  { provider: 'GEMINI', model: 'gemini-2.5-pro', input: 1.25, output: 10 },
  { provider: 'OPENAI', model: 'text-embedding-3-small', input: 0.02, output: 0 },
  { provider: 'GEMINI', model: 'text-embedding-004', input: 0.025, output: 0 },
];

export interface RecordUsageInput {
  context?: AiCallContext;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  toolCallsCount?: number;
  aiCallsCount?: number;
  status?: AiUsageStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  apiKeyLabel?: string;
}

@Injectable()
export class AiCostTrackerService implements OnModuleInit {
  private readonly logger = new Logger(AiCostTrackerService.name);

  constructor(
    @InjectRepository(AiUsageLog, 'data')
    private readonly usageRepo: Repository<AiUsageLog>,
    @InjectRepository(AiModelPricing, 'data')
    private readonly pricingRepo: Repository<AiModelPricing>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      for (const row of DEFAULT_PRICING_SEED) {
        const existing = await this.pricingRepo.findOne({
          where: { provider: row.provider, model: row.model, isActive: true },
        });
        if (!existing) {
          await this.pricingRepo.save(
            this.pricingRepo.create({
              provider: row.provider,
              model: row.model,
              inputCostPer1MTokens: row.input,
              outputCostPer1MTokens: row.output,
              currency: 'USD',
              isActive: true,
            }),
          );
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to seed AI pricing: ${msg}`);
    }
  }

  async getPricing(provider: string, model: string): Promise<AiModelPricing | null> {
    const exact = await this.pricingRepo.findOne({
      where: { provider, model, isActive: true },
      order: { effectiveDate: 'DESC' },
    });
    if (exact) return exact;

    const all = await this.pricingRepo.find({ where: { provider, isActive: true } });
    const partial = all.find(p => model.includes(p.model) || p.model.includes(model));
    return partial ?? null;
  }

  calculateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    pricing?: AiModelPricing | null,
  ): { cost: number; pricingMissing: boolean } {
    const p = pricing ?? null;
    if (!p) {
      return { cost: 0, pricingMissing: true };
    }
    const inputCost = (inputTokens / 1_000_000) * Number(p.inputCostPer1MTokens);
    const outputCost = (outputTokens / 1_000_000) * Number(p.outputCostPer1MTokens);
    return { cost: inputCost + outputCost, pricingMissing: false };
  }

  async estimateCost(
    provider: string,
    model: string,
    estimatedInputTokens = 2000,
    estimatedOutputTokens = 200,
  ): Promise<number> {
    const pricing = await this.getPricing(provider, model);
    const { cost } = this.calculateCost(
      provider,
      model,
      estimatedInputTokens,
      estimatedOutputTokens,
      pricing,
    );
    return cost;
  }

  clampMaxTokens(feature: AiUsageFeature, requested: number, limits?: AiFeatureLimits | null): number {
    const merged = { ...DEFAULT_FEATURE_LIMITS, ...limits };
    let cap = merged[feature as keyof AiFeatureLimits] ?? 512;
    if (feature === AiUsageFeature.ADMIN_ASSISTANT) {
      cap = merged.admin_assistant ?? 1500;
    }
    if (requested > cap) {
      this.logger.debug(`Clamped maxTokens for ${feature}: ${requested} -> ${cap}`);
    }
    return Math.min(requested, cap);
  }

  async recordUsage(input: RecordUsageInput): Promise<void> {
    try {
      const inputTokens = input.inputTokens ?? 0;
      const outputTokens = input.outputTokens ?? 0;
      const pricing = await this.getPricing(input.provider, input.model);
      const { cost, pricingMissing } = this.calculateCost(
        input.provider,
        input.model,
        inputTokens,
        outputTokens,
        pricing,
      );

      const actualCost =
        input.actualCostUsd !== undefined ? input.actualCostUsd : cost;
      const estimatedCost =
        input.estimatedCostUsd !== undefined ? input.estimatedCostUsd : cost;

      const metadata = {
        ...(input.metadata ?? {}),
        ...(pricingMissing ? { pricingStatus: 'estimated_unknown_model' } : {}),
      };

      await this.usageRepo.save(
        this.usageRepo.create({
          workspaceId: null,
          branchId: input.context?.branchId ?? null,
          apiKeyLabel: input.apiKeyLabel ?? null,
          provider: input.provider,
          model: input.model,
          feature: input.context?.feature ?? AiUsageFeature.BACKGROUND_JOB,
          source: input.context?.source ?? 'background_job',
          conversationId: input.context?.conversationId ?? null,
          customerId: input.context?.customerId ?? null,
          messageId: input.context?.messageId ?? null,
          requestId: input.context?.requestId ?? null,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: estimatedCost,
          actualCostUsd: actualCost,
          currency: 'USD',
          toolCallsCount: input.toolCallsCount ?? 0,
          aiCallsCount: input.aiCallsCount ?? 1,
          status: input.status ?? AiUsageStatus.SUCCESS,
          errorMessage: input.errorMessage?.slice(0, 500) ?? null,
          metadata,
        }),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AI usage log failed: ${msg}`);
    }
  }

  async sumCostSince(since: Date, feature?: string): Promise<number> {
    const qb = this.usageRepo
      .createQueryBuilder('log')
      .select('SUM(log.actualCostUsd)', 'total')
      .where('log.createdAt >= :since', { since })
      .andWhere('log.status IN (:...statuses)', {
        statuses: [AiUsageStatus.SUCCESS, AiUsageStatus.FAILED],
      });
    if (feature) {
      qb.andWhere('log.feature = :feature', { feature });
    }
    const row = await qb.getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }

  async sumCostBetween(start: Date, end: Date, feature?: string): Promise<number> {
    const qb = this.usageRepo
      .createQueryBuilder('log')
      .select('SUM(log.actualCostUsd)', 'total')
      .where('log.createdAt >= :start', { start })
      .andWhere('log.createdAt < :end', { end })
      .andWhere('log.status IN (:...statuses)', {
        statuses: [AiUsageStatus.SUCCESS, AiUsageStatus.FAILED],
      });
    if (feature) {
      qb.andWhere('log.feature = :feature', { feature });
    }
    const row = await qb.getRawOne<{ total: string | null }>();
    return Number(row?.total ?? 0);
  }
}
