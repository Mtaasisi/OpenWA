import { ForbiddenException } from '@nestjs/common';
import { ApiKey } from '../../modules/auth/entities/api-key.entity';

/** Enforce API key session allow-list when sending on a specific WhatsApp session. */
export function assertApiKeySessionAccess(apiKey: ApiKey | undefined, sessionId: string): void {
  if (!apiKey?.allowedSessions?.length) return;
  if (!sessionId?.trim()) {
    throw new ForbiddenException('sessionId is required');
  }
  if (!apiKey.allowedSessions.includes(sessionId)) {
    throw new ForbiddenException('API key not authorized for this WhatsApp session');
  }
}
