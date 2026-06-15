import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { AuthSessionService } from '../auth-session.service';
import { ApiKey, ApiKeyRole, API_KEY_RAW_PREFIX } from '../entities/api-key.entity';
import { User } from '../entities/user.entity';
import { PUBLIC_KEY, REQUIRED_ROLE_KEY } from '../decorators/auth.decorators';

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly authSession: AuthSessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<
      Request & { apiKey?: ApiKey; user?: User }
    >();

    const sessionId = (request.params['sessionId'] || request.params['id']) as string | undefined;
    const clientIp = this.getClientIp(request);

    const xApiKey = request.headers['x-api-key'] as string | undefined;
    const bearer = this.extractBearer(request);

    if (xApiKey) {
      await this.attachApiKey(request, xApiKey, clientIp, sessionId);
    } else if (bearer) {
      if (bearer.startsWith(API_KEY_RAW_PREFIX)) {
        await this.attachApiKey(request, bearer, clientIp, sessionId);
      } else if (this.looksLikeJwt(bearer)) {
        await this.attachJwt(request, bearer);
      } else {
        throw new UnauthorizedException('Invalid authentication credentials');
      }
    } else {
      throw new UnauthorizedException('Authentication required');
    }

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRole && request.apiKey && !this.authService.hasPermission(request.apiKey, requiredRole)) {
      throw new UnauthorizedException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    return true;
  }

  private async attachApiKey(
    request: Request & { apiKey?: ApiKey; user?: User },
    rawKey: string,
    clientIp: string,
    sessionId?: string,
  ): Promise<void> {
    const apiKey = await this.authService.validateApiKey(rawKey, clientIp, sessionId);
    request.apiKey = apiKey;
  }

  private async attachJwt(
    request: Request & { apiKey?: ApiKey; user?: User },
    token: string,
  ): Promise<void> {
    const identity = await this.authSession.resolveIdentityFromAccessToken(token);
    request.user = identity.user;
    request.apiKey = identity.apiKey;
  }

  private extractBearer(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }
    return undefined;
  }

  private looksLikeJwt(token: string): boolean {
    return token.split('.').length === 3;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = (forwarded as string).split(',');
      return ips[0].trim();
    }
    return request.ip || request.socket.remoteAddress || '';
  }
}
