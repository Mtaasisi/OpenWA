import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiBudgetGuardService } from './cost/ai-budget-guard.service';
import { AiConfig, AI_CONFIG_ID } from './entities/ai-config.entity';
import { AiBudgetSettingsDto } from './dto/ai.dto';
import { AiCostPermissionGuard, RequireAiCostPermission } from './cost/guards/ai-cost-permission.guard';
import { AiCostPermission } from './cost/ai-cost-permission.enums';

@Controller('admin/ai-budget')
@UseGuards(AiCostPermissionGuard)
export class AiBudgetAdminController {
  constructor(
    private readonly budgetGuard: AiBudgetGuardService,
    @InjectRepository(AiConfig, 'data')
    private readonly configRepo: Repository<AiConfig>,
  ) {}

  @Get('status')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async status() {
    return this.budgetGuard.getBudgetStatus();
  }

  @Post('settings')
  @RequireAiCostPermission(AiCostPermission.MANAGE)
  async updateSettings(@Body() dto: AiBudgetSettingsDto) {
    const config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (!config) throw new Error('AI config not found');
    if (dto.aiDailyBudgetUsd !== undefined) config.aiDailyBudgetUsd = dto.aiDailyBudgetUsd;
    if (dto.aiMonthlyBudgetUsd !== undefined) config.aiMonthlyBudgetUsd = dto.aiMonthlyBudgetUsd;
    if (dto.autoReplyDailyBudgetUsd !== undefined) {
      config.autoReplyDailyBudgetUsd = dto.autoReplyDailyBudgetUsd;
    }
    if (dto.stopAutoReplyWhenBudgetExceeded !== undefined) {
      config.stopAutoReplyWhenBudgetExceeded = dto.stopAutoReplyWhenBudgetExceeded;
    }
    if (dto.notifyAdminWhenBudgetAtPercent !== undefined) {
      config.notifyAdminWhenBudgetAtPercent = dto.notifyAdminWhenBudgetAtPercent;
    }
    if (dto.allowAdminOverrideBudget !== undefined) {
      config.allowAdminOverrideBudget = dto.allowAdminOverrideBudget;
    }
    await this.configRepo.save(config);
    return { ok: true, budget: await this.budgetGuard.getBudgetStatus() };
  }
}

@Controller('admin/ai-control')
@UseGuards(AiCostPermissionGuard)
export class AiControlAdminController {
  constructor(
    private readonly budgetGuard: AiBudgetGuardService,
    @InjectRepository(AiConfig, 'data')
    private readonly configRepo: Repository<AiConfig>,
  ) {}

  @Post('pause-auto-reply')
  @RequireAiCostPermission(AiCostPermission.MANAGE)
  async pauseAutoReply() {
    await this.budgetGuard.pauseAutoReply('manual_pause');
    const config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (config) {
      config.autoReplyPaused = true;
      await this.configRepo.save(config);
    }
    return { ok: true, autoReplyPaused: true };
  }

  @Post('resume-auto-reply')
  @RequireAiCostPermission(AiCostPermission.MANAGE)
  async resumeAutoReply() {
    await this.budgetGuard.resumeAutoReply();
    const config = await this.configRepo.findOne({ where: { id: AI_CONFIG_ID } });
    if (config) {
      config.autoReplyPaused = false;
      await this.configRepo.save(config);
    }
    return { ok: true, autoReplyPaused: false };
  }
}
