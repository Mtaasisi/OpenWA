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
import { StoragePermission } from '../storage.enums';
import { hasStoragePermission } from '../utils/permissions.util';

export const STORAGE_PERMISSION_KEY = 'storagePermission';

export const RequireStoragePermission = (permission: StoragePermission) =>
  SetMetadata(STORAGE_PERMISSION_KEY, permission);

@Injectable()
export class StoragePermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.get<StoragePermission>(
      STORAGE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) return true;

    const request = context.switchToHttp().getRequest<Request & { apiKey?: ApiKey }>();
    const apiKey = request.apiKey;
    if (!apiKey) throw new ForbiddenException('Authentication required');

    if (!hasStoragePermission(apiKey, permission)) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
