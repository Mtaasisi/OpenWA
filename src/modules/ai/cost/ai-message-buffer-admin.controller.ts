import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AiMessageBufferService } from './ai-message-buffer.service';
import { AiCostPermissionGuard, RequireAiCostPermission } from './guards/ai-cost-permission.guard';
import { AiCostPermission } from './ai-cost-permission.enums';

@Controller('admin/ai-message-buffers')
@UseGuards(AiCostPermissionGuard)
export class AiMessageBufferAdminController {
  constructor(private readonly bufferService: AiMessageBufferService) {}

  @Get('recent')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async recent(@Query('limit') limit?: string) {
    const items = await this.bufferService.listRecent(limit ? Number(limit) : 20);
    return { items };
  }

  @Get('stats')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async stats() {
    return this.bufferService.getStats();
  }

  @Get(':batchId')
  @RequireAiCostPermission(AiCostPermission.VIEW)
  async byBatchId(@Param('batchId') batchId: string) {
    const item = await this.bufferService.findByBatchId(batchId);
    return { item };
  }
}
