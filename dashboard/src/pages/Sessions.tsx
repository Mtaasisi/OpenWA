import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { Plus, QrCode, RefreshCw, Trash2, Eye, Loader2, Play, Square, X, Search, Filter, Bot, Activity, AlertTriangle, Cpu, ChevronDown } from 'lucide-react';
import { sessionApi, whatsAppSafetyApi, type Session, type SessionHealthOverview } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { useSessionStartFlow } from '../hooks/useSessionStartFlow';
import { forgetLinkedSessionAutoStart } from '../hooks/useLinkedSessionsAutoStart';
import { queryKeys, useSessionsQuery, useSessionHealthOverviewQuery, useCurrentEngineQuery, useEnginesQuery, useOverviewStatsQuery, useUnifiedInboxConversationsQuery } from '../hooks/queries';
import { ModalOverlay } from '../components/ModalOverlay';
import { SessionQrModal } from '../components/SessionQrModal';
import { WhatsAppLinkSafetyModal } from '../components/WhatsAppLinkSafetyModal';
import { WhatsAppLinkSafetyBanner } from '../components/WhatsAppLinkSafetyBanner';
import { WhatsAppLinkSafetySessionChip } from '../components/WhatsAppLinkSafetySessionChip';
import { SessionsStatusPills } from '../components/SessionsStatusPills';
import { ChannelSessionCard } from '../components/channels/ChannelSessionCard';
import { ChannelsWorkspace } from '../components/channels/ChannelsWorkspace';
import { ChannelsPageSkeleton } from '../components/channels/ChannelsPageSkeleton';
import type { ChannelsGridExtrasRender } from '../components/channels/channels-grid-types';
import type { ChannelsGridFilter } from '../components/channels/channel-grid-utils';
import { unreadBySession } from '../lib/dashboard-metrics';
import './Channels.css';
import { isSessionConnecting, isSessionRunning, canCallSessionStart } from '../lib/session-status';
import { sessionNeedsLink } from '../lib/session-link.util';
import { detectSessionHealthIssue, isSessionHealthHealthy } from '../lib/session-health-utils';
import type { SessionLinkVerification } from '../lib/session-link-verify';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';
import { AskAiLink } from '../components/AskAiLink';
import { FilterBar, SearchInput } from '../components/workspace';
import type { ReactNode } from 'react';
import './Sessions.css';

function sessionRequiresRelinkMessageKey(session: Pick<Session, 'relinkReason'>): string {
  return session.relinkReason === 'alternate_engine'
    ? 'sessions.engine.requiresRelinkAlternateEngine'
    : 'sessions.engine.requiresRelinkAuthMissing';
}

function showRequiresRelinkBanner(session: Session): boolean {
  return Boolean(
    session.requiresRelink && !session.linkingMode && !isSessionConnecting(session.status),
  );
}

const FILTER_IDS = ['all', 'active', 'inactive', 'connecting'] as const;

function normalizeStatusFilter(value?: string | null): string {
  if (value && FILTER_IDS.includes(value as (typeof FILTER_IDS)[number])) return value;
  return 'all';
}

function pickDefaultSession(
  sessions: Session[],
  healthBySessionId: Map<string, SessionHealthOverview>,
): Session | undefined {
  return (
    sessions.find(s => s.requiresRelink) ??
    sessions.find(s => s.status === 'failed') ??
    sessions.find(s => {
      const entry = healthBySessionId.get(s.id);
      return entry && !isSessionHealthHealthy(entry);
    }) ??
    sessions[0]
  );
}

type SessionsEmbedContext = 'settings' | 'workspace';

export function Sessions({
  embedded = false,
  embedContext = 'settings',
  compactSettingsEmbed = false,
  hideCreateActions = false,
  onAddChannelClick,
  appendGridCards,
  onSessionSelect,
  focusSessionId,
  selectedSessionId,
  autoOpenSessionQr = false,
  splitDetailPane = false,
  externalDetailPane,
  isMobile = false,
  mobilePane = 'list',
  onMobileShowDetail,
  onMobileBack,
  extraChannelCount = 0,
  getExtraGridCount,
  initialStatusFilter,
  initialSearchQuery,
  onWorkspaceFiltersChange,
  onAutoReconnectHandled,
}: {
  embedded?: boolean;
  embedContext?: SessionsEmbedContext;
  /** When embedded in settings hub: hide engine/health strips until More options. */
  compactSettingsEmbed?: boolean;
  hideCreateActions?: boolean;
  onAddChannelClick?: () => void;
  appendGridCards?: ReactNode | ChannelsGridExtrasRender;
  onSessionSelect?: (sessionId: string | null) => void;
  focusSessionId?: string | null;
  selectedSessionId?: string | null;
  autoOpenSessionQr?: boolean;
  /** List | detail split (Channels page). */
  splitDetailPane?: boolean;
  externalDetailPane?: ReactNode;
  isMobile?: boolean;
  mobilePane?: 'list' | 'detail';
  onMobileShowDetail?: () => void;
  onMobileBack?: () => void;
  extraChannelCount?: number;
  getExtraGridCount?: (filter: ChannelsGridFilter) => number;
  initialStatusFilter?: string;
  initialSearchQuery?: string;
  onWorkspaceFiltersChange?: (filters: { statusFilter: string; searchQuery: string }) => void;
  onAutoReconnectHandled?: () => void;
} = {}) {
  const { t } = useTranslation();
  useDocumentTitle(embedded ? t('settings.title') : t('sessions.title'));
  const toast = useToast();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const {
    data: sessions = [],
    isLoading: loading,
    isFetching: sessionsFetching,
    error: sessionsQueryError,
    refetch: refetchSessions,
  } = useSessionsQuery({
    refetchInterval: splitDetailPane && embedContext === 'workspace' ? 30_000 : undefined,
  });
  const linkedSessionCount = sessions.filter(s => s.phone).length;
  const { data: healthOverview = [] } = useSessionHealthOverviewQuery({
    enabled: linkedSessionCount > 0,
    refetchInterval: 60_000,
  });
  const { data: currentEngineData } = useCurrentEngineQuery();
  const { data: engines = [] } = useEnginesQuery();
  const currentEngineId = currentEngineData?.engineType ?? 'whatsapp-web.js';
  const currentEngineLabel = engines.find(e => e.id === currentEngineId)?.name ?? currentEngineId;
  const healthBySessionId = new Map(healthOverview.map(entry => [entry.sessionId, entry]));
  const healthAttentionCount = healthOverview.filter(entry => !isSessionHealthHealthy(entry)).length;
  const { data: linkSafetySummary } = useQuery({
    queryKey: ['whatsapp-safety', 'link-preflight-summary'],
    queryFn: () => whatsAppSafetyApi.getLinkPreflightSummary(),
    staleTime: 60_000,
    refetchInterval: splitDetailPane && embedContext === 'workspace' ? 60_000 : undefined,
    retry: false,
  });
  const linkSafetyBySessionId = useMemo(
    () => new Map((linkSafetySummary?.sessions ?? []).map(row => [row.sessionId, row])),
    [linkSafetySummary],
  );
  const [error, setError] = useState<string | null>(null);

  const patchSessions = useCallback(
    (updater: (prev: Session[]) => Session[]) => {
      queryClient.setQueryData<Session[]>(queryKeys.sessions, prev => updater(prev ?? []));
    },
    [queryClient],
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionProxyUrl, setNewSessionProxyUrl] = useState('');
  const [newSessionProxyType, setNewSessionProxyType] = useState<
    'http' | 'https' | 'socks4' | 'socks5'
  >('socks5');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? '');
  const [statusFilter, setStatusFilter] = useState(normalizeStatusFilter(initialStatusFilter));
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const [compactMoreOpen, setCompactMoreOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [forceRelinkConfirmId, setForceRelinkConfirmId] = useState<string | null>(null);
  const [relinkingId, setRelinkingId] = useState<string | null>(null);
  const [savingAiAutoReply, setSavingAiAutoReply] = useState(false);
  const [savingFollowupAutopilot, setSavingFollowupAutopilot] = useState(false);
  const [staffAiNumbersText, setStaffAiNumbersText] = useState('');
  const [proxyUrlText, setProxyUrlText] = useState('');
  const [proxyType, setProxyType] = useState<'http' | 'https' | 'socks4' | 'socks5'>('socks5');
  const [savingProxy, setSavingProxy] = useState(false);
  const [savingStaffAi, setSavingStaffAi] = useState(false);
  const focusHandledRef = useRef<string | null>(null);
  const userDismissedInspector = useRef(false);
  const lastDisconnectToastRef = useRef<Map<string, number>>(new Map());
  const wasFetchingRef = useRef(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());

  useEffect(() => {
    if (wasFetchingRef.current && !sessionsFetching && !loading) {
      setLastRefreshedAt(Date.now());
    }
    wasFetchingRef.current = sessionsFetching;
  }, [sessionsFetching, loading]);

  useEffect(() => {
    if (!sessionsQueryError) return;
    setError(
      sessionsQueryError instanceof Error
        ? sessionsQueryError.message
        : t('sessions.create.errorDefault'),
    );
  }, [sessionsQueryError, t]);

  const showLinkedReadyToast = useCallback(
    (verification: SessionLinkVerification) => {
      if (verification.ok) {
        const hints = [t('sessions.toasts.readySafetyHint')];
        if (verification.warmupActive) {
          hints.push(t('sessions.toasts.readyWarmupActive'));
        }
        if (verification.startupSafeMode) {
          hints.push(t('sessions.toasts.readySafeModeActive'));
        }
        toast.success(
          t('sessions.toasts.readyTitle'),
          `${t('sessions.toasts.readyVerifiedDesc', { phone: verification.phone ?? '' })} ${hints.join(' ')}`,
        );
        return;
      }
      toast.warning(
        t('sessions.toasts.readyPartialTitle'),
        t('sessions.toasts.readyPartialDesc'),
      );
    },
    [t, toast],
  );

  const {
    starting,
    qrModal,
    linkPreflight,
    closeQrModal,
    continueQrInBackground,
    startSessionFlow,
    requestLinkPreflight,
    confirmLinkPreflight,
    cancelLinkPreflight,
    retrySessionFlow,
  } = useSessionStartFlow({
    onReady: (_sessionId, verification) => {
      showLinkedReadyToast(verification);
    },
    onError: msg => setError(msg),
    onSessionStatus: useCallback(
      (event: { sessionId: string; status: string; reason?: string }) => {
        patchSessions(prev =>
          prev.map(s => (s.id === event.sessionId ? { ...s, status: event.status as Session['status'] } : s)),
        );
        if (event.status === 'ready') {
          // Ready toast is handled by onReady after link verification.
          return;
        } else if (event.status === 'disconnected' || event.status === 'failed') {
          const now = Date.now();
          const lastToast = lastDisconnectToastRef.current.get(event.sessionId) ?? 0;
          if (now - lastToast < 30_000) return;
          lastDisconnectToastRef.current.set(event.sessionId, now);

          let desc =
            event.status === 'failed'
              ? t('sessions.toasts.failedDesc', { defaultValue: 'Session failed to start. Try again.' })
              : t('sessions.toasts.disconnectedDesc');
          if (event.reason === 'LOGOUT') {
            desc = t('sessions.toasts.disconnectedLogoutDesc');
          } else if (event.reason === 'CONFLICT') {
            desc = t('sessions.toasts.disconnectedConflictDesc');
          } else if (event.reason) {
            desc = t('sessions.toasts.disconnectedReasonDesc', { reason: event.reason });
          }
          toast.warning(
            event.status === 'failed'
              ? t('sessions.toasts.failedTitle', { defaultValue: 'Session failed' })
              : t('sessions.toasts.disconnectedTitle'),
            desc,
          );
        }
      },
      [patchSessions, toast, t],
    ),
  });

  const handleCreate = async () => {
    if (!newSessionName.trim()) return;
    try {
      setCreating(true);
      const newSession = await sessionApi.create({
        name: newSessionName,
        ...(newSessionProxyUrl.trim()
          ? {
              proxyUrl: newSessionProxyUrl.trim(),
              proxyType: newSessionProxyType,
            }
          : {}),
      });
      patchSessions(prev => [...prev, newSession]);
      setNewSessionName('');
      setNewSessionProxyUrl('');
      setNewSessionProxyType('socks5');
      setShowCreateModal(false);
      toast.success(t('sessions.create.successTitle'), t('sessions.create.successDesc', { name: newSession.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.create.errorDefault');
      setError(msg);
      toast.error(t('sessions.create.errorTitle'), msg);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (!selectedSession) {
      setStaffAiNumbersText('');
      setProxyUrlText('');
      setProxyType('socks5');
      return;
    }
    setStaffAiNumbersText((selectedSession.staffAiAllowedNumbers ?? []).join('\n'));
    setProxyUrlText(selectedSession.proxyUrl ?? '');
    setProxyType(selectedSession.proxyType ?? 'socks5');
  }, [selectedSession]);

  useEffect(() => {
    if (!splitDetailPane || !onWorkspaceFiltersChange) return;
    onWorkspaceFiltersChange({ statusFilter, searchQuery: debouncedSearchQuery });
  }, [splitDetailPane, statusFilter, debouncedSearchQuery, onWorkspaceFiltersChange]);

  useEffect(() => {
    if (!splitDetailPane || !selectedSessionId) return;
    const session = sessions.find(s => s.id === selectedSessionId);
    if (session) setSelectedSession(session);
  }, [splitDetailPane, selectedSessionId, sessions]);

  const handleWorkspaceSessionSelect = (sessionId: string | null) => {
    if (sessionId) userDismissedInspector.current = false;
    onSessionSelect?.(sessionId);
  };

  const handleSaveStaffAiNumbers = async () => {
    if (!selectedSession) return;
    const numbers = staffAiNumbersText
      .split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(Boolean);
    try {
      setSavingStaffAi(true);
      const updated = await sessionApi.setStaffAiNumbers(selectedSession.id, numbers);
      patchSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setSelectedSession(updated);
      toast.success(t('sessions.details.staffAiSaved'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('ai.settings.saveFailed'));
    } finally {
      setSavingStaffAi(false);
    }
  };

  const handleSaveAllSettings = async () => {
    if (!selectedSession) return;
    const isChannelsInspector = embedded && embedContext === 'workspace' && splitDetailPane;
    try {
      setSavingProxy(true);
      const proxyUpdated = await sessionApi.setProxy(selectedSession.id, {
        proxyUrl: proxyUrlText.trim() || null,
        proxyType: proxyUrlText.trim() ? proxyType : undefined,
      });
      let merged = proxyUpdated;
      if (!isChannelsInspector) {
        const numbers = staffAiNumbersText
          .split(/[\n,;]+/)
          .map(n => n.trim())
          .filter(Boolean);
        setSavingStaffAi(true);
        const staffUpdated = await sessionApi.setStaffAiNumbers(selectedSession.id, numbers);
        merged = { ...proxyUpdated, ...staffUpdated };
      }
      patchSessions(prev =>
        prev.map(s => (s.id === selectedSession.id ? { ...s, ...merged } : s)),
      );
      setSelectedSession(prev => (prev ? { ...prev, ...merged } : prev));
      toast.success(
        t('channels.inspector.savedChangesTitle', { defaultValue: 'Changes saved' }),
        t('channels.inspector.savedChangesDesc', {
          defaultValue: 'Channel settings were updated.',
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('ai.settings.saveFailed');
      toast.error(t('channels.inspector.saveFailed', { defaultValue: 'Save failed' }), msg);
    } finally {
      setSavingProxy(false);
      setSavingStaffAi(false);
    }
  };

  const handleAiAutoReplyToggle = async (session: Session, enabled: boolean) => {
    try {
      setSavingAiAutoReply(true);
      const updated = await sessionApi.setAiAutoReply(session.id, enabled);
      patchSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setSelectedSession((prev) => (prev?.id === updated.id ? updated : prev));
      toast.success(t('sessions.details.aiAutoReplySaved'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('ai.settings.saveFailed');
      toast.error(msg);
    } finally {
      setSavingAiAutoReply(false);
    }
  };

  const handleFollowupAutopilotToggle = async (session: Session, enabled: boolean) => {
    try {
      setSavingFollowupAutopilot(true);
      const updated = await sessionApi.setFollowupAutopilot(session.id, enabled);
      patchSessions(prev => prev.map(s => (s.id === updated.id ? updated : s)));
      setSelectedSession(prev => (prev?.id === updated.id ? updated : prev));
      toast.success(t('sessions.details.followupAutopilotSaved'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('ai.settings.saveFailed');
      toast.error(msg);
    } finally {
      setSavingFollowupAutopilot(false);
    }
  };

  const handleSaveProxy = async () => {
    if (!selectedSession) return;
    try {
      setSavingProxy(true);
      const updated = await sessionApi.setProxy(selectedSession.id, {
        proxyUrl: proxyUrlText.trim() || null,
        proxyType: proxyUrlText.trim() ? proxyType : undefined,
      });
      patchSessions(prev => prev.map(s => (s.id === selectedSession.id ? { ...s, ...updated } : s)));
      setSelectedSession(prev => (prev ? { ...prev, ...updated } : prev));
      toast.success(
        t('sessions.details.proxySavedTitle'),
        isSessionRunning(updated.status)
          ? t('sessions.details.proxySavedRestarted')
          : t('sessions.details.proxySavedDesc'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.details.proxySaveError');
      toast.error(t('sessions.details.proxySaveErrorTitle'), msg);
    } finally {
      setSavingProxy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try {
      await sessionApi.delete(id);
      forgetLinkedSessionAutoStart(id);
      patchSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSession?.id === id) setSelectedSession(null);
      if (qrModal?.sessionId === id) closeQrModal();
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessionStats });
      toast.success(
        t('sessions.delete.successTitle'),
        session ? t('sessions.delete.successDescNamed', { name: session.name }) : t('sessions.delete.successDescGeneric'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.delete.errorDefault');
      console.error('Failed to delete:', err);
      toast.error(t('sessions.delete.errorTitle'), msg);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStart = (id: string) => {
    void startSessionFlow(id, sessions).catch(err => {
      console.error('Failed to start:', err);
      void refetchSessions();
    });
  };

  const handleShowQR = (id: string) => {
    void startSessionFlow(id, sessions);
  };

  const handleStop = async (id: string) => {
    try {
      await sessionApi.stop(id);
      patchSessions(prev => prev.map(s => (s.id === id ? { ...s, status: 'disconnected' } : s)));
      if (qrModal?.sessionId === id) closeQrModal();
    } catch (err) {
      console.error('Failed to stop:', err);
      void refetchSessions();
    }
  };

  const canForceRelinkSession = (session: Session) => {
    if (!session.phone?.trim() || session.requiresRelink) return false;
    if (session.engineAuthPresent) return true;
    return session.status === 'failed' || isSessionRunning(session.status);
  };

  const handleRelink = useCallback((session: Session, options?: { keepModalOpen?: boolean }) => {
    if (relinkingId) return;
    requestLinkPreflight({
      sessionId: session.id,
      sessionName: session.name,
      action: 'relink',
      onExecute: async () => {
        setRelinkingId(session.id);
        try {
          const updated = await sessionApi.relink(session.id);
          patchSessions(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
          if (selectedSession?.id === session.id) {
            setSelectedSession(prev => (prev ? { ...prev, ...updated } : prev));
          }
          if (!options?.keepModalOpen) setSelectedSession(null);
          const nextSessions = sessions.map(s => (s.id === updated.id ? { ...s, ...updated } : s));
          await startSessionFlow(session.id, nextSessions, { skipPreflight: true });
        } catch (err) {
          const msg = err instanceof Error ? err.message : t('sessions.toasts.relinkError');
          toast.error(t('sessions.toasts.relinkErrorTitle'), msg);
        } finally {
          setRelinkingId(null);
        }
      },
    });
  }, [
    relinkingId,
    requestLinkPreflight,
    patchSessions,
    selectedSession?.id,
    sessions,
    startSessionFlow,
    t,
    toast,
  ]);

  const handleForceRelinkConfirm = () => {
    const session = sessions.find(s => s.id === forceRelinkConfirmId);
    setForceRelinkConfirmId(null);
    if (session) void handleRelink(session, { keepModalOpen: true });
  };

  useEffect(() => {
    if (!focusSessionId || loading) return;
    if (focusHandledRef.current === focusSessionId) return;
    const session = sessions.find(s => s.id === focusSessionId);
    if (!session) return;

    focusHandledRef.current = focusSessionId;

    requestAnimationFrame(() => {
      document.getElementById(`session-card-${session.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });

    if (autoOpenSessionQr && canWrite && (session.requiresRelink || session.status !== 'ready')) {
      onMobileShowDetail?.();
      if (session.requiresRelink) {
        handleRelink(session, { keepModalOpen: true });
      } else {
        void startSessionFlow(session.id, sessions);
      }
      onAutoReconnectHandled?.();
    }
  }, [
    focusSessionId,
    autoOpenSessionQr,
    loading,
    sessions,
    canWrite,
    startSessionFlow,
    handleRelink,
    onMobileShowDetail,
    onAutoReconnectHandled,
  ]);

  const handleRestart = async (id: string) => {
    try {
      const updated = await sessionApi.restart(id);
      patchSessions(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
      toast.success(t('sessions.toasts.restartTitle'), t('sessions.toasts.restartDesc'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.toasts.restartError');
      console.error('Failed to restart:', err);
      toast.error(t('sessions.toasts.restartErrorTitle'), msg);
      void refetchSessions();
    }
  };

  const canRestartSession = (session: Session) =>
    isSessionRunning(session.status) ||
    (!!session.phone && (session.status === 'disconnected' || session.status === 'failed'));

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const getHealthIssueMessage = (sessionId: string): string | null => {
    const entry = healthBySessionId.get(sessionId);
    if (!entry) return null;
    const issue = detectSessionHealthIssue(entry);
    if (!issue) return null;
    return t(`sessions.health.issues.${issue}`);
  };

  const openCreate = () => {
    if (onAddChannelClick) onAddChannelClick();
    else setShowCreateModal(true);
  };

  const useWorkspaceEmbed = embedded && embedContext === 'workspace';
  const gridFilter = useMemo(
    () => ({ searchQuery, statusFilter }),
    [searchQuery, statusFilter],
  );
  const listExtras =
    typeof appendGridCards === 'function'
      ? appendGridCards(gridFilter)
      : appendGridCards;
  const resolvedExtraChannelCount = useMemo(() => {
    if (typeof getExtraGridCount === 'function') return getExtraGridCount(gridFilter);
    return extraChannelCount;
  }, [extraChannelCount, getExtraGridCount, gridFilter]);
  const { data: overviewStats } = useOverviewStatsQuery();
  const { data: inboxResponse } = useUnifiedInboxConversationsQuery(undefined, {
    enabled: useWorkspaceEmbed,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadMap = useMemo(
    () => (useWorkspaceEmbed ? unreadBySession(inboxResponse?.conversations ?? []) : {}),
    [useWorkspaceEmbed, inboxResponse?.conversations],
  );
  const failedBySession = overviewStats?.messages.failedBySession ?? {};
  const showCompactMore = embedded && compactSettingsEmbed && !useWorkspaceEmbed;
  const showEngineStrip = !useWorkspaceEmbed && (!showCompactMore || compactMoreOpen);
  const showHealthStrip =
    !useWorkspaceEmbed &&
    linkedSessionCount > 0 &&
    healthOverview.length > 0 &&
    (!showCompactMore || compactMoreOpen || healthAttentionCount > 0);

  const statusChips = [
    { id: 'all', label: t('sessions.filter.all') },
    { id: 'active', label: t('sessions.filter.active') },
    { id: 'inactive', label: t('sessions.filter.inactive') },
    { id: 'connecting', label: t('sessions.filter.connecting') },
  ] as const;

  const filteredSessions = sessions.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.phone?.toLowerCase().includes(q) ?? false) ||
      (s.pushName?.toLowerCase().includes(q) ?? false);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'ready' && !s.requiresRelink) ||
      (statusFilter === 'inactive' &&
        (['created', 'disconnected', 'failed'].includes(s.status) || s.requiresRelink)) ||
      (statusFilter === 'connecting' && isSessionConnecting(s.status));
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    if (
      !splitDetailPane ||
      isMobile ||
      selectedSessionId ||
      externalDetailPane ||
      userDismissedInspector.current
    ) {
      return;
    }
    const first = filteredSessions[0] ?? pickDefaultSession(sessions, healthBySessionId);
    if (first) {
      userDismissedInspector.current = false;
      onSessionSelect?.(first.id);
    }
  }, [
    splitDetailPane,
    isMobile,
    selectedSessionId,
    externalDetailPane,
    filteredSessions,
    sessions,
    onSessionSelect,
  ]);

  useEffect(() => {
    if (!splitDetailPane || !focusSessionId) return;
    const el = document.getElementById(`session-card-${focusSessionId}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [splitDetailPane, focusSessionId, filteredSessions.length]);

  useEffect(() => {
    if (!splitDetailPane || externalDetailPane || !selectedSessionId) return;
    if (filteredSessions.some(s => s.id === selectedSessionId)) return;
    const next = filteredSessions[0];
    handleWorkspaceSessionSelect(next?.id ?? null);
  }, [externalDetailPane, filteredSessions, selectedSessionId, splitDetailPane]);

  const handleChannelsRefresh = useCallback(async () => {
    await Promise.all([
      refetchSessions(),
      queryClient.invalidateQueries({ queryKey: queryKeys.sessionHealth }),
      queryClient.invalidateQueries({ queryKey: ['whatsapp-safety', 'link-preflight-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] }),
    ]);
  }, [queryClient, refetchSessions]);

  const pageClassName = [
    'sessions-page',
    embedded ? 'sessions-workspace-embed settings-embed' : '',
    useWorkspaceEmbed ? 'sessions-workspace-embed--native' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    if (splitDetailPane && useWorkspaceEmbed) {
      return (
        <div className={pageClassName}>
          <ChannelsPageSkeleton />
        </div>
      );
    }
    return (
      <div
        className={pageClassName}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: embedded ? '200px' : '400px',
        }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const workspaceToolbar = (
    <FilterBar
      search={
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('sessions.searchPlaceholder')}
        />
      }
      chips={statusChips.map(chip => ({
        id: chip.id,
        label: chip.label,
        active: statusFilter === chip.id,
        onClick: () => setStatusFilter(chip.id),
      }))}
      actions={
        <>
          {canWrite && !hideCreateActions && (
            <button type="button" className="fu-btn fu-btn--primary" onClick={openCreate}>
              <Plus size={16} />
              {t('sessions.newSession')}
            </button>
          )}
          <button type="button" className="fu-btn fu-btn--ghost" onClick={() => void refetchSessions()}>
            <RefreshCw size={16} />
            {t('common.refresh')}
          </button>
        </>
      }
    />
  );

  const paneSession =
    selectedSession ??
    (selectedSessionId ? sessions.find(s => s.id === selectedSessionId) ?? null : null);

  return (
    <div className={pageClassName}>
      {!embedded ? (
        <>
          <PageHeader
            title={t('sessions.title')}
            subtitle={t('sessions.subtitle')}
            actions={
              <>
                <AskAiLink prompt={t('ai.prompts.sessions')} />
                {canWrite && !hideCreateActions && (
                  <button type="button" className="btn-primary" onClick={openCreate}>
                    <Plus size={18} />
                    {t('sessions.newSession')}
                  </button>
                )}
              </>
            }
          />
          <div className="filters-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('sessions.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusChips.map(chip => (
                  <option key={chip.id} value={chip.id}>
                    {chip.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : useWorkspaceEmbed && !splitDetailPane ? (
        workspaceToolbar
      ) : !useWorkspaceEmbed ? (
        <>
          {canWrite && !hideCreateActions && (
            <div className="settings-embed-toolbar">
              <button type="button" className="btn-primary" onClick={openCreate}>
                <Plus size={18} />
                {t('sessions.newSession')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => void refetchSessions()}>
                <RefreshCw size={16} />
                {t('common.refresh')}
              </button>
            </div>
          )}
          <div className="filters-bar">
            <div className="search-input">
              <Search size={18} />
              <input
                type="text"
                placeholder={t('sessions.searchPlaceholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <Filter size={16} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusChips.map(chip => (
                  <option key={chip.id} value={chip.id}>
                    {chip.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      ) : null}

      {error && !(splitDetailPane && useWorkspaceEmbed) ? (
        <div className="ws-inline-error">{error}</div>
      ) : null}

      {splitDetailPane && useWorkspaceEmbed ? (
        <ChannelsWorkspace
          sessions={sessions}
          filteredSessions={filteredSessions}
          listExtras={listExtras}
          error={error}
          canWrite={canWrite}
          hideCreateActions={hideCreateActions}
          onAddChannelClick={onAddChannelClick}
          onRefresh={() => void handleChannelsRefresh()}
          refreshing={sessionsFetching && !loading}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          healthOverview={healthOverview}
          linkSafetySessions={linkSafetySummary?.sessions}
          linkSafetyBySessionId={linkSafetyBySessionId}
          healthBySessionId={healthBySessionId}
          unreadMap={unreadMap}
          failedBySession={failedBySession}
          selectedSessionId={selectedSessionId}
          focusSessionId={focusSessionId}
          externalDetailPane={externalDetailPane}
          paneSession={paneSession}
          isMobile={isMobile}
          mobilePane={mobilePane}
          onMobileShowDetail={onMobileShowDetail}
          onMobileBack={onMobileBack}
          onSessionSelect={handleWorkspaceSessionSelect}
          onDismissInspector={() => {
            userDismissedInspector.current = true;
            onSessionSelect?.(null);
          }}
          getHealthIssueMessage={getHealthIssueMessage}
          relinkingId={relinkingId}
          starting={starting}
          formatLastActive={formatLastActive}
          handleShowQR={handleShowQR}
          engines={engines}
          currentEngineId={currentEngineId}
          currentEngineLabel={currentEngineLabel}
          proxyUrlText={proxyUrlText}
          proxyType={proxyType}
          staffAiNumbersText={staffAiNumbersText}
          savingAiAutoReply={savingAiAutoReply}
          savingFollowupAutopilot={savingFollowupAutopilot}
          savingProxy={savingProxy}
          savingStaffAi={savingStaffAi}
          formatStatus={formatStatus}
          showRequiresRelinkBanner={showRequiresRelinkBanner}
          sessionRequiresRelinkMessageKey={sessionRequiresRelinkMessageKey}
          qrModal={qrModal}
          retrySessionFlow={retrySessionFlow}
          continueQrInBackground={continueQrInBackground}
          setProxyUrlText={setProxyUrlText}
          setProxyType={setProxyType}
          setStaffAiNumbersText={setStaffAiNumbersText}
          handleAiAutoReplyToggle={handleAiAutoReplyToggle}
          handleFollowupAutopilotToggle={handleFollowupAutopilotToggle}
          handleSaveProxy={handleSaveProxy}
          handleSaveStaffAiNumbers={handleSaveStaffAiNumbers}
          handleSaveAllSettings={handleSaveAllSettings}
          handleRelink={handleRelink}
          setForceRelinkConfirmId={setForceRelinkConfirmId}
          setDeleteConfirmId={setDeleteConfirmId}
          handleRestart={handleRestart}
          handleStop={handleStop}
          canForceRelinkSession={canForceRelinkSession}
          canRestartSession={canRestartSession}
          openCreate={openCreate}
          extraChannelCount={resolvedExtraChannelCount}
          lastRefreshedAt={lastRefreshedAt}
        />
      ) : null}

      {!(splitDetailPane && useWorkspaceEmbed) && showCompactMore && !compactMoreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
          onClick={() => setCompactMoreOpen(true)}
        >
          <span>{t('settings.moreOptions')}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
      ) : null}

      {!(splitDetailPane && useWorkspaceEmbed) && showCompactMore && compactMoreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
          onClick={() => setCompactMoreOpen(false)}
        >
          {t('settings.showLess')}
        </button>
      ) : null}

      {!(splitDetailPane && useWorkspaceEmbed) && showEngineStrip ? (
      <div className="sessions-engine-strip">
        <Cpu size={16} />
        <div className="sessions-engine-strip__content">
          <strong>{t('sessions.engine.active', { engine: currentEngineLabel })}</strong>
          {currentEngineId === 'baileys' ? (
            <span>{t('sessions.engine.baileysHint')}</span>
          ) : null}
        </div>
        {canWrite ? (
          <Link to={settingsPanelHref('plugins')} className="sessions-engine-strip__link">
            {t('sessions.engine.changeEngine')}
          </Link>
        ) : null}
      </div>
      ) : null}

      {!(splitDetailPane && useWorkspaceEmbed) && showHealthStrip ? (
        <div
          className={`sessions-health-strip${
            healthAttentionCount > 0 ? ' sessions-health-strip--warn' : ' sessions-health-strip--ok'
          }`}
        >
          {healthAttentionCount > 0 ? <AlertTriangle size={18} /> : <Activity size={18} />}
          <div className="sessions-health-strip__content">
            <strong>{t('sessions.health.title')}</strong>
            <span>
              {healthAttentionCount > 0
                ? t('sessions.health.attentionSummary', {
                    count: healthAttentionCount,
                    total: healthOverview.length,
                  })
                : t('sessions.health.allHealthy', { count: healthOverview.length })}
            </span>
          </div>
        </div>
      ) : null}

      {showCreateModal && !hideCreateActions && (
        <ModalOverlay onClose={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.create.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>{t('sessions.create.label')}</label>
              <input
                type="text"
                placeholder={t('sessions.create.placeholder')}
                value={newSessionName}
                onChange={e => {
                  const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
                  setNewSessionName(value);
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <p className="input-hint">
                <Trans i18nKey="sessions.create.hint" components={[<code key="hint-code-0" />, <code key="hint-code-1" />]} />
              </p>
              {newSessionName && !/^[a-z0-9-]+$/.test(newSessionName) && (
                <p className="input-error">{t('sessions.create.invalidChars')}</p>
              )}
              {newSessionName && newSessionName.length > 50 && (
                <p className="input-error">{t('sessions.create.tooLong', { length: newSessionName.length })}</p>
              )}
              {newSessionName &&
                /^[a-z0-9-]+$/.test(newSessionName) &&
                newSessionName.length <= 50 &&
                sessions.some(s => s.name === newSessionName) && (
                  <p className="input-error">{t('sessions.create.duplicate')}</p>
                )}
              <label style={{ marginTop: '1rem' }}>{t('sessions.create.proxyUrlLabel')}</label>
              <input
                type="text"
                placeholder={t('sessions.create.proxyUrlPlaceholder')}
                value={newSessionProxyUrl}
                onChange={e => setNewSessionProxyUrl(e.target.value)}
              />
              <p className="input-hint">{t('sessions.create.proxyUrlHint')}</p>
              {newSessionProxyUrl.trim() ? (
                <>
                  <label style={{ marginTop: '0.75rem' }}>{t('sessions.create.proxyTypeLabel')}</label>
                  <select
                    value={newSessionProxyType}
                    onChange={e =>
                      setNewSessionProxyType(
                        e.target.value as 'http' | 'https' | 'socks4' | 'socks5',
                      )
                    }
                  >
                    <option value="socks5">SOCKS5 (recommended)</option>
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                    <option value="socks4">SOCKS4</option>
                  </select>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={
                  creating ||
                  !newSessionName.trim() ||
                  !/^[a-z0-9-]+$/.test(newSessionName) ||
                  newSessionName.length > 50 ||
                  sessions.some(s => s.name === newSessionName)
                }
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : t('common.create')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {linkPreflight ? (
        <WhatsAppLinkSafetyModal
          sessionId={linkPreflight.sessionId}
          sessionName={linkPreflight.sessionName}
          action={linkPreflight.action}
          onConfirm={confirmLinkPreflight}
          onCancel={cancelLinkPreflight}
        />
      ) : null}

      {qrModal && !(splitDetailPane && paneSession && qrModal.sessionId === paneSession.id) && (
        <SessionQrModal
          data={qrModal}
          onClose={closeQrModal}
          onRetry={sessionId => void retrySessionFlow(sessionId, sessions)}
          onContinueInBackground={continueQrInBackground}
        />
      )}

      {selectedSession && !splitDetailPane && (
        <ModalOverlay onClose={() => setSelectedSession(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.details.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setSelectedSession(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.name')}</span>
                  <span className="detail-value">{selectedSession.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.status')}</span>
                  <span className={`status-badge ${selectedSession.status}`}>{formatStatus(selectedSession.status)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.sessionId')}</span>
                  <span className="detail-value mono">{selectedSession.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.phone')}</span>
                  <span className="detail-value">{selectedSession.phone || t('sessions.details.phoneNone')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.engine')}</span>
                  <span className="detail-value">
                    {engines.find(e => e.id === (selectedSession.effectiveEngineType ?? currentEngineId))?.name ??
                      selectedSession.effectiveEngineType ??
                      currentEngineLabel}
                  </span>
                  <p className="text-muted" style={{ marginTop: '0.35rem', gridColumn: '1 / -1' }}>
                    {t('sessions.details.engineGlobalHint')}
                  </p>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.created')}</span>
                  <span className="detail-value">{new Date(selectedSession.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.lastActive')}</span>
                  <span className="detail-value">
                    {selectedSession.lastActive ? new Date(selectedSession.lastActive).toLocaleString() : t('common.never')}
                  </span>
                </div>
              </div>
              {(() => {
                const linkRow = linkSafetyBySessionId.get(selectedSession.id);
                if (!sessionNeedsLink(selectedSession) || !linkRow) return null;
                return <WhatsAppLinkSafetySessionChip row={linkRow} variant="panel" />;
              })()}
              {showRequiresRelinkBanner(selectedSession) && canWrite ? (
                <div className="session-health-alert" style={{ marginBottom: '1rem' }}>
                  <AlertTriangle size={16} aria-hidden />
                  <span>{t(sessionRequiresRelinkMessageKey(selectedSession))}</span>
                  <button
                    type="button"
                    className="btn-sm"
                    style={{ marginLeft: 'auto' }}
                    onClick={() => void handleRelink(selectedSession)}
                  >
                    <QrCode size={14} />
                    {t('sessions.engine.scanQr')}
                  </button>
                </div>
              ) : null}
              {(() => {
                const healthEntry = healthBySessionId.get(selectedSession.id);
                if (!healthEntry) return null;
                const issue = detectSessionHealthIssue(healthEntry);
                return (
                  <div className="session-health-detail">
                    <h4>{t('sessions.health.engineTitle')}</h4>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">{t('sessions.health.liveStatus')}</span>
                        <span className="detail-value">{formatStatus(healthEntry.liveStatus)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">{t('sessions.health.engine')}</span>
                        <span className="detail-value">
                          {healthEntry.enginePresent
                            ? t('sessions.health.engineRunning')
                            : t('sessions.health.engineStopped')}
                        </span>
                      </div>
                      {healthEntry.pendingReconnect ? (
                        <div className="detail-item">
                          <span className="detail-label">{t('sessions.health.reconnect')}</span>
                          <span className="detail-value">{t('sessions.health.reconnectPending')}</span>
                        </div>
                      ) : null}
                    </div>
                    {issue ? (
                      <p className="session-health-detail__issue">{t(`sessions.health.issues.${issue}`)}</p>
                    ) : (
                      <p className="session-health-detail__ok">{t('sessions.health.healthy')}</p>
                    )}
                  </div>
                );
              })()}
              {canWrite && (
                <div className="session-ai-auto-reply-toggle">
                  <label className="session-ai-auto-reply-toggle__label">
                    <input
                      type="checkbox"
                      checked={selectedSession.aiAutoReplyEnabled !== false}
                      disabled={savingAiAutoReply}
                      onChange={(e) => void handleAiAutoReplyToggle(selectedSession, e.target.checked)}
                    />
                    <span>{t('sessions.details.aiAutoReply')}</span>
                  </label>
                  <p className="text-muted">{t('sessions.details.aiAutoReplyHint')}</p>
                </div>
              )}
              {canWrite && (
                <div className="session-ai-auto-reply-toggle">
                  <label className="session-ai-auto-reply-toggle__label">
                    <input
                      type="checkbox"
                      checked={selectedSession.followupAutopilotEnabled === true}
                      disabled={savingFollowupAutopilot}
                      onChange={e => void handleFollowupAutopilotToggle(selectedSession, e.target.checked)}
                    />
                    <span>{t('sessions.details.followupAutopilot')}</span>
                  </label>
                  <p className="text-muted">{t('sessions.details.followupAutopilotHint')}</p>
                </div>
              )}
              {canWrite && (
                <div className="session-staff-ai-block">
                  <h4>{t('sessions.details.proxyTitle')}</h4>
                  <p className="text-muted">{t('sessions.details.proxyHint')}</p>
                  <input
                    type="text"
                    className="session-staff-ai-textarea"
                    style={{ minHeight: 'unset' }}
                    value={proxyUrlText}
                    onChange={e => setProxyUrlText(e.target.value)}
                    placeholder={t('sessions.create.proxyUrlPlaceholder')}
                  />
                  {proxyUrlText.trim() ? (
                    <select
                      value={proxyType}
                      onChange={e =>
                        setProxyType(e.target.value as 'http' | 'https' | 'socks4' | 'socks5')
                      }
                      style={{ marginTop: '0.5rem', width: '100%' }}
                    >
                      <option value="socks5">SOCKS5 (recommended)</option>
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="socks4">SOCKS4</option>
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={savingProxy}
                    onClick={() => void handleSaveProxy()}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {savingProxy ? <Loader2 className="animate-spin" size={16} /> : null}
                    {t('common.save')}
                  </button>
                </div>
              )}
              {canWrite && (
                <div className="session-staff-ai-block">
                  <h4>{t('sessions.details.staffAiTitle')}</h4>
                  <p className="text-muted">{t('sessions.details.staffAiHint')}</p>
                  <textarea
                    className="session-staff-ai-textarea"
                    rows={4}
                    value={staffAiNumbersText}
                    onChange={e => setStaffAiNumbersText(e.target.value)}
                    placeholder={t('sessions.details.staffAiPlaceholder')}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={savingStaffAi}
                    onClick={() => void handleSaveStaffAiNumbers()}
                  >
                    {savingStaffAi ? <Loader2 className="animate-spin" size={16} /> : null}
                    {t('common.save')}
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {canWrite && selectedSession && canForceRelinkSession(selectedSession) ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={relinkingId === selectedSession.id}
                  onClick={() => setForceRelinkConfirmId(selectedSession.id)}
                >
                  {relinkingId === selectedSession.id ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <QrCode size={16} />
                  )}
                  {t('sessions.engine.forceRelink')}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => setSelectedSession(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {forceRelinkConfirmId && (
        <ModalOverlay onClose={() => setForceRelinkConfirmId(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.engine.forceRelinkConfirmTitle')}</h2>
              <button type="button" className="btn-icon" onClick={() => setForceRelinkConfirmId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <Trans
                  i18nKey="sessions.engine.forceRelinkConfirmMessage"
                  values={{ name: sessions.find(s => s.id === forceRelinkConfirmId)?.name }}
                  components={[<strong key="relink-name" />]}
                />
              </p>
              <p className="text-muted">{t('sessions.engine.forceRelinkHint')}</p>
              <p className="text-muted">{t('whatsappLinkSafety.forceRelinkSafetyHint')}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setForceRelinkConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={handleForceRelinkConfirm}>
                <QrCode size={16} />
                {t('sessions.engine.forceRelink')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {deleteConfirmId && (
        <ModalOverlay onClose={() => setDeleteConfirmId(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.delete.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setDeleteConfirmId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <Trans
                  i18nKey="sessions.delete.message"
                  values={{ name: sessions.find(s => s.id === deleteConfirmId)?.name }}
                  components={[<strong key="delete-name" />]}
                />
              </p>
              <p className="text-muted">{t('sessions.delete.warning')}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {useWorkspaceEmbed && !(splitDetailPane && useWorkspaceEmbed) ? (
        <SessionsStatusPills
          sessions={sessions}
          healthOverview={healthOverview}
          linkSafetySessions={linkSafetySummary?.sessions}
        />
      ) : !useWorkspaceEmbed && canWrite ? (
        <WhatsAppLinkSafetyBanner sessions={sessions} />
      ) : null}

      {useWorkspaceEmbed && !splitDetailPane ? (
        <div className="channels-embed-grid">
          {filteredSessions.map(session => {
            const healthIssueMessage =
              session.status !== 'failed' && !session.requiresRelink
                ? getHealthIssueMessage(session.id)
                : null;
            const linkSafetyRow = linkSafetyBySessionId.get(session.id);
            return (
              <ChannelSessionCard
                key={session.id}
                session={session}
                focused={focusSessionId === session.id}
                canWrite={canWrite}
                healthIssueMessage={healthIssueMessage}
                linkSafetyRow={linkSafetyRow}
                unreadCount={unreadMap[session.id] ?? 0}
                failedCount={failedBySession[session.id] ?? 0}
                isRelinking={relinkingId === session.id}
                starting={starting}
                formatLastActive={formatLastActive}
                onSelect={() => setSelectedSession(session)}
                onScanQr={() => handleShowQR(session.id)}
              />
            );
          })}
          {listExtras}
        </div>
      ) : !useWorkspaceEmbed ? (
      <div className="sessions-grid">
        {filteredSessions.length === 0 && !listExtras ? (
            <div className="empty-state">
              <QrCode size={48} />
              <h3>{t('sessions.empty.title')}</h3>
              <p>{t('sessions.empty.description')}</p>
            </div>
        ) : (
          <>
            {filteredSessions.map(session => {
            const healthIssueMessage =
              session.status !== 'failed' && !session.requiresRelink
                ? getHealthIssueMessage(session.id)
                : null;
            const isRelinking = relinkingId === session.id;
            const linkSafetyRow = linkSafetyBySessionId.get(session.id);
            const primaryAlert = healthIssueMessage
              ? { tone: 'warn' as const, message: healthIssueMessage }
              : session.requiresRelink
                ? { tone: 'critical' as const, messageKey: sessionRequiresRelinkMessageKey(session) }
                : session.status === 'failed'
                  ? { tone: 'critical' as const, messageKey: 'sessions.health.relinkRequired' }
                  : null;
            const showLinkSafetyChip =
              !useWorkspaceEmbed &&
              sessionNeedsLink(session) &&
              linkSafetyRow &&
              !linkSafetyRow.ready;
            return (
            <div
              key={session.id}
              id={`session-card-${session.id}`}
              className={`session-card${focusSessionId === session.id ? ' session-card--focused' : ''}${useWorkspaceEmbed ? ' session-card--clean' : ''}`}
            >
              <div
                className="card-header"
                onClick={() => onSessionSelect?.(session.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') onSessionSelect?.(session.id);
                }}
                role={onSessionSelect ? 'button' : undefined}
                tabIndex={onSessionSelect ? 0 : undefined}
                style={onSessionSelect ? { cursor: 'pointer' } : undefined}
              >
                <h3 title={session.name}>{session.name}</h3>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                {session.backgroundSyncing ? (
                  <span className="status-pill status-pill--syncing">{t('sessions.backgroundSyncing')}</span>
                ) : null}
              </div>

              {primaryAlert ? (
                <div
                  className={`session-health-alert${
                    primaryAlert.tone === 'critical' ? ' session-health-alert--critical' : ''
                  }${useWorkspaceEmbed ? ' session-health-alert--compact' : ''}`}
                >
                  <AlertTriangle size={16} aria-hidden />
                  <span>
                    {primaryAlert.messageKey
                      ? t(primaryAlert.messageKey)
                      : primaryAlert.message}
                  </span>
                  {canWrite && primaryAlert.tone === 'critical' && showRequiresRelinkBanner(session) ? (
                    <button
                      type="button"
                      className="btn-sm"
                      style={{ marginLeft: 'auto' }}
                      disabled={isRelinking || starting}
                      onClick={e => {
                        e.stopPropagation();
                        void handleRelink(session);
                      }}
                    >
                      {isRelinking ? <Loader2 className="animate-spin" size={14} /> : <QrCode size={14} />}
                      {isRelinking ? t('sessions.actions.starting') : t('sessions.engine.scanQr')}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {showLinkSafetyChip ? (
                <WhatsAppLinkSafetySessionChip row={linkSafetyRow} />
              ) : null}

              {isSessionConnecting(session.status) ? (
                <div className="qr-placeholder">
                  {session.status === 'qr_ready' ? (
                    <QrCode size={64} className="qr-icon" />
                  ) : (
                    <Loader2 size={64} className="qr-icon animate-spin" />
                  )}
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() => handleShowQR(session.id)}
                    disabled={
                      session.status !== 'qr_ready' &&
                      session.status !== 'authenticating' &&
                      session.status !== 'loading_chats'
                    }
                  >
                    {session.status === 'qr_ready'
                      ? t('sessions.qr.showQr')
                      : t('sessions.qr.loading')}
                  </button>
                </div>
              ) : (
                <div className="session-info">
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.phone')}</span>
                    <span className="info-value">{session.phone || '—'}</span>
                  </div>
                  {!useWorkspaceEmbed ? (
                    <div className="info-row">
                      <span className="info-label">{t('sessions.card.sessionId')}</span>
                      <span className="info-value mono">{session.id.substring(0, 12)}</span>
                    </div>
                  ) : null}
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.lastActive')}</span>
                    <span className="info-value">{formatLastActive(session.lastActive)}</span>
                  </div>
                  {!useWorkspaceEmbed && canWrite ? (
                    <>
                      <label className="session-card-ai-toggle">
                        <Bot size={14} aria-hidden />
                        <span>{t('sessions.card.followupAutopilot')}</span>
                        <input
                          type="checkbox"
                          checked={session.followupAutopilotEnabled === true}
                          disabled={savingFollowupAutopilot}
                          onChange={e => {
                            e.stopPropagation();
                            void handleFollowupAutopilotToggle(session, e.target.checked);
                          }}
                        />
                      </label>
                      <label className="session-card-ai-toggle">
                        <Bot size={14} aria-hidden />
                        <span>{t('sessions.card.aiAutoReply')}</span>
                        <input
                          type="checkbox"
                          checked={session.aiAutoReplyEnabled !== false}
                          disabled={savingAiAutoReply}
                          onChange={(e) => {
                            e.stopPropagation();
                            void handleAiAutoReplyToggle(session, e.target.checked);
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              )}

              <div className="card-actions">
                <button type="button" className="btn-action" onClick={() => setSelectedSession(session)}>
                  <Eye size={16} />
                  {t('sessions.actions.view')}
                </button>
                {canWrite && session.requiresRelink && canCallSessionStart(session.status) ? (
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => void handleRelink(session)}
                    disabled={isRelinking || starting}
                  >
                    {isRelinking || starting ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <QrCode size={16} />
                    )}
                    {isRelinking || starting
                      ? t('sessions.actions.starting', { defaultValue: 'Starting…' })
                      : t('sessions.engine.scanQr')}
                  </button>
                ) : canWrite && canCallSessionStart(session.status) ? (
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => handleStart(session.id)}
                    disabled={starting}
                  >
                    {starting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                    {starting ? t('sessions.actions.starting', { defaultValue: 'Starting…' }) : t('sessions.actions.start')}
                  </button>
                ) : canWrite && isSessionRunning(session.status) ? (
                  <>
                    <button
                      type="button"
                      className="btn-action"
                      onClick={() => handleRestart(session.id)}
                      title={t('sessions.actions.restartHint')}
                    >
                      <RefreshCw size={16} />
                      {t('sessions.actions.restart')}
                    </button>
                    <button type="button" className="btn-action" onClick={() => handleStop(session.id)}>
                      <Square size={16} />
                      {t('sessions.actions.stop')}
                    </button>
                  </>
                ) : canWrite && canRestartSession(session) ? (
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => handleRestart(session.id)}
                    title={
                      session.status === 'failed'
                        ? t('sessions.actions.restartRelinkHint')
                        : t('sessions.actions.restartHint')
                    }
                  >
                    <RefreshCw size={16} />
                    {t('sessions.actions.restart')}
                  </button>
                ) : null}
                {canWrite && canForceRelinkSession(session) && !session.requiresRelink ? (
                  <button
                    type="button"
                    className="btn-action"
                    title={t('sessions.engine.forceRelinkHint')}
                    disabled={isRelinking || starting}
                    onClick={() => setForceRelinkConfirmId(session.id)}
                  >
                    {isRelinking ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
                    {t('sessions.engine.forceRelink')}
                  </button>
                ) : null}
                {canWrite && (
                  <button type="button" className="btn-action danger" onClick={() => setDeleteConfirmId(session.id)}>
                    <Trash2 size={16} />
                    {t('sessions.actions.delete')}
                  </button>
                )}
              </div>
            </div>
            );
          })}
            {listExtras}
          </>
        )}
      </div>
      ) : null}
    </div>
  );
}
