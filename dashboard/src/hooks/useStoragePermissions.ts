import { useQuery } from '@tanstack/react-query';
import { storageApi } from '../services/api';

export function useStoragePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['storage', 'permissions'],
    queryFn: () => storageApi.getPermissions(),
    staleTime: 60_000,
  });

  const perms = data?.permissions ?? [];
  const has = (p: string) => perms.includes(p);

  return {
    isLoading,
    permissions: perms,
    canViewUsage: has('storage:view_usage'),
    canDownloadMedia: has('storage:download_media'),
    canManageSettings: has('storage:manage_settings'),
    canRunCleanup: has('storage:run_cleanup'),
    canCreateBackup: has('storage:create_backup'),
    canRestoreBackup: has('storage:restore_backup'),
  };
}
