import { useQuery } from '@tanstack/react-query';
import { quickReplyApi } from '../services/api';

export function useQuickReplyPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['quick-reply', 'permissions'],
    queryFn: () => quickReplyApi.getPermissions(),
    staleTime: 60_000,
  });

  const permissions = data?.permissions ?? [];

  return {
    isLoading,
    canView: permissions.includes('view_quick_replies'),
    canSend: permissions.includes('send_quick_replies'),
    canManage: permissions.includes('manage_quick_replies'),
  };
}
