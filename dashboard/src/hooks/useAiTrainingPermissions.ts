import { useAiCostPermissions } from './useAiCostPermissions';

export function useAiTrainingPermissions() {
  const { isLoading, canView, canManage, permissions } = useAiCostPermissions();
  const canViewTraining =
    canView || permissions.includes('ai.learning.view') || permissions.includes('ai.analytics.view');
  const canManageTraining =
    canManage ||
    permissions.includes('ai.learning.manage') ||
    permissions.includes('ai.settings.manage');
  return {
    loading: isLoading,
    canViewTraining,
    canManageTraining,
    permissions,
  };
}
