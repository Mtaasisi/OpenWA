import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiUsageQueryService } from './cost/ai-usage-query.service';
import { AiBudgetGuardService } from './cost/ai-budget-guard.service';
import { AiCostPermissionGuard, RequireAiCostPermission } from './cost/guards/ai-cost-permission.guard';
import { AiCostPermission } from './cost/ai-cost-permission.enums';

@Controller('admin/ai-usage')
@UseGuards(AiCostPermissionGuard)
export class AiUsageAdminController {
  constructor(
    private readonly usageQuery: AiUsageQueryService,
    private readonly budgetGuard: AiBudgetGuardService,
  ) {}

  @Get('summary')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async summary() {
    const usage = await this.usageQuery.getSummary();
    const budget = await this.budgetGuard.getBudgetStatus();
    return { usage, budget };
  }

  @Get('daily')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async daily(@Query('days') days?: string) {
    return this.usageQuery.getDailyCosts(Number(days) || 30);
  }

  @Get('by-model')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async byModel(@Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : this.daysAgo(30);
    return this.usageQuery.getByModel(sinceDate);
  }

  @Get('by-feature')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async byFeature(@Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : this.daysAgo(30);
    return this.usageQuery.getByFeature(sinceDate);
  }

  @Get('recent')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async recent(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('feature') feature?: string,
    @Query('provider') provider?: string,
    @Query('model') model?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('since') since?: string,
    @Query('until') until?: string,
  ) {
    return this.usageQuery.getRecent({
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      feature,
      provider,
      model,
      status,
      branchId,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
    });
  }

  @Get('export.csv')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async exportCsv(@Res() res: Response, @Query('since') since?: string) {
    const sinceDate = since ? new Date(since) : this.daysAgo(30);
    const csv = await this.usageQuery.exportCsv(sinceDate);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ai-usage-export.csv"');
    res.send(csv);
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
