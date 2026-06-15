import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyRole } from '../entities/api-key.entity';
import { Request } from 'express';
import { ApiKey } from '../entities/api-key.entity';
import { User } from '../entities/user.entity';

export const REQUIRED_ROLE_KEY = 'requiredRole';
export const PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as requiring a specific role
 * @example @RequireRole(ApiKeyRole.ADMIN)
 */
export const RequireRole = (role: ApiKeyRole) => SetMetadata(REQUIRED_ROLE_KEY, role);

/**
 * Mark a route as public (no API key required)
 * @example @Public()
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Get the current API key from request
 * @example @CurrentApiKey() apiKey: ApiKey
 */
export const CurrentApiKey = createParamDecorator((data: unknown, ctx: ExecutionContext): ApiKey | undefined => {
  const request = ctx.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
  return request.apiKey;
});

/**
 * Get the current logged-in user (JWT auth only)
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User | undefined => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: User }>();
  return request.user;
});
