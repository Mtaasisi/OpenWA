import { useQuery } from '@tanstack/react-query';
import { followupApi } from '../services/api';

export function useFollowupPermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['followup', 'permissions'],
    queryFn: () => followupApi.getPermissions(),
    staleTime: 60_000,
  });

  const perms = data?.permissions ?? [];
  const has = (p: string) => perms.includes(p);

  return {
    isLoading,
    permissions: perms,
    canViewLeadSourceReports: has('view_lead_source_reports'),
    canEditLeadSource: has('edit_lead_source'),
    canViewPipeline: has('view_conversation_pipeline'),
    canViewConversionReports: has('view_conversion_reports'),
    canManageMessageTemplates: has('manage_message_templates'),
  };
}
