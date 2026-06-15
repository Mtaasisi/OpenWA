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
import { QuotePermission } from '../quote.enums';
import { hasQuotePermission } from '../utils/permissions.util';

export const QUOTE_PERMISSION_KEY = 'quotePermission';

export const RequireQuotePermission = (permission: QuotePermission) =>
  SetMetadata(QUOTE_PERMISSION_KEY, permission);

@Injectable()
export class QuotePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<QuotePermission>(QUOTE_PERMISSION_KEY, context.getHandler());
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    const apiKey = request.apiKey;
    if (!apiKey) throw new ForbiddenException('Authentication required');

    if (!hasQuotePermission(apiKey, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
