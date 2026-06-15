import { ApiKey, ApiKeyRole } from '../../auth/entities/api-key.entity';
import { QuickReplyPermission } from '../quick-reply.enums';

const ALL_PERMISSIONS = Object.values(QuickReplyPermission);

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, QuickReplyPermission[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [
    QuickReplyPermission.VIEW_QUICK_REPLIES,
    QuickReplyPermission.SEND_QUICK_REPLIES,
  ],
  [ApiKeyRole.VIEWER]: [QuickReplyPermission.VIEW_QUICK_REPLIES],
};

export function getEffectiveQuickReplyPermissions(apiKey: ApiKey): QuickReplyPermission[] {
  const custom = apiKey.permissions;
  if (custom && custom.length > 0) {
    return custom.filter((p): p is QuickReplyPermission =>
      ALL_PERMISSIONS.includes(p as QuickReplyPermission),
    );
  }
  return ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
}

export function hasQuickReplyPermission(
  apiKey: ApiKey,
  permission: QuickReplyPermission,
): boolean {
  return getEffectiveQuickReplyPermissions(apiKey).includes(permission);
}
