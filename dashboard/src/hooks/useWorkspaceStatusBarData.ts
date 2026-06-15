import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRole } from './useRole';
import { getDashboardScope } from '../lib/dashboard-scope';
import {
  useSessionsQuery,
  useFollowupQueueCountsQuery,
  useAiStatusQuery,
  useAutoReplyHealthQuery,
  useInauzwaSyncStatusQuery,
} from './queries';
import { buildAiSafetyMetrics } from '../lib/dashboard-metrics';
import { whatsAppSafetyApi } from '../services/api';

export function useWorkspaceStatusBarData() {
  const { role, roleValidated } = useRole();
  const scope = getDashboardScope(role, roleValidated);
  const { data: branchData } = useInauzwaSyncStatusQuery();
  const branchId = branchData?.preferences?.branchId ?? branchData?.branchId ?? undefined;

  const { data: sessions = [] } = useSessionsQuery({ refetchInterval: 60_000 });
  const { data: followupCounts } = useFollowupQueueCountsQuery(branchId);
  const { data: aiStatus } = useAiStatusQuery();
  const { data: autoReplyHealth } = useAutoReplyHealthQuery(scope === 'admin');

  const waSafetyAlerts = useQuery({
    queryKey: ['whatsapp-safety', 'dashboard-alerts'],
    queryFn: () => whatsAppSafetyApi.getDashboardAlerts(),
    enabled: scope === 'admin',
    staleTime: 60_000,
    retry: false,
  });

  const connected = sessions.some(session => session.status === 'ready');
  const pendingCount = (followupCounts?.due_now ?? 0) + (followupCounts?.overdue ?? 0);
  const dueTodayCount = followupCounts?.due_today ?? 0;
  const queueCount = waSafetyAlerts.data?.pendingQueue ?? 0;

  const aiSafety = useMemo(
    () =>
      buildAiSafetyMetrics(
        aiStatus,
        0,
        0,
        0,
        0,
        0,
        waSafetyAlerts.data?.blockedToday ?? 0,
        queueCount,
        autoReplyHealth
          ? { masterEnabled: autoReplyHealth.masterEnabled, ready: autoReplyHealth.ready }
          : undefined,
      ),
    [aiStatus, autoReplyHealth, queueCount, waSafetyAlerts.data?.blockedToday],
  );

  return {
    pendingCount,
    dueTodayCount,
    connected,
    aiSafety,
    queueCount,
  };
}
