import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKey } from '../../auth/entities/api-key.entity';
import { FollowUpPermission } from '../followup.enums';
import { hasFollowUpPermission } from '../utils/permissions.util';

export const FOLLOWUP_PERMISSION_KEY = 'followupPermission';

export const RequireFollowUpPermission = (permission: FollowUpPermission) =>
  SetMetadata(FOLLOWUP_PERMISSION_KEY, permission);

@Injectable()
export class FollowUpPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<FollowUpPermission>(
      FOLLOWUP_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    const apiKey = request.apiKey;
    if (!apiKey) throw new ForbiddenException('Authentication required');

    if (!hasFollowUpPermission(apiKey, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
