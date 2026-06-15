import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, getOptionsToken, getStorageToken } from '@nestjs/throttler';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';

/**
 * Global rate limit guard. Skips when RATE_LIMIT_DISABLED=true or NODE_ENV=development
 * so local dashboard/inbox polling does not hit ThrottlerException.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.configService.get<boolean>('api.rateLimit.disabled', false)) {
      return true;
    }
    // Dashboard and API clients always send credentials; throttle only anonymous traffic.
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    if (req.headers['authorization'] || req.headers['x-api-key']) {
      return true;
    }
    return super.shouldSkip(context);
  }
}
