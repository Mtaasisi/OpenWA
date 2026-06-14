import { Controller, Get } from '@nestjs/common';
import { CurrentApiKey } from '../../auth/decorators/auth.decorators';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { getEffectiveAiCostPermissions } from './utils/ai-cost-permissions.util';

@Controller('ai/cost')
export class AiCostPermissionsController {
  @Get('permissions')
  getPermissions(@CurrentApiKey() apiKey: ApiKey) {
    return { permissions: getEffectiveAiCostPermissions(apiKey) };
  }
}
