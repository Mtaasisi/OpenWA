import { ApiKey, ApiKeyRole } from '../../auth/entities/api-key.entity';
import { FollowUpPermission } from '../followup.enums';

const ALL_PERMISSIONS = Object.values(FollowUpPermission);

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, FollowUpPermission[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [
    FollowUpPermission.VIEW_FOLLOWUP_QUEUE,
    FollowUpPermission.COMPLETE_FOLLOWUPS,
    FollowUpPermission.ASSIGN_FOLLOWUPS,
    FollowUpPermission.VIEW_CONVERSATION_PIPELINE,
    FollowUpPermission.UPDATE_CONVERSATION_STAGE,
    FollowUpPermission.ASSIGN_CONVERSATIONS,
    FollowUpPermission.CLOSE_CONVERSATION,
    FollowUpPermission.LINK_SALE_TO_CONVERSATION,
    FollowUpPermission.EDIT_LEAD_SOURCE,
    FollowUpPermission.VIEW_CONVERSION_REPORTS,
    FollowUpPermission.VIEW_LEAD_SOURCE_REPORTS,
    FollowUpPermission.APPROVE_AUTOPILOT_FOLLOWUPS,
  ],
  [ApiKeyRole.VIEWER]: [
    FollowUpPermission.VIEW_FOLLOWUP_QUEUE,
    FollowUpPermission.VIEW_CONVERSATION_PIPELINE,
    FollowUpPermission.VIEW_LOST_LEADS,
    FollowUpPermission.VIEW_LEAD_SOURCE_REPORTS,
  ],
};

export function getEffectivePermissions(apiKey: ApiKey): FollowUpPermission[] {
  const custom = (apiKey as ApiKey & { permissions?: string[] | null }).permissions;
  if (custom && custom.length > 0) {
    return custom.filter((p): p is FollowUpPermission =>
      ALL_PERMISSIONS.includes(p as FollowUpPermission),
    );
  }
  return ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
}

export function hasFollowUpPermission(apiKey: ApiKey, permission: FollowUpPermission): boolean {
  return getEffectivePermissions(apiKey).includes(permission);
}
