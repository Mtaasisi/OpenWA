import { useQuery } from '@tanstack/react-query';
import { aiUsageApi } from '../services/api';

const VIEW = 'ai.cost.view';
const MANAGE = 'ai.cost.manage';

export function useAiCostPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai', 'cost-permissions'],
    queryFn: () => aiUsageApi.getPermissions(),
    staleTime: 60_000,
  });

  const permissions = data?.permissions ?? [];
  const canView = permissions.includes(VIEW);
  const canManage = permissions.includes(MANAGE);

  return {
    isLoading,
    permissions,
    canView,
    canManage,
  };
}
