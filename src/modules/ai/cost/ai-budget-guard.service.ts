import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiConfig, AI_CONFIG_ID } from '../entities/ai-config.entity';
import { AiCostTrackerService } from './ai-cost-tracker.service';
import {
  AiCallContext,
  AiUsageFeature,
  AiUsageStatus,
} from './ai-cost.types';

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  dailyUsagePercent?: number;
  monthlyUsagePercent?: number;
  autoReplyDailyPercent?: number;
  atWarningThreshold?: boolean;
}

@Injectable()
export class AiBudgetGuardService {
  private readonly logger = new Logger(AiBudgetGuardService.name);

  constructor(
    @InjectRepository(AiConfig, 'data')
    private readonly configRepo: Repository<AiConfig>,
    private readonly costTracker: AiCostTrackerService,
  ) {}

  private startOfDay(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private startOfMonth(): Date {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async getConfig(): Promise<AiConfig> {
    let config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (!config) {
      config = this.configRepo.create({ id: AI_CONFIG_ID });
      await this.configRepo.save(config);
    }
    return config;
  }

  async checkBeforeCall(
    context: AiCallContext,
    estimatedCostUsd = 0.001,
  ): Promise<BudgetCheckResult> {
    const config = await this.getConfig();

    if (config.aiBudgetPaused && !context.adminOverrideBudget) {
      return { allowed: false, reason: 'budget_paused' };
    }

    const dayStart = this.startOfDay();
    const monthStart = this.startOfMonth();

    const dailyTotal = await this.costTracker.sumCostSince(dayStart);
    const monthlyTotal = await this.costTracker.sumCostSince(monthStart);
    const autoReplyDaily = await this.costTracker.sumCostSince(
      dayStart,
      AiUsageFeature.WHATSAPP_AUTO_REPLY,
    );

    const dailyBudget = Number(config.aiDailyBudgetUsd ?? 1);
    const monthlyBudget = Number(config.aiMonthlyBudgetUsd ?? 20);
    const autoReplyBudget = Number(config.autoReplyDailyBudgetUsd ?? 0.5);

    const dailyUsagePercent = dailyBudget > 0 ? (dailyTotal / dailyBudget) * 100 : 0;
    const monthlyUsagePercent = monthlyBudget > 0 ? (monthlyTotal / monthlyBudget) * 100 : 0;
    const autoReplyDailyPercent =
      autoReplyBudget > 0 ? (autoReplyDaily / autoReplyBudget) * 100 : 0;

    const warnPct = config.notifyAdminWhenBudgetAtPercent ?? 80;
    const atWarningThreshold =
      dailyUsagePercent >= warnPct ||
      monthlyUsagePercent >= warnPct ||
      autoReplyDailyPercent >= warnPct;

    if (atWarningThreshold) {
      this.logger.warn(
        `AI budget warning: daily=${dailyUsagePercent.toFixed(1)}% monthly=${monthlyUsagePercent.toFixed(1)}% autoReply=${autoReplyDailyPercent.toFixed(1)}%`,
      );
    }

    const isAutoReply = context.feature === AiUsageFeature.WHATSAPP_AUTO_REPLY;

    if (context.adminOverrideBudget && config.allowAdminOverrideBudget) {
      return {
        allowed: true,
        dailyUsagePercent,
        monthlyUsagePercent,
        autoReplyDailyPercent,
        atWarningThreshold,
      };
    }

    if (dailyTotal + estimatedCostUsd > dailyBudget) {
      if (isAutoReply && config.stopAutoReplyWhenBudgetExceeded) {
        await this.pauseAutoReply('daily_budget_exceeded');
      }
      return {
        allowed: false,
        reason: 'daily_budget_exceeded',
        dailyUsagePercent,
        monthlyUsagePercent,
        autoReplyDailyPercent,
      };
    }

    if (monthlyTotal + estimatedCostUsd > monthlyBudget) {
      if (isAutoReply && config.stopAutoReplyWhenBudgetExceeded) {
        await this.pauseAutoReply('monthly_budget_exceeded');
      }
      return {
        allowed: false,
        reason: 'monthly_budget_exceeded',
        dailyUsagePercent,
        monthlyUsagePercent,
        autoReplyDailyPercent,
      };
    }

    if (
      isAutoReply &&
      autoReplyDaily + estimatedCostUsd > autoReplyBudget &&
      config.stopAutoReplyWhenBudgetExceeded
    ) {
      await this.pauseAutoReply('auto_reply_daily_budget_exceeded');
      return {
        allowed: false,
        reason: 'auto_reply_daily_budget_exceeded',
        dailyUsagePercent,
        monthlyUsagePercent,
        autoReplyDailyPercent,
      };
    }

    return {
      allowed: true,
      dailyUsagePercent,
      monthlyUsagePercent,
      autoReplyDailyPercent,
      atWarningThreshold,
    };
  }

  async pauseAutoReply(reason?: string): Promise<void> {
    const config = await this.getConfig();
    config.autoReplyPaused = true;
    if (reason) config.aiBudgetPaused = true;
    await this.configRepo.save(config);
    this.logger.warn(`Auto-reply paused: ${reason ?? 'manual'}`);
  }

  async resumeAutoReply(): Promise<void> {
    const config = await this.getConfig();
    config.autoReplyPaused = false;
    config.aiBudgetPaused = false;
    await this.configRepo.save(config);
  }

  async getBudgetStatus(): Promise<{
    dailyTotalUsd: number;
    monthlyTotalUsd: number;
    autoReplyDailyUsd: number;
    dailyBudgetUsd: number;
    monthlyBudgetUsd: number;
    autoReplyDailyBudgetUsd: number;
    dailyUsagePercent: number;
    monthlyUsagePercent: number;
    autoReplyDailyPercent: number;
    aiBudgetPaused: boolean;
    autoReplyPaused: boolean;
    atWarningThreshold: boolean;
  }> {
    const config = await this.getConfig();
    const dayStart = this.startOfDay();
    const monthStart = this.startOfMonth();

    const dailyTotalUsd = await this.costTracker.sumCostSince(dayStart);
    const monthlyTotalUsd = await this.costTracker.sumCostSince(monthStart);
    const autoReplyDailyUsd = await this.costTracker.sumCostSince(
      dayStart,
      AiUsageFeature.WHATSAPP_AUTO_REPLY,
    );

    const dailyBudgetUsd = Number(config.aiDailyBudgetUsd ?? 1);
    const monthlyBudgetUsd = Number(config.aiMonthlyBudgetUsd ?? 20);
    const autoReplyDailyBudgetUsd = Number(config.autoReplyDailyBudgetUsd ?? 0.5);

    const dailyUsagePercent = dailyBudgetUsd > 0 ? (dailyTotalUsd / dailyBudgetUsd) * 100 : 0;
    const monthlyUsagePercent =
      monthlyBudgetUsd > 0 ? (monthlyTotalUsd / monthlyBudgetUsd) * 100 : 0;
    const autoReplyDailyPercent =
      autoReplyDailyBudgetUsd > 0
        ? (autoReplyDailyUsd / autoReplyDailyBudgetUsd) * 100
        : 0;

    const warnPct = config.notifyAdminWhenBudgetAtPercent ?? 80;

    return {
      dailyTotalUsd,
      monthlyTotalUsd,
      autoReplyDailyUsd,
      dailyBudgetUsd,
      monthlyBudgetUsd,
      autoReplyDailyBudgetUsd,
      dailyUsagePercent,
      monthlyUsagePercent,
      autoReplyDailyPercent,
      aiBudgetPaused: config.aiBudgetPaused,
      autoReplyPaused: config.autoReplyPaused,
      atWarningThreshold:
        dailyUsagePercent >= warnPct ||
        monthlyUsagePercent >= warnPct ||
        autoReplyDailyPercent >= warnPct,
    };
  }

  async logBudgetBlocked(context: AiCallContext, reason: string): Promise<void> {
    await this.costTracker.recordUsage({
      context,
      provider: 'none',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      status: AiUsageStatus.BUDGET_BLOCKED,
      errorMessage: reason,
    });
  }
}
