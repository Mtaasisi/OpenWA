import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKey } from '../../../auth/entities/api-key.entity';
import { AiCostPermission } from '../ai-cost-permission.enums';
import { hasAiCostPermission } from '../utils/ai-cost-permissions.util';

export const AI_COST_PERMISSION_KEY = 'aiCostPermission';

export const RequireAiCostPermission = (permission: AiCostPermission) =>
  SetMetadata(AI_COST_PERMISSION_KEY, permission);

@Injectable()
export class AiCostPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<AiCostPermission>(
      AI_COST_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    const apiKey = request.apiKey;
    if (!apiKey) throw new ForbiddenException('Authentication required');

    if (!hasAiCostPermission(apiKey, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
