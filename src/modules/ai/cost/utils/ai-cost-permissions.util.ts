import { ApiKey, ApiKeyRole } from '../../../auth/entities/api-key.entity';
import { AiCostPermission, AiLearningPermission } from '../ai-cost-permission.enums';

const ALL_PERMISSIONS: string[] = [
  ...Object.values(AiCostPermission),
  ...Object.values(AiLearningPermission),
];

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, string[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [AiCostPermission.VIEW, AiLearningPermission.VIEW],
  [ApiKeyRole.VIEWER]: [],
};

export function getEffectiveAiCostPermissions(apiKey: ApiKey): string[] {
  const custom = apiKey.permissions;
  if (custom && custom.length > 0) {
    return custom.filter((p): p is string => ALL_PERMISSIONS.includes(p as string));
  }
  return ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
}

export function hasAiCostPermission(apiKey: ApiKey, permission: string): boolean {
  return getEffectiveAiCostPermissions(apiKey).includes(permission);
}
