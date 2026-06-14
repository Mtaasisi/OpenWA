import { ApiKey, ApiKeyRole } from '../../../auth/entities/api-key.entity';
import { AiCostPermission } from '../ai-cost-permission.enums';

const ALL_PERMISSIONS = Object.values(AiCostPermission);

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, AiCostPermission[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [AiCostPermission.VIEW],
  [ApiKeyRole.VIEWER]: [],
};

export function getEffectiveAiCostPermissions(apiKey: ApiKey): AiCostPermission[] {
  const custom = apiKey.permissions;
  if (custom && custom.length > 0) {
    return custom.filter((p): p is AiCostPermission =>
      ALL_PERMISSIONS.includes(p as AiCostPermission),
    );
  }
  return ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
}

export function hasAiCostPermission(apiKey: ApiKey, permission: AiCostPermission): boolean {
  return getEffectiveAiCostPermissions(apiKey).includes(permission);
}
