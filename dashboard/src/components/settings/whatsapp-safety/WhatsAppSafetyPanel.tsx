import { useEffect, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  whatsAppSafetyApi,
  type WhatsAppSafetyAuditRow,
  type WhatsAppSafetyConsentRow,
  type WhatsAppSafetyQueueRow,
  type WhatsAppSafetyWarmupRow,
  type WhatsAppSessionHealthEvent,
  type WhatsAppSessionHealthDetail,
  type WhatsAppCheckSendResult,
} from '../../../services/api';
import { useSessionsQuery, useUnifiedInboxConversationsQuery } from '../../../hooks/queries';
import { SettingsIntegrationShell } from '../SettingsIntegrationShell';
import {
  WHATSAPP_SAFETY_TABS,
  isLegacyWhatsAppSafetyTab,
  resolveWhatsAppSafetyTab,
  type WhatsAppSafetyTabId,
} from './whatsapp-safety-tab-ids';
import { WhatsAppSafetyOverviewTab } from './WhatsAppSafetyOverviewTab';
import { WhatsAppSafetyRulesTab } from './WhatsAppSafetyRulesTab';
import { WhatsAppSafetyQueueTab } from './WhatsAppSafetyQueueTab';
import { WhatsAppSafetyConsentTab } from './WhatsAppSafetyConsentTab';
import { WhatsAppSafetyActivityTab } from './WhatsAppSafetyActivityTab';

interface Props {
  onBack: () => void;
}

export function WhatsAppSafetyPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('waTab');
  const resolvedTab = resolveWhatsAppSafetyTab(urlTab);
  const [tab, setTab] = useState<WhatsAppSafetyTabId>(resolvedTab);

  useEffect(() => {
    if (isLegacyWhatsAppSafetyTab(urlTab)) {
      const next = new URLSearchParams(searchParams);
      if (resolvedTab === 'overview') next.delete('waTab');
      else next.set('waTab', resolvedTab);
      setSearchParams(next, { replace: true });
    }
  }, [urlTab, resolvedTab, searchParams, setSearchParams]);

  useEffect(() => {
    setTab(resolveWhatsAppSafetyTab(urlTab));
  }, [urlTab]);

  const selectTab = (id: WhatsAppSafetyTabId) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('waTab');
    else next.set('waTab', id);
    setSearchParams(next, { replace: true });
  };

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [checkSessionId, setCheckSessionId] = useState('');
  const [checkChatId, setCheckChatId] = useState('');
  const [checkBody, setCheckBody] = useState('');
  const [checkResult, setCheckResult] = useState<WhatsAppCheckSendResult | null>(null);
  const [restoreGrantMarketing, setRestoreGrantMarketing] = useState(false);
  const [linkCheckSessionId, setLinkCheckSessionId] = useState('');

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['whatsapp-safety', 'settings'],
    queryFn: () => whatsAppSafetyApi.getSettings(),
  });

  const { data: overview } = useQuery({
    queryKey: ['whatsapp-safety', 'overview'],
    queryFn: () => whatsAppSafetyApi.getOverview(),
  });

  const { data: queue = [] } = useQuery<WhatsAppSafetyQueueRow[]>({
    queryKey: ['whatsapp-safety', 'queue'],
    queryFn: () => whatsAppSafetyApi.listQueue(),
    enabled: tab === 'queue' || tab === 'overview',
  });

  const { data: warmups = [] } = useQuery<WhatsAppSafetyWarmupRow[]>({
    queryKey: ['whatsapp-safety', 'warmup'],
    queryFn: () => whatsAppSafetyApi.listWarmup(),
    enabled: tab === 'queue' || tab === 'overview',
  });

  const { data: queueStats = {} } = useQuery<Record<string, number>>({
    queryKey: ['whatsapp-safety', 'queue-stats'],
    queryFn: () => whatsAppSafetyApi.getQueueStats(),
    enabled: tab === 'queue' || tab === 'overview',
  });

  const { data: auditLogs = [] } = useQuery<WhatsAppSafetyAuditRow[]>({
    queryKey: ['whatsapp-safety', 'audit'],
    queryFn: () => whatsAppSafetyApi.listAuditLogs(),
    enabled: tab === 'activity',
  });

  const { data: blockedSends = [] } = useQuery<WhatsAppSafetyAuditRow[]>({
    queryKey: ['whatsapp-safety', 'blocked'],
    queryFn: () => whatsAppSafetyApi.listBlockedSends(),
    enabled: tab === 'overview' || tab === 'activity',
  });

  const { data: optedOut = [] } = useQuery<WhatsAppSafetyConsentRow[]>({
    queryKey: ['whatsapp-safety', 'consent'],
    queryFn: () => whatsAppSafetyApi.listConsent(),
    enabled: tab === 'consent' || tab === 'overview',
  });

  const { data: marketingGaps = [] } = useQuery<WhatsAppSafetyConsentRow[]>({
    queryKey: ['whatsapp-safety', 'marketing-gaps'],
    queryFn: () => whatsAppSafetyApi.listMarketingGaps(),
    enabled: tab === 'consent',
  });

  const { data: sessions = [] } = useSessionsQuery();
  const hasConnectedSession = sessions.some(s => s.status === 'ready');

  const { data: inboxForQueue } = useUnifiedInboxConversationsQuery(
    { limit: 300, offset: 0 },
    { enabled: tab === 'queue', staleTime: 30_000 },
  );
  const queueConversations = inboxForQueue?.conversations ?? [];

  const { data: linkPreflight, isFetching: linkPreflightFetching } = useQuery({
    queryKey: ['whatsapp-safety', 'link-preflight', linkCheckSessionId || 'global'],
    queryFn: () => whatsAppSafetyApi.getLinkPreflight(linkCheckSessionId || undefined),
    enabled: tab === 'overview',
    retry: false,
  });

  useEffect(() => {
    if (!linkCheckSessionId && sessions[0]?.id) {
      setLinkCheckSessionId(sessions[0].id);
    }
  }, [sessions, linkCheckSessionId]);

  const { data: healthEvents = [], isLoading: loadingHealthEvents } = useQuery<
    WhatsAppSessionHealthEvent[]
  >({
    queryKey: ['whatsapp-safety', 'health-events'],
    queryFn: () => whatsAppSafetyApi.listSessionHealth(),
    enabled: tab === 'activity',
  });

  const sessionHealthQueries = useQueries({
    queries: sessions.map(session => ({
      queryKey: ['whatsapp-safety', 'session-health', session.id],
      queryFn: () => whatsAppSafetyApi.getSessionHealth(session.id),
      enabled: tab === 'activity',
    })),
  }) as Array<{ data?: WhatsAppSessionHealthDetail }>;

  const sessionHealthById = new Map(
    sessions.map((session, index) => [session.id, sessionHealthQueries[index]?.data]),
  );

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });

  const approveQueue = useMutation({
    mutationFn: (id: string) => whatsAppSafetyApi.approveQueue(id, 'admin'),
    onSuccess: invalidate,
  });

  const cancelQueue = useMutation({
    mutationFn: (id: string) => whatsAppSafetyApi.cancelQueue(id),
    onSuccess: invalidate,
  });

  const retryQueue = useMutation({
    mutationFn: (id: string) => whatsAppSafetyApi.retryQueue(id),
    onSuccess: invalidate,
  });

  const pauseWarmup = useMutation({
    mutationFn: (sessionId: string) => whatsAppSafetyApi.pauseWarmup(sessionId),
    onSuccess: invalidate,
  });

  const resumeWarmup = useMutation({
    mutationFn: (sessionId: string) => whatsAppSafetyApi.resumeWarmup(sessionId),
    onSuccess: invalidate,
  });

  const pauseAutomation = useMutation({
    mutationFn: (sessionId: string) => whatsAppSafetyApi.pauseAutomation(sessionId),
    onSuccess: invalidate,
  });

  const resumeAutomation = useMutation({
    mutationFn: (sessionId: string) => whatsAppSafetyApi.resumeAutomation(sessionId),
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => whatsAppSafetyApi.patchSettings(patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });
      setDraft({});
    },
  });

  const restoreConsent = useMutation({
    mutationFn: (params: { id: string; canMarketing?: boolean }) =>
      whatsAppSafetyApi.restoreOptOut(params.id, {
        canMarketing: params.canMarketing,
        canFollowup: true,
      }),
    onSuccess: invalidate,
  });

  const patchConsent = useMutation({
    mutationFn: (params: {
      id: string;
      patch: { canMarketing?: boolean; canFollowup?: boolean; canUtility?: boolean };
    }) => whatsAppSafetyApi.patchConsent(params.id, params.patch),
    onSuccess: invalidate,
  });

  const checkSend = useMutation({
    mutationFn: () =>
      whatsAppSafetyApi.checkSend({
        sessionId: checkSessionId,
        chatId: checkChatId,
        body: checkBody,
        isManualStaffSend: true,
      }),
    onSuccess: setCheckResult,
  });

  const merged = { ...settings, ...draft };

  const toggle = (key: string) => {
    setDraft(prev => ({ ...prev, [key]: !(merged as Record<string, boolean>)[key] }));
  };

  const patchFields = (patch: Record<string, unknown>) => {
    setDraft(prev => ({ ...prev, ...patch }));
  };

  const save = () => saveMutation.mutate(draft);

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="integrations"
      onBack={onBack}
      title={t('whatsappSafety.title')}
      askAiPanelId="whatsapp-safety"
      onSave={Object.keys(draft).length > 0 ? save : undefined}
      isSaving={saveMutation.isPending}
      isDirty={Object.keys(draft).length > 0}
    >
      <div className="interakt-panel wa-safety-panel">
        <div className="settings-tabs wa-safety-tabs" role="tablist">
          {WHATSAPP_SAFETY_TABS.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'settings-tab settings-tab--active' : 'settings-tab'}
              onClick={() => selectTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        {loadingSettings && (
          <div className="settings-integration-loading">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}

        {!loadingSettings && tab === 'overview' && overview && (
          <WhatsAppSafetyOverviewTab
            overview={overview}
            blockedSends={blockedSends}
            sessions={sessions}
            linkCheckSessionId={linkCheckSessionId}
            onLinkCheckSessionChange={setLinkCheckSessionId}
            linkPreflight={linkPreflight}
            linkPreflightFetching={linkPreflightFetching}
            hasConnectedSession={hasConnectedSession}
            onSelectTab={selectTab}
          />
        )}

        {!loadingSettings && tab === 'rules' && settings && (
          <WhatsAppSafetyRulesTab
            merged={merged}
            toggle={toggle}
            patchFields={patchFields}
            sessions={sessions}
            checkSessionId={checkSessionId}
            onCheckSessionIdChange={setCheckSessionId}
            checkChatId={checkChatId}
            onCheckChatIdChange={setCheckChatId}
            checkBody={checkBody}
            onCheckBodyChange={setCheckBody}
            checkResult={checkResult}
            checkSend={checkSend}
          />
        )}

        {tab === 'queue' && (
          <WhatsAppSafetyQueueTab
            queue={queue}
            queueStats={queueStats}
            warmups={warmups}
            sessions={sessions}
            conversations={queueConversations}
            approveQueue={approveQueue}
            cancelQueue={cancelQueue}
            retryQueue={retryQueue}
            pauseWarmup={pauseWarmup}
            resumeWarmup={resumeWarmup}
          />
        )}

        {tab === 'consent' && (
          <WhatsAppSafetyConsentTab
            optedOut={optedOut}
            marketingGaps={marketingGaps}
            restoreGrantMarketing={restoreGrantMarketing}
            onRestoreGrantMarketingChange={setRestoreGrantMarketing}
            restoreConsent={restoreConsent}
            patchConsent={patchConsent}
          />
        )}

        {tab === 'activity' && (
          <WhatsAppSafetyActivityTab
            blockedSends={blockedSends}
            auditLogs={auditLogs}
            sessions={sessions}
            sessionHealthById={sessionHealthById}
            healthEvents={healthEvents}
            loadingHealthEvents={loadingHealthEvents}
            pauseAutomation={pauseAutomation}
            resumeAutomation={resumeAutomation}
          />
        )}
      </div>
    </SettingsIntegrationShell>
  );
}

export type { WhatsAppSafetyTabId } from './whatsapp-safety-tab-ids';
