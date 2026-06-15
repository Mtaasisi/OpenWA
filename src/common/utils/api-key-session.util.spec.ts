import { ForbiddenException } from '@nestjs/common';
import { assertApiKeySessionAccess } from './api-key-session.util';
import { ApiKey, ApiKeyRole } from '../../modules/auth/entities/api-key.entity';

function mockKey(allowedSessions: string[] | null): ApiKey {
  return {
    id: 'k1',
    name: 'Test',
    keyHash: 'x',
    keyPrefix: 'x',
    role: ApiKeyRole.OPERATOR,
    allowedSessions,
    allowedIps: null,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('assertApiKeySessionAccess', () => {
  it('allows when no session restriction', () => {
    expect(() => assertApiKeySessionAccess(mockKey(null), 'sess-a')).not.toThrow();
  });

  it('allows listed session', () => {
    expect(() => assertApiKeySessionAccess(mockKey(['sess-a']), 'sess-a')).not.toThrow();
  });

  it('rejects wrong session', () => {
    expect(() => assertApiKeySessionAccess(mockKey(['sess-a']), 'sess-b')).toThrow(ForbiddenException);
  });
});
