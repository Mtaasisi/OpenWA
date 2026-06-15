import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  sessionApi,
  statsApi,
  inboxApi,
  messageApi,
  webhookApi,
  apiKeyApi,
  auditApi,
  infraApi,
  pluginsApi,
  settingsApi,
  followupApi,
  quoteApi,
  productsApi,
  aiApi,
  aiLearningDashboardApi,
  type Webhook,
  type InboxMessage,
  type Settings,
  type FollowUpQueueFilter,
  type PipelineBucket,
} from '../services/api';
import {
  getCachedAvatarBlob,
  getCachedAvatarStatus,
  putCachedAvatarBlob,
} from '../lib/inbox-avatar-cache';
import { fetchContactAvatarBlob, loadMessageMediaBlob } from '../pages/inbox-media';

const INBOX_SKIP_MESSAGE_TYPES = new Set([
  'notification_template',
  'e2e_notification',
  'gp2',
  'protocol',
]);

/** Poll interval when session is connected (ms). */
export const INBOX_POLL_INTERVAL_MS = 5_000;

/** Poll interval when no session is ready (stored history refresh). */
export const INBOX_SLOW_POLL_INTERVAL_MS = 30_000;

export const INBOX_MESSAGE_PAGE_SIZE = 100;

/** Cache WhatsApp profile photos in the browser to avoid repeat proxy requests. */
export const INBOX_AVATAR_STALE_MS = 30 * 60 * 1000;
/** Keep avatar blobs in memory across long inbox sessions. */
export const INBOX_AVATAR_GC_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-check profile photos from WhatsApp while session is active. */
export const INBOX_AVATAR_REFETCH_INTERVAL_MS = 60_000;
export const INBOX_LIST_MEDIA_STALE_MS = 15 * 60 * 1000;

// ── Query Keys ────────────────────────────────────────────────────────

export const queryKeys = {
  sessions: ['sessions'] as const,
  sessionStats: ['sessions', 'stats'] as const,
  sessionHealth: ['sessions', 'health'] as const,
  overviewStats: ['stats', 'overview'] as const,
  sessionGroups: (sessionId: string) => ['sessions', sessionId, 'groups'] as const,
  webhooks: ['webhooks'] as const,
  apiKeys: ['apiKeys'] as const,
  settings: ['settings'] as const,
  logs: (params: { severity?: string; action?: string; q?: string; page: number; limit: number }) =>
    ['logs', params] as const,
  infraStatus: ['infra', 'status'] as const,
  plugins: ['plugins'] as const,
  engines: ['engines'] as const,
  currentEngine: ['engines', 'current'] as const,
  inboxConversations: (sessionId: string) => ['inbox', 'conversations', sessionId] as const,
  inboxConversationsAll: (params?: Record<string, unknown>) =>
    ['inbox', 'conversations', 'all', params ?? {}] as const,
  inboxQueueCounts: (params?: Record<string, unknown>) =>
    ['inbox', 'queue-counts', params ?? {}] as const,
  inboxMessages: (sessionId: string, chatId: string) => ['inbox', 'messages', sessionId, chatId] as const,
  inboxAvatar: (sessionId: string, chatId: string) => ['inbox', 'avatar', sessionId, chatId] as const,
  inboxListMedia: (sessionId: string, messageId: string) =>
    ['inbox', 'list-media', sessionId, messageId] as const,
  inboxPins: ['inbox', 'pins'] as const,
  inboxSavedViews: ['inbox', 'saved-views'] as const,
  followupQueueCounts: (branchId?: string, staffId?: string) =>
    ['followups', 'queue', 'counts', branchId ?? '', staffId ?? ''] as const,
  pipelineDashboard: (branchId?: string) => ['pipeline', 'dashboard', branchId ?? ''] as const,
  pipelineCounts: (branchId?: string, staffId?: string) =>
    ['pipeline', 'counts', branchId ?? '', staffId ?? ''] as const,
  pipelineBucket: (bucket: PipelineBucket, branchId?: string, staffId?: string) =>
    ['pipeline', bucket, branchId ?? '', staffId ?? ''] as const,
  followupQueue: (filter: FollowUpQueueFilter, branchId?: string, staffId?: string) =>
    ['followups', 'queue', filter, branchId ?? '', staffId ?? ''] as const,
  quotesList: (branchId?: string) => ['quotes', 'list', branchId ?? ''] as const,
  auditRecent: ['audit', 'recent'] as const,
  catalogStats: ['products', 'catalog-stats'] as const,
  inauzwaStatus: ['products', 'inauzwa-status'] as const,
  followupReports: ['followups', 'reports'] as const,
  followupStaff: ['followups', 'staff'] as const,
  conversionReport: (branchId?: string) => ['pipeline', 'reports', 'conversion', branchId ?? ''] as const,
  aiStatus: ['ai', 'status'] as const,
  aiAutoReplyHealth: ['ai', 'auto-reply', 'health'] as const,
  aiSignals: ['ai', 'signals'] as const,
  aiLearningAlerts: ['ai', 'learning', 'alerts'] as const,
};

// ── Session Queries ───────────────────────────────────────────────────

export function useSessionsQuery(options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.sessions,
    queryFn: sessionApi.list,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval,
    placeholderData: previous => previous,
  });
}

export function useSessionStatsQuery() {
  return useQuery({
    queryKey: queryKeys.sessionStats,
    queryFn: sessionApi.getStats,
    staleTime: 30_000,
  });
}

export function useSessionHealthOverviewQuery(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: queryKeys.sessionHealth,
    queryFn: sessionApi.getHealthOverview,
    staleTime: 15_000,
    refetchInterval: options?.refetchInterval ?? 60_000,
    enabled: options?.enabled ?? true,
  });
}

export function useOverviewStatsQuery() {
  return useQuery({
    queryKey: queryKeys.overviewStats,
    queryFn: statsApi.getOverview,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useSessionGroupsQuery(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sessionGroups(sessionId),
    queryFn: () => sessionApi.getGroups(sessionId),
    enabled: enabled && !!sessionId,
    staleTime: 60_000,
  });
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sessionApi.create(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    },
  });
}

export function useDeleteSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
    },
  });
}

export function useStartSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.start(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useStopSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionApi.stop(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

// ── Inbox Queries (silent background refresh) ─────────────────────────

export function useInboxConversationsQuery(
  sessionId: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: queryKeys.inboxConversations(sessionId),
    queryFn: () => sessionApi.getConversations(sessionId),
    enabled: !!sessionId && (options?.enabled ?? true),
    staleTime: 2_000,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    placeholderData: previous => previous,
  });
}

export function useUnifiedInboxConversationsQuery(
  params?: import('../services/api').InboxConversationsQuery,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
    refetchOnWindowFocus?: boolean;
  },
) {
  return useQuery({
    queryKey: queryKeys.inboxConversationsAll(params as Record<string, unknown>),
    queryFn: () => inboxApi.getConversations(params),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 0,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    refetchOnReconnect: true,
    placeholderData: previous => previous,
  });
}

export function useInboxQueueCountsQuery(
  params?: Pick<import('../services/api').InboxConversationsQuery, 'sessionId'>,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
  },
) {
  return useQuery({
    queryKey: queryKeys.inboxQueueCounts(params as Record<string, unknown>),
    queryFn: () => inboxApi.getQueueCounts(params),
    enabled: options?.enabled ?? true,
    staleTime: 60_000,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: true,
  });
}

export function useInboxThreadSearchQuery(
  params: { q: string; sessionId?: string; limit?: number },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['inbox', 'threads', 'search', params] as const,
    queryFn: () => inboxApi.searchThreads(params),
    enabled: (options?.enabled ?? true) && params.q.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useInboxMessageSearchQuery(
  params: {
    q: string;
    groupsOnly?: boolean;
    mediaOnly?: boolean;
    limit?: number;
  },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['inbox', 'messages', 'search', params] as const,
    queryFn: () => inboxApi.searchMessages(params),
    enabled: (options?.enabled ?? true) && params.q.trim().length >= 2,
    staleTime: 30_000,
  });
}

export function useInboxMessagesQuery(
  sessionId: string,
  chatId: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number | false;
    refetchOnWindowFocus?: boolean;
    limit?: number;
    olderOffset?: number;
  },
) {
  const limit = options?.limit ?? INBOX_MESSAGE_PAGE_SIZE;
  const olderOffset = options?.olderOffset ?? 0;
  return useQuery({
    queryKey: [...queryKeys.inboxMessages(sessionId, chatId ?? ''), limit, olderOffset],
    queryFn: async (): Promise<{ messages: InboxMessage[]; total: number }> => {
      const result = await messageApi.list(sessionId, {
        chatId: chatId!,
        limit,
        offset: olderOffset,
      });
      return {
        messages: result.messages.filter(m => !INBOX_SKIP_MESSAGE_TYPES.has(m.type)),
        total: result.total,
      };
    },
    enabled: !!sessionId && !!chatId && (options?.enabled ?? true),
    staleTime: 0,
    refetchInterval: options?.refetchInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? true,
    refetchOnReconnect: true,
    placeholderData: (previous, previousQuery) => {
      if (!previous || !previousQuery) return undefined;
      const prevKey = previousQuery.queryKey;
      const prevSessionId = prevKey[2];
      const prevChatId = prevKey[3];
      if (prevSessionId === sessionId && prevChatId === (chatId ?? '')) {
        return previous;
      }
      return undefined;
    },
  });
}

export function prefetchInboxMessages(
  queryClient: QueryClient,
  sessionId: string,
  chatId: string,
): Promise<void> {
  const limit = INBOX_MESSAGE_PAGE_SIZE;
  const olderOffset = 0;
  return queryClient
    .prefetchQuery({
      queryKey: [...queryKeys.inboxMessages(sessionId, chatId), limit, olderOffset],
      queryFn: async (): Promise<{ messages: InboxMessage[]; total: number }> => {
        const result = await messageApi.list(sessionId, {
          chatId,
          limit,
          offset: olderOffset,
        });
        return {
          messages: result.messages.filter(m => !INBOX_SKIP_MESSAGE_TYPES.has(m.type)),
          total: result.total,
        };
      },
      staleTime: 30_000,
    })
    .then(() => undefined);
}

export function prefetchInboxCrm(
  queryClient: QueryClient,
  sessionId: string,
  chatId: string,
): Promise<void> {
  return queryClient
    .prefetchQuery({
      queryKey: ['inbox', 'crm', sessionId, chatId],
      queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
      staleTime: 30_000,
    })
    .then(() => undefined);
}

export type InboxContactAvatarQueryOptions = {
  /** Fetch from API proxy (requires session running). IndexedDB is always read first. */
  fetchRemote?: boolean;
  /** Poll WhatsApp for updated profile photos (requires live session). */
  pollRemote?: boolean;
  /** Conversation still has a CDN profile URL — retry even if locally marked absent. */
  hasProfilePicHint?: boolean;
  /** Keep re-checking WhatsApp for updated profile photos. */
  alwaysRefresh?: boolean;
};

export function useInboxContactAvatarBlob(
  sessionId: string,
  chatId: string,
  options: InboxContactAvatarQueryOptions = {},
) {
  const fetchRemote = options.fetchRemote ?? true;
  const pollRemote = options.pollRemote ?? fetchRemote;
  const hasProfilePicHint = options.hasProfilePicHint ?? false;
  const alwaysRefresh = options.alwaysRefresh ?? true;

  return useQuery({
    queryKey: [...queryKeys.inboxAvatar(sessionId, chatId), fetchRemote ? 'remote' : 'local'] as const,
    queryFn: async () => {
      const status = await getCachedAvatarStatus(sessionId, chatId);
      if (status === 'hit') {
        const local = await getCachedAvatarBlob(sessionId, chatId);
        if (local) {
          if (fetchRemote) {
            const remote = await fetchContactAvatarBlob(sessionId, chatId, {
              hasProfilePicHint: hasProfilePicHint || alwaysRefresh,
            });
            if (remote) {
              void putCachedAvatarBlob(sessionId, chatId, remote);
              return remote;
            }
          }
          return local;
        }
      }

      const skipAbsent = hasProfilePicHint || alwaysRefresh;
      if (status === 'absent' && !skipAbsent) return null;
      if (!fetchRemote) return null;

      const remote = await fetchContactAvatarBlob(sessionId, chatId, {
        hasProfilePicHint: hasProfilePicHint || alwaysRefresh,
      });
      if (remote) {
        void putCachedAvatarBlob(sessionId, chatId, remote);
      }
      return remote;
    },
    enabled: !!sessionId && !!chatId,
    staleTime: pollRemote ? 0 : INBOX_AVATAR_STALE_MS,
    gcTime: INBOX_AVATAR_GC_MS,
    refetchInterval: pollRemote ? INBOX_AVATAR_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: pollRemote,
    refetchOnWindowFocus: pollRemote,
    retry: false,
  });
}

export function useInboxListMediaThumb(
  sessionId: string,
  messageId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.inboxListMedia(sessionId, messageId ?? ''),
    queryFn: () => loadMessageMediaBlob(sessionId, messageId!),
    enabled: enabled && !!sessionId && !!messageId,
    staleTime: INBOX_LIST_MEDIA_STALE_MS,
    gcTime: INBOX_LIST_MEDIA_STALE_MS,
    retry: 3,
    retryDelay: attempt => Math.min(2000 * 2 ** attempt, 10_000),
  });
}

// ── Webhook Queries ───────────────────────────────────────────────────

export function useWebhooksQuery() {
  return useQuery({
    queryKey: queryKeys.webhooks,
    queryFn: webhookApi.listAll,
    staleTime: 30_000,
  });
}

export function useCreateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; url: string; events: string[] }) =>
      webhookApi.create(params.sessionId, { url: params.url, events: params.events }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useUpdateWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string; data: Partial<Webhook> }) =>
      webhookApi.update(params.sessionId, params.id, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

export function useDeleteWebhookMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { sessionId: string; id: string }) =>
      webhookApi.delete(params.sessionId, params.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });
}

// ── API Key Queries ───────────────────────────────────────────────────

export function useApiKeysQuery() {
  return useQuery({
    queryKey: queryKeys.apiKeys,
    queryFn: apiKeyApi.list,
    staleTime: 30_000,
  });
}

export function useCreateApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; role: string; allowedIps?: string[]; allowedSessions?: string[]; expiresAt?: string }) =>
      apiKeyApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useDeleteApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

export function useRevokeApiKeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiKeyApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys });
    },
  });
}

// ── Logs Queries ──────────────────────────────────────────────────────

export function useLogsQuery(params: {
  severity?: string;
  action?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  return useQuery({
    queryKey: queryKeys.logs(params),
    queryFn: () =>
      auditApi.list({
        severity: params.severity,
        action: params.action,
        q: params.q,
        limit: params.limit,
        offset: (params.page - 1) * params.limit,
      }),
    staleTime: 15_000,
  });
}

// ── Infrastructure Queries ────────────────────────────────────────────

export function useInfraStatusQuery() {
  return useQuery({
    queryKey: queryKeys.infraStatus,
    queryFn: infraApi.getStatus,
    staleTime: 30_000,
  });
}

// ── Plugin Queries ────────────────────────────────────────────────────

export function usePluginsQuery() {
  return useQuery({
    queryKey: queryKeys.plugins,
    queryFn: pluginsApi.list,
    staleTime: 30_000,
  });
}

export function useEnginesQuery() {
  return useQuery({
    queryKey: queryKeys.engines,
    queryFn: pluginsApi.getEngines,
    staleTime: 60_000,
  });
}

export function useCurrentEngineQuery() {
  return useQuery({
    queryKey: queryKeys.currentEngine,
    queryFn: pluginsApi.getCurrentEngine,
    staleTime: 60_000,
  });
}

// ── Settings ──────────────────────────────────────────────────────────

export function useSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.get,
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSettingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => settingsApi.update(patch),
    onSuccess: data => {
      queryClient.setQueryData(queryKeys.settings, data);
    },
  });
}

// ── Dashboard Control Room ─────────────────────────────────────────────

const DASHBOARD_REFETCH_MS = 60_000;

export function useInauzwaSyncStatusQuery() {
  return useQuery({
    queryKey: queryKeys.inauzwaStatus,
    queryFn: () => productsApi.inauzwaSyncStatus(),
    staleTime: 60_000,
  });
}

export function useFollowupQueueCountsQuery(branchId?: string, staffId?: string) {
  return useQuery({
    queryKey: queryKeys.followupQueueCounts(branchId, staffId),
    queryFn: () => followupApi.getQueueCounts(branchId, staffId),
    staleTime: 30_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function usePipelineDashboardQuery(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.pipelineDashboard(branchId),
    queryFn: () => followupApi.getPipelineDashboard(branchId),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function usePipelineCountsQuery(branchId?: string, staffId?: string) {
  return useQuery({
    queryKey: queryKeys.pipelineCounts(branchId, staffId),
    queryFn: () => followupApi.getPipelineCounts(branchId, staffId),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function usePipelineBucketQuery(bucket: PipelineBucket, branchId?: string, staffId?: string) {
  return useQuery({
    queryKey: queryKeys.pipelineBucket(bucket, branchId, staffId),
    queryFn: () => followupApi.getPipeline(bucket, branchId, staffId),
    staleTime: 60_000,
  });
}

export function useFollowupQueueQuery(
  filter: FollowUpQueueFilter,
  branchId?: string,
  staffId?: string,
) {
  return useQuery({
    queryKey: queryKeys.followupQueue(filter, branchId, staffId),
    queryFn: () => followupApi.getQueue(filter, branchId, staffId),
    staleTime: 30_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function useDashboardInboxSnapshotQuery(
  branchId?: string,
  options?: { enabled?: boolean },
) {
  const params = {
    status: 'open' as const,
    limit: 200,
    offset: 0,
    ...(branchId ? { branchId } : {}),
  };
  return useQuery({
    queryKey: queryKeys.inboxConversationsAll(params),
    queryFn: () => inboxApi.getConversations(params),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });
}

export function useQuotesSummaryQuery(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.quotesList(branchId),
    queryFn: () => quoteApi.list(branchId ? { branchId } : undefined),
    staleTime: 60_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function useAuditRecentQuery(limit = 25) {
  return useQuery({
    queryKey: [...queryKeys.auditRecent, limit],
    queryFn: () => auditApi.list({ limit, offset: 0 }),
    staleTime: 30_000,
    refetchInterval: DASHBOARD_REFETCH_MS,
  });
}

export function useAuditMessageSentQuery(limit = 100) {
  return useQuery({
    queryKey: [...queryKeys.auditRecent, 'message_sent', limit],
    queryFn: () => auditApi.list({ action: 'message_sent', limit, offset: 0 }),
    staleTime: 300_000,
    refetchInterval: 300_000,
    refetchIntervalInBackground: false,
  });
}

export function useCatalogStatsQuery() {
  return useQuery({
    queryKey: queryKeys.catalogStats,
    queryFn: () => productsApi.catalogStats({ activeOnly: true }),
    staleTime: 120_000,
  });
}

export function useFollowupReportsQuery() {
  return useQuery({
    queryKey: queryKeys.followupReports,
    queryFn: () => followupApi.getReports(),
    staleTime: 60_000,
  });
}

export function useFollowupStaffQuery() {
  return useQuery({
    queryKey: queryKeys.followupStaff,
    queryFn: () => followupApi.listStaff(),
    staleTime: 120_000,
  });
}

export function useConversionReportQuery(branchId?: string) {
  return useQuery({
    queryKey: queryKeys.conversionReport(branchId),
    queryFn: () => followupApi.getConversionReport(branchId),
    staleTime: 120_000,
  });
}

export function useAiStatusQuery() {
  return useQuery({
    queryKey: queryKeys.aiStatus,
    queryFn: () => aiApi.getStatus(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useAutoReplyHealthQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiAutoReplyHealth,
    queryFn: () => aiApi.getAutoReplyHealth(),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function useAiSignalsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiSignals,
    queryFn: () => aiApi.getAiDashboardSignals(),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}

export function useAiLearningAlertsQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.aiLearningAlerts,
    queryFn: () => aiLearningDashboardApi.getAlerts(),
    staleTime: 60_000,
    retry: false,
    enabled,
  });
}
