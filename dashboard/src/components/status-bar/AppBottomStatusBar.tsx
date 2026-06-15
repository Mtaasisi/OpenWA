import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAppStatus } from '../../hooks/useAppStatus';
import { StatusBarChip } from './StatusBarChip';
import { StatusDetailsPopover } from './StatusDetailsPopover';
import {
  StatusPopoverActions,
  StatusPopoverEmpty,
  StatusPopoverMetric,
  StatusPopoverMetrics,
  StatusPopoverPrimaryAction,
  StatusPopoverSecondaryAction,
  StatusPopoverSession,
  StatusPopoverSessions,
  StatusPopoverWarning,
  StatusPopoverWarnings,
} from './status-popover-primitives';
import { useRole } from '../../hooks/useRole';
import { whatsAppSafetyApi, aiTrainingApi } from '../../services/api';
import { channelsUrl } from '../../lib/channel-routes';
import { settingsPanelHref, settingsCategoryHref } from '../settings/settings-nav-registry';
import type { AppStatusLevel } from '../../types/appStatusTypes';
import './AppBottomStatusBar.css';

function StatusBarDivider() {
  return <span className="app-bottom-status-bar__sep" aria-hidden>·</span>;
}

type PopoverKind =
  | 'work'
  | 'ai'
  | 'autoReply'
  | 'whatsapp'
  | 'queue'
  | 'system'
  | 'branch'
  | 'user'
  | 'warning'
  | null;

function formatRelativeTime(iso: string | null, t: (k: string) => string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return t('shell.statusBar.justNow');
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(iso).toLocaleDateString();
}

export function AppBottomStatusBar() {
  const { t } = useTranslation();
  const { role } = useRole();
  const { data, isInitialLoading, prefs, lastUpdated } = useAppStatus();
  const { data: trainingOverview } = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: () => aiTrainingApi.getOverview(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement>(null);

  const openPopover = (kind: PopoverKind, el: HTMLElement) => {
    setAnchorEl(el);
    setPopover(prev => (prev === kind ? null : kind));
  };

  const closePopover = () => setPopover(null);

  const autoReplyLabel = useMemo(() => {
    if (!data?.ai) return t('shell.statusBar.autoReplyOff');
    if (data.ai.autoReply === 'on') return t('shell.statusBar.autoReplyOn');
    if (data.ai.autoReply === 'paused') return t('shell.statusBar.autoReplyPaused');
    return t('shell.statusBar.autoReplyOff');
  }, [data, t]);

  const loadingStatus = isInitialLoading ? 'loading' : 'neutral';

  const aiPill = useMemo((): { label: string; status: AppStatusLevel } => {
    if (!data?.ai) {
      return { label: t('shell.statusBar.aiSafe'), status: loadingStatus };
    }
    if (data.ai.autoReply === 'paused') {
      return { label: t('shell.statusBar.aiPaused'), status: 'warning' };
    }
    if (data.ai.autoReply === 'off') {
      return { label: t('shell.statusBar.autoReplyOff'), status: 'neutral' };
    }
    if (data.ai.status === 'error') {
      return { label: data.ai.label, status: 'error' };
    }
    if (data.ai.status === 'warning') {
      return { label: data.ai.label, status: 'warning' };
    }
    return { label: data.ai.label || t('shell.statusBar.aiSafe'), status: 'success' };
  }, [data, loadingStatus, t]);

  if (!prefs.showStatusBar) return null;

  const popoverTitle = (kind: PopoverKind): string => {
    switch (kind) {
      case 'work':
        return t('shell.statusBar.details.work');
      case 'ai':
        return t('shell.statusBar.details.ai');
      case 'autoReply':
        return t('shell.statusBar.details.autoReply');
      case 'whatsapp':
        return t('shell.statusBar.details.whatsapp');
      case 'queue':
        return t('shell.statusBar.details.queue');
      case 'system':
        return t('shell.statusBar.details.system');
      case 'branch':
        return t('shell.statusBar.details.branch');
      case 'user':
        return t('shell.statusBar.details.user');
      case 'warning':
        return t('shell.statusBar.details.warnings');
      default:
        return '';
    }
  };

  const popoverIcon = (kind: PopoverKind): string | undefined => {
    switch (kind) {
      case 'work':
        return 'checklist';
      case 'ai':
      case 'autoReply':
        return 'bolt';
      case 'whatsapp':
        return 'chat';
      case 'queue':
        return 'outbox';
      case 'system':
        return 'speed';
      case 'branch':
        return 'store';
      case 'user':
        return 'person';
      case 'warning':
        return 'warning';
      default:
        return undefined;
    }
  };

  const refreshInfoRight = (
    <span>{t('shell.statusBar.lastRefresh')}: {formatRelativeTime(lastUpdated, t)}</span>
  );

  const renderPopoverBody = () => {
    if (!data || !popover) return null;

    switch (popover) {
      case 'work':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric
              label={t('shell.statusBar.pending')}
              value={data.workSummary.pending}
              tone="primary"
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.efficiency')}
              value={`${data.workSummary.efficiency}%`}
              tone="primary"
              last
            />
          </StatusPopoverMetrics>
        );
      case 'ai':
        return (
          <>
            <StatusPopoverMetrics>
              <StatusPopoverMetric label={t('shell.statusBar.provider')} value={data.ai.provider} icon="hub" />
              <StatusPopoverMetric
                label={t('shell.statusBar.model')}
                value={data.ai.model || '—'}
                icon="model_training"
              />
              <StatusPopoverMetric
                label={t('shell.statusBar.knowledge')}
                value={data.ai.knowledgeIndexed ? t('shell.statusBar.indexed') : t('shell.statusBar.notIndexed')}
                icon={data.ai.knowledgeIndexed ? 'library_books' : 'library_add'}
                tone={data.ai.knowledgeIndexed ? 'primary' : 'muted'}
              />
              <StatusPopoverMetric
                label={t('shell.statusBar.pendingLearning')}
                value={data.ai.pendingLearning}
                icon="school"
                tone={data.ai.pendingLearning > 0 ? 'primary' : 'muted'}
              />
              <StatusPopoverMetric
                label={t('shell.statusBar.autoReply')}
                value={autoReplyLabel}
                icon={data.ai.autoReply === 'on' ? 'smart_toy' : 'pause_circle'}
                tone={data.ai.autoReply === 'on' ? 'primary' : 'muted'}
                last
              />
            </StatusPopoverMetrics>
          </>
        );
      case 'autoReply':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric
              label={t('shell.statusBar.autoReply')}
              value={autoReplyLabel}
              icon={data.ai.autoReply === 'on' ? 'smart_toy' : 'pause_circle'}
              tone={data.ai.autoReply === 'on' ? 'primary' : 'muted'}
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.aiStatus')}
              value={data.ai.label}
              icon="bolt"
              tone={data.ai.status === 'error' ? 'error' : data.ai.status === 'warning' ? 'muted' : 'primary'}
              last
            />
          </StatusPopoverMetrics>
        );
      case 'whatsapp': {
        const connected = data.whatsapp.sessions.filter(s => s.connected).length;
        const qrCount = data.whatsapp.sessions.filter(s => s.qrNeeded).length;
        const disconnected = data.whatsapp.sessions.length - connected - qrCount;
        return (
          <>
            <StatusPopoverMetrics>
              <StatusPopoverMetric
                label={t('shell.statusBar.connectedSessions')}
                value={connected}
                tone="primary"
              />
              <StatusPopoverMetric
                label={t('shell.statusBar.sessionQr')}
                value={qrCount}
                tone={qrCount > 0 ? 'error' : 'muted'}
              />
              <StatusPopoverMetric
                label={t('shell.statusBar.sessionDisconnected')}
                value={disconnected}
                tone="muted"
                last
              />
            </StatusPopoverMetrics>
            {data.whatsapp.sessions.length === 0 ? (
              <StatusPopoverEmpty>{t('shell.statusBar.noSessions')}</StatusPopoverEmpty>
            ) : (
              <StatusPopoverSessions>
                {data.whatsapp.sessions.map(s => {
                  const status = s.connected ? 'success' : s.qrNeeded ? 'error' : 'neutral';
                  const meta = s.connected
                    ? t('shell.statusBar.sessionConnected')
                    : s.qrNeeded
                      ? t('shell.statusBar.sessionQr')
                      : t('shell.statusBar.sessionDisconnected');
                  const time = s.lastActiveAt ? ` · ${formatRelativeTime(s.lastActiveAt, t)}` : '';
                  return (
                    <StatusPopoverSession
                      key={s.id}
                      name={s.name}
                      meta={`${meta}${time}`}
                      status={status}
                    />
                  );
                })}
              </StatusPopoverSessions>
            )}
          </>
        );
      }
      case 'queue':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric
              label={t('shell.statusBar.pending')}
              value={data.queue.pending}
              tone="primary"
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.delayed')}
              value={data.queue.delayed}
              tone="muted"
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.failed')}
              value={data.queue.failed}
              tone={data.queue.failed > 0 ? 'error' : 'muted'}
              last
            />
          </StatusPopoverMetrics>
        );
      case 'system':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric
              label={t('shell.statusBar.latency')}
              value={data.database.latencyMs != null ? `${data.database.latencyMs}ms` : '—'}
              tone={
                data.database.latencyMs == null
                  ? 'muted'
                  : data.database.latencyMs < 120
                    ? 'primary'
                    : data.database.latencyMs < 400
                      ? 'muted'
                      : 'error'
              }
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.databaseOnline')}
              value={data.database.label}
              tone={data.database.status === 'error' ? 'error' : data.database.status === 'warning' ? 'muted' : 'primary'}
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.synced')}
              value={data.sync.label}
              tone={data.sync.status === 'error' ? 'error' : data.sync.status === 'warning' ? 'muted' : 'primary'}
            />
            {(data.sync.unsynced > 0 || data.sync.failed > 0) ? (
              <>
                <StatusPopoverMetric
                  label={t('shell.statusBar.unsynced')}
                  value={data.sync.unsynced}
                  tone={data.sync.unsynced > 0 ? 'primary' : 'muted'}
                />
                <StatusPopoverMetric
                  label={t('shell.statusBar.failed')}
                  value={data.sync.failed}
                  tone={data.sync.failed > 0 ? 'error' : 'muted'}
                />
              </>
            ) : null}
            <StatusPopoverMetric
              label={t('shell.statusBar.lastSync')}
              value={formatRelativeTime(data.sync.lastSyncAt, t)}
              tone="muted"
            />
            {data.desktop && role === 'admin' && prefs.showAdvancedHealth ? (
              <>
                <StatusPopoverMetric
                  label={t('shell.statusBar.localBackend')}
                  value={
                    data.desktop.localBackendRunning
                      ? t('shell.statusBar.running')
                      : t('shell.statusBar.stopped')
                  }
                  tone={data.desktop.localBackendRunning ? 'primary' : 'error'}
                />
                <StatusPopoverMetric
                  label={t('shell.statusBar.desktopVersion')}
                  value={data.desktop.version}
                  tone="muted"
                />
              </>
            ) : null}
            {(trainingOverview?.pendingQuestions ?? 0) > 0 ? (
              <StatusPopoverMetric
                label={t('ai.training.statusPending', { defaultValue: 'AI Training pending' })}
                value={String(trainingOverview?.pendingQuestions ?? 0)}
                tone="primary"
              />
            ) : null}
            <StatusPopoverMetric
              label={t('shell.statusBar.updated')}
              value={formatRelativeTime(lastUpdated, t)}
              tone="muted"
              last
            />
          </StatusPopoverMetrics>
        );
      case 'branch':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric
              label={t('shell.statusBar.branch')}
              value={data.branch.name}
              icon="store"
              tone="primary"
            />
            <StatusPopoverMetric
              label={t('shell.statusBar.paymentProfile')}
              value={
                data.branch.paymentProfileConfigured
                  ? t('shell.statusBar.configured')
                  : t('shell.statusBar.missing')
              }
              icon={data.branch.paymentProfileConfigured ? 'payments' : 'payment'}
              tone={data.branch.paymentProfileConfigured ? 'primary' : 'error'}
              last
            />
          </StatusPopoverMetrics>
        );
      case 'user':
        return (
          <StatusPopoverMetrics>
            <StatusPopoverMetric label={t('shell.statusBar.name')} value={data.user.name} icon="person" tone="primary" />
            <StatusPopoverMetric label={t('shell.statusBar.role')} value={data.user.role} icon="badge" tone="primary" last />
          </StatusPopoverMetrics>
        );
      case 'warning':
        return data.warnings.length === 0 ? (
          <StatusPopoverEmpty>{t('shell.statusBar.noWarnings')}</StatusPopoverEmpty>
        ) : (
          <StatusPopoverWarnings>
            {data.warnings.map(w => (
              <StatusPopoverWarning
                key={w.id}
                title={w.title}
                message={w.message}
                level={w.level === 'error' ? 'error' : 'warning'}
                action={
                  w.action
                    ? { label: w.action.label, to: w.action.route, onClick: closePopover }
                    : undefined
                }
              />
            ))}
          </StatusPopoverWarnings>
        );
      default:
        return null;
    }
  };

  const renderPopoverActions = () => {
    if (!popover) return null;
    switch (popover) {
      case 'work':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openFollowups')}
              icon="event_upcoming"
              to="/followups"
              onClick={closePopover}
            />
          </StatusPopoverActions>
        );
      case 'whatsapp':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openChannels')}
              icon="chat"
              to={channelsUrl()}
              onClick={closePopover}
            />
            {qrNeeded ? (
              <StatusPopoverSecondaryAction
                label={t('shell.statusBar.scanQr')}
                icon="qr_code_2"
                to={channelsUrl()}
                onClick={closePopover}
              />
            ) : null}
          </StatusPopoverActions>
        );
      case 'ai':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openAiSettings')}
              icon="settings"
              to={settingsPanelHref('ai')}
              onClick={closePopover}
            />
            {role === 'admin' ? (
              <StatusPopoverSecondaryAction
                label={t('ai.training.openCenter', { defaultValue: 'Training center' })}
                icon="school"
                to="/ai-training-center/dashboard"
                onClick={closePopover}
              />
            ) : null}
          </StatusPopoverActions>
        );
      case 'queue':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openQueue')}
              icon="send"
              to="/automations"
              onClick={closePopover}
            />
          </StatusPopoverActions>
        );
      case 'system': {
        const syncIssues = (data?.sync.failed ?? 0) > 0 || (data?.sync.unsynced ?? 0) > 0;
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openSystemSettings')}
              icon="dns"
              to={settingsPanelHref('infrastructure')}
              onClick={closePopover}
            />
            {syncIssues ? (
              <StatusPopoverSecondaryAction
                label={t('shell.statusBar.retrySync')}
                icon="sync"
                onClick={() => {
                  void whatsAppSafetyApi.getDashboardAlerts().then(() => closePopover());
                }}
              />
            ) : null}
          </StatusPopoverActions>
        );
      }
      case 'branch':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openBranchSettings')}
              icon="store"
              to={settingsPanelHref('ai-branch-profile')}
              onClick={closePopover}
            />
          </StatusPopoverActions>
        );
      case 'warning': {
        const action = data?.warnings.find(w => w.action)?.action;
        if (!action) return null;
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={action.label}
              icon="arrow_forward"
              to={action.route}
              onClick={closePopover}
            />
          </StatusPopoverActions>
        );
      }
      case 'user':
        return (
          <StatusPopoverActions>
            <StatusPopoverPrimaryAction
              label={t('shell.statusBar.openAccount')}
              icon="person"
              to={settingsCategoryHref('profile')}
              onClick={closePopover}
            />
          </StatusPopoverActions>
        );
      default:
        return null;
    }
  };

  const pillClick = (kind: PopoverKind) => (e: React.MouseEvent<HTMLElement>) => {
    openPopover(kind, e.currentTarget);
  };

  const latencyMs = data?.database.latencyMs;
  const qrNeeded =
    (data?.whatsapp.qrNeeded ?? 0) > 0 ||
    Boolean(data?.whatsapp.sessions?.some(s => s.qrNeeded));
  const databasePillStatus = data?.database.status ?? loadingStatus;
  const syncPillStatus = data?.sync.status ?? loadingStatus;
  const whatsappPillStatus = qrNeeded ? 'error' : (data?.whatsapp.status ?? loadingStatus);
  const whatsappPillLabel = qrNeeded
    ? t('shell.statusBar.qrNeeded')
    : (data?.whatsapp.label ?? t('shell.statusBar.whatsappConnected'));

  const queuePending = data?.queue.pending ?? 0;
  const queueFailed = data?.queue.failed ?? 0;
  const queuePillStatus = data?.queue.status ?? loadingStatus;
  const showQueueChip = queueFailed > 0 || queuePending > 0 || queuePillStatus === 'error';
  const queuePillLabel =
    queueFailed > 0
      ? t('shell.statusBar.queueFailed', { count: queueFailed })
      : t('shell.statusBar.queuePending', { count: queuePending });

  const warningCount = data?.warnings.length ?? 0;
  const warningPillStatus: AppStatusLevel =
    warningCount === 0
      ? 'neutral'
      : data?.warnings.some(w => w.level === 'error')
        ? 'error'
        : 'warning';

  const systemStatus: AppStatusLevel = (() => {
    if (isInitialLoading) return 'loading';
    if (databasePillStatus === 'error' || syncPillStatus === 'error') return 'error';
    if (databasePillStatus === 'warning' || syncPillStatus === 'warning') return 'warning';
    if (latencyMs != null && latencyMs >= 400) return 'warning';
    return 'success';
  })();

  const systemLabel =
    latencyMs != null ? t('shell.statusBar.latencyValue', { ms: latencyMs }) : t('shell.statusBar.latency');

  const chipActive = (id: string): boolean => {
    if (!popover) return false;
    if (id === 'ai' && (popover === 'ai' || popover === 'autoReply')) return true;
    if (id === 'warnings' && popover === 'warning') return true;
    return popover === id;
  };

  const workPendingLabel = data
    ? t('shell.statusBar.workSummaryPending', { count: data.workSummary.pending })
    : '…';
  const workEfficiencyLabel = data
    ? t('shell.statusBar.workSummaryEfficiency', { percent: data.workSummary.efficiency })
    : '…';

  const tooltips = useMemo(() => {
    const tt = (key: string, params?: Record<string, unknown>): string =>
      String(t(`shell.statusBar.tooltips.${key}`, params as never));

    const workTip = data
      ? tt('work', {
          pending: data.workSummary.pending,
          efficiency: data.workSummary.efficiency,
        })
      : tt('latencyLoading');

    let whatsappTip = tt('whatsappNone');
    if (data?.whatsapp.sessions.length) {
      if (qrNeeded) whatsappTip = tt('whatsappQr');
      else if (data.whatsapp.status === 'success') {
        const count = data.whatsapp.activeSessions;
        whatsappTip =
          count === 1 ? tt('whatsappOk', { count }) : tt('whatsappOkPlural', { count });
      } else if (data.whatsapp.status === 'warning') whatsappTip = tt('whatsappIssues');
      else whatsappTip = tt('whatsappOff');
    }

    let aiTip = tt('aiOff');
    if (data?.ai) {
      if (data.ai.status === 'error' || data.ai.status === 'warning') {
        aiTip = tt('aiWarn', { status: data.ai.label });
      } else if (data.ai.autoReply === 'on') aiTip = tt('aiOk');
      else if (data.ai.autoReply === 'paused') aiTip = tt('aiPaused');
    }

    let queueTip = tt('queueClear');
    if (queueFailed > 0) queueTip = tt('queueFailed', { count: queueFailed });
    else if (queuePending > 0) queueTip = tt('queuePending', { count: queuePending });

    let systemTip = latencyMs != null ? tt('latency', { ms: latencyMs }) : tt('latencyLoading');
    if (databasePillStatus !== 'success') {
      systemTip =
        databasePillStatus === 'warning' && latencyMs != null
          ? tt('databaseSlow', { ms: latencyMs })
          : tt('databaseOff');
    } else if (syncPillStatus === 'loading') {
      systemTip = tt('syncing');
    } else if ((data?.sync.failed ?? 0) > 0) {
      systemTip = tt('syncFailed', { count: data!.sync.failed });
    } else if ((data?.sync.unsynced ?? 0) > 0) {
      systemTip = tt('syncUnsynced', { count: data!.sync.unsynced });
    } else if (latencyMs != null) {
      systemTip = tt('systemOk', { ms: latencyMs });
    }

    return {
      work: workTip,
      whatsapp: whatsappTip,
      ai: aiTip,
      queue: queueTip,
      system: systemTip,
      alerts: warningCount > 0 ? tt('alerts', { count: warningCount }) : undefined,
      branch: data?.branch.name ? tt('branch', { name: data.branch.name }) : undefined,
      user:
        data?.user.name && data?.user.role
          ? tt('user', { name: data.user.name, role: data.user.role })
          : undefined,
    };
  }, [
    t,
    latencyMs,
    data,
    qrNeeded,
    queueFailed,
    queuePending,
    databasePillStatus,
    syncPillStatus,
    warningCount,
    isInitialLoading,
  ]);

  return (
    <>
      <footer
        ref={barRef}
        className={[
          'app-bottom-status-bar',
          isInitialLoading ? 'app-bottom-status-bar--loading' : '',
          popover ? 'app-bottom-status-bar--popover-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="status"
        aria-live={isInitialLoading ? 'polite' : 'off'}
        aria-busy={isInitialLoading}
      >
        <div className="app-bottom-status-bar__track">
          <div className="app-bottom-status-bar__primary">
            {prefs.showWorkSummary ? (
              <>
                <StatusBarChip
                  id="work"
                  label={`${workPendingLabel} · ${workEfficiencyLabel}`}
                  status="neutral"
                  tooltip={tooltips.work}
                  active={chipActive('work')}
                  onClick={pillClick('work')}
                />
                <StatusBarDivider />
              </>
            ) : null}

            <StatusBarChip
              id="whatsapp"
              label={whatsappPillLabel}
              status={whatsappPillStatus}
              tooltip={tooltips.whatsapp}
              active={chipActive('whatsapp')}
              onClick={pillClick('whatsapp')}
            />

            <StatusBarDivider />

            <StatusBarChip
              id="ai"
              label={aiPill.label}
              status={aiPill.status}
              tooltip={tooltips.ai}
              active={chipActive('ai')}
              onClick={pillClick('ai')}
            />

            {showQueueChip ? (
              <>
                <StatusBarDivider />
                <StatusBarChip
                  id="queue"
                  label={queuePillLabel}
                  status={queuePillStatus}
                  tooltip={tooltips.queue}
                  active={chipActive('queue')}
                  showDot
                  onClick={pillClick('queue')}
                />
              </>
            ) : null}

            {warningCount > 0 ? (
              <>
                <StatusBarDivider />
                <StatusBarChip
                  id="warnings"
                  label={t('shell.statusBar.alerts', { count: warningCount })}
                  status={warningPillStatus}
                  tooltip={tooltips.alerts}
                  active={chipActive('warnings')}
                  showDot
                  onClick={pillClick('warning')}
                />
              </>
            ) : null}
          </div>

          <div className="app-bottom-status-bar__secondary">
            <StatusBarChip
              id="system"
              label={systemLabel}
              status={systemStatus}
              tooltip={tooltips.system}
              active={chipActive('system')}
              onClick={pillClick('system')}
            />

            {prefs.showBranch ? (
              <>
                <StatusBarDivider />
                <StatusBarChip
                  id="branch"
                  label={data?.branch.name ?? '—'}
                  status="neutral"
                  tooltip={tooltips.branch}
                  active={chipActive('branch')}
                  onClick={pillClick('branch')}
                />
              </>
            ) : null}

            <StatusBarDivider />

            <button
              type="button"
              className={`app-bottom-status-bar__user${popover === 'user' ? ' app-bottom-status-bar__user--active' : ''}`}
              onClick={pillClick('user')}
              data-tip={tooltips.user}
            >
              <span className="app-bottom-status-bar__user-name">{data?.user.name ?? '—'}</span>
            </button>
          </div>
        </div>
      </footer>

      <StatusDetailsPopover
        open={popover !== null}
        title={popoverTitle(popover)}
        titleIcon={popoverIcon(popover)}
        onClose={closePopover}
        anchorEl={anchorEl}
        actions={renderPopoverActions()}
        infoRight={popover ? refreshInfoRight : undefined}
      >
        {renderPopoverBody()}
      </StatusDetailsPopover>
    </>
  );
}

export function AppStatusBarHiddenIndicator() {
  const { data, prefs } = useAppStatus();
  const { t } = useTranslation();
  if (prefs.showStatusBar) return null;

  const level = data?.overall ?? 'neutral';
  return (
    <button
      type="button"
      className={`app-status-hidden-indicator app-status-hidden-indicator--${level}`}
      title={t('shell.statusBar.showBarHint')}
      aria-label={t('shell.statusBar.showBarHint')}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('openwa-status-bar-prefs-updated', {
            detail: { showStatusBar: true },
          }),
        );
        import('../../lib/app-status-preferences').then(m =>
          m.saveStatusBarPreferences({ showStatusBar: true }),
        );
      }}
    >
      <span className="app-status-hidden-indicator__dot" aria-hidden />
    </button>
  );
}
