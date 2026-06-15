import { ApiKey, ApiKeyRole } from '../../auth/entities/api-key.entity';
import { StoragePermission } from '../storage.enums';

const ALL_PERMISSIONS = Object.values(StoragePermission);

const ROLE_DEFAULT_PERMISSIONS: Record<ApiKeyRole, StoragePermission[]> = {
  [ApiKeyRole.ADMIN]: ALL_PERMISSIONS,
  [ApiKeyRole.OPERATOR]: [
    StoragePermission.VIEW_USAGE,
    StoragePermission.DOWNLOAD_MEDIA,
  ],
  [ApiKeyRole.VIEWER]: [],
};

const MANAGER_PERMISSION_ALIASES = new Set(['storage:manage', 'storage:manager']);

const MANAGER_GRANTS: StoragePermission[] = [
  StoragePermission.MANAGE_SETTINGS,
  StoragePermission.RUN_CLEANUP,
  StoragePermission.CREATE_BACKUP,
  StoragePermission.RESTORE_BACKUP,
];

export function getEffectiveStoragePermissions(apiKey: ApiKey): StoragePermission[] {
  const custom = (apiKey as ApiKey & { permissions?: string[] | null }).permissions;
  const base = ROLE_DEFAULT_PERMISSIONS[apiKey.role] ?? [];
  if (custom && custom.length > 0) {
    const fromCustom = custom.filter((p): p is StoragePermission =>
      ALL_PERMISSIONS.includes(p as StoragePermission),
    );
    const hasManagerAlias = custom.some(p => MANAGER_PERMISSION_ALIASES.has(p));
    const merged = hasManagerAlias ? [...base, ...MANAGER_GRANTS, ...fromCustom] : [...base, ...fromCustom];
    if (merged.length > 0) {
      return [...new Set(merged)];
    }
  }
  return base;
}

export function hasStoragePermission(apiKey: ApiKey, permission: StoragePermission): boolean {
  return getEffectiveStoragePermissions(apiKey).includes(permission);
}
