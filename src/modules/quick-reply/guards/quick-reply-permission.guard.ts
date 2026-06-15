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
import { QuickReplyPermission } from '../quick-reply.enums';
import { hasQuickReplyPermission } from '../utils/permissions.util';

export const QUICK_REPLY_PERMISSION_KEY = 'quickReplyPermission';

export const RequireQuickReplyPermission = (permission: QuickReplyPermission) =>
  SetMetadata(QUICK_REPLY_PERMISSION_KEY, permission);

@Injectable()
export class QuickReplyPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<QuickReplyPermission>(
      QUICK_REPLY_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    const apiKey = request.apiKey;
    if (!apiKey) throw new ForbiddenException('Authentication required');

    if (!hasQuickReplyPermission(apiKey, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
