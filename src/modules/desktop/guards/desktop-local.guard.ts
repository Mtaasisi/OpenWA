import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { isDesktopMode } from '../../../common/utils/production-security.util';

function isLocalhostIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const normalized = ip.replace('::ffff:', '');
  return normalized === '127.0.0.1' || normalized === '::1' || ip === '127.0.0.1';
}

@Injectable()
export class DesktopLocalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!isDesktopMode()) {
      throw new ForbiddenException('Desktop API is only available in desktop mode');
    }

    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip || req.socket?.remoteAddress;
    if (!isLocalhostIp(ip)) {
      throw new ForbiddenException('Desktop API is restricted to localhost');
    }

    const setupToken = this.configService.get<string>('desktop.setupToken');
    const headerToken = req.headers['x-desktop-setup-token'];
    const hasAuth = !!req.headers.authorization;
    if (setupToken && !hasAuth && headerToken !== setupToken) {
      throw new ForbiddenException('Invalid desktop setup token');
    }

    return true;
  }
}
