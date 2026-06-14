import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiSignalService } from './ai-signal.service';

@ApiTags('ai')
@Controller('ai/signals')
export class AiSignalsController {
  constructor(private readonly signalService: AiSignalService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'AI signal counts for dashboard alerts' })
  getDashboardSignals(@Query('sinceHours') sinceHours?: string) {
    const hours = sinceHours ? parseInt(sinceHours, 10) : 48;
    return this.signalService.getDashboardSignals(Number.isFinite(hours) ? hours : 48);
  }

  @Post('backfill-assignees')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Backfill assignedStaffId on open AI escalations from pipeline threads' })
  backfillEscalationAssignees() {
    return this.signalService.backfillOpenEscalationAssignees();
  }

  @Get('group-leads')
  @ApiOperation({ summary: 'Detected buying-intent messages in a WhatsApp group' })
  listGroupLeads(@Query('sessionId') sessionId: string, @Query('chatId') chatId: string) {
    if (!sessionId?.trim() || !chatId?.trim()) {
      return { leads: [], escalation: null };
    }
    return this.signalService.listGroupLeads(sessionId.trim(), chatId.trim());
  }
}
