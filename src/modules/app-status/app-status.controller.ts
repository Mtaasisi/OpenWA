import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireRole, CurrentUser, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User } from '../auth/entities/user.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import { AppStatusService } from './app-status.service';
import type { AppStatusResponse } from './app-status.types';

@ApiTags('app')
@ApiBearerAuth()
@Controller('app')
export class AppStatusController {
  constructor(private readonly appStatusService: AppStatusService) {}

  @Get('status')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Aggregated app health and status for dashboard status bar' })
  getStatus(
    @CurrentUser() user?: User,
    @CurrentApiKey() apiKey?: ApiKey,
  ): Promise<AppStatusResponse> {
    return this.appStatusService.getStatus(user, apiKey);
  }
}
