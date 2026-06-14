import { ApiKey, ApiKeyRole } from '../../auth/entities/api-key.entity';
import { AiCostPermission } from './ai-cost-permission.enums';
import {
  getEffectiveAiCostPermissions,
  hasAiCostPermission,
} from './utils/ai-cost-permissions.util';

function key(role: ApiKeyRole, permissions?: string[] | null): ApiKey {
  return { role, permissions } as ApiKey;
}

describe('ai-cost-permissions.util', () => {
  it('grants all permissions to admin by default', () => {
    const perms = getEffectiveAiCostPermissions(key(ApiKeyRole.ADMIN));
    expect(perms).toContain(AiCostPermission.VIEW);
    expect(perms).toContain(AiCostPermission.MANAGE);
  });

  it('grants view-only to operator by default', () => {
    const perms = getEffectiveAiCostPermissions(key(ApiKeyRole.OPERATOR));
    expect(perms).toEqual([AiCostPermission.VIEW]);
  });

  it('uses custom permissions when set', () => {
    const perms = getEffectiveAiCostPermissions(
      key(ApiKeyRole.VIEWER, [AiCostPermission.MANAGE, 'view_followup_queue']),
    );
    expect(perms).toEqual([AiCostPermission.MANAGE]);
  });

  it('hasAiCostPermission checks effective set', () => {
    expect(hasAiCostPermission(key(ApiKeyRole.ADMIN), AiCostPermission.MANAGE)).toBe(true);
    expect(hasAiCostPermission(key(ApiKeyRole.VIEWER), AiCostPermission.VIEW)).toBe(false);
  });
});
