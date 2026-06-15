import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import {
  aiApi,
  followupApi,
  sessionApi,
  whatsAppSafetyApi,
  type FollowUpAutopilotMode,
} from '../../services/api';
import { useToast } from '../Toast';
import { useRole } from '../../hooks/useRole';
import { settingsPanelHref } from '../settings/settings-nav-registry';
import './AutomationsOverviewPanel.css';

type CardStatus = 'active' | 'partial' | 'off' | 'setup';

function statusClass(status: CardStatus): string {
  return `automations-hub-card__status automations-hub-card__status--${status}`;
}

export function AutomationsOverviewPanel({
  onOpenTab,
}: {
  onOpenTab: (tab: 'autoReply' | 'autopilot' | 'rules' | 'future') => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { canWrite } = useRole();

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['ai', 'auto-reply', 'health'],
    queryFn: () => aiApi.getAutoReplyHealth(),
  });

  const { data: safety, isLoading: safetyLoading } = useQuery({
    queryKey: ['whatsapp-safety', 'settings'],
    queryFn: () => whatsAppSafetyApi.getSettings(),
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(),
  });

  const { data: autopilotSettings, isLoading: autopilotLoading } = useQuery({
    queryKey: ['followup', 'autopilot', 'settings'],
    queryFn: () => followupApi.getAutopilotSettings(),
  });

  const { data: autopilotDashboard } = useQuery({
    queryKey: ['followup', 'autopilot', 'dashboard'],
    queryFn: () => followupApi.getAutopilotDashboard(),
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['followups', 'rules'],
    queryFn: () => followupApi.listRules(),
  });

  const loading =
    healthLoading || safetyLoading || sessionsLoading || autopilotLoading || rulesLoading;

  const invalidateAi = () => {
    void qc.invalidateQueries({ queryKey: ['ai-status'] });
    void qc.invalidateQueries({ queryKey: ['ai-config'] });
    void qc.invalidateQueries({ queryKey: ['ai', 'auto-reply', 'health'] });
    void qc.invalidateQueries({ queryKey: ['sessions'] });
    void qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });
  };

  const aiAutoReplyMutation = useMutation({
    mutationFn: (enabled: boolean) => aiApi.setAutoReplyMaster(enabled),
    onSuccess: (_data, enabled) => {
      invalidateAi();
      toast.success(
        enabled ? t('automations.hub.aiAutoReplyEnabled') : t('automations.hub.aiAutoReplyDisabled'),
      );
    },
    onError: (err: Error) => toast.error(t('common.error'), err.message),
  });

  const followupAutopilotMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const patch: { enabled: boolean; autopilotMode?: FollowUpAutopilotMode } = { enabled };
      if (enabled && autopilotSettings?.autopilotMode === 'off') {
        patch.autopilotMode = 'auto_send_safe';
      }
      if (!enabled) {
        patch.autopilotMode = 'off';
      }
      await followupApi.updateAutopilotSettings(patch);
      if (enabled) {
        await whatsAppSafetyApi.patchSettings({ followupAutoSendEnabled: true });
      }
    },
    onSuccess: (_data, enabled) => {
      void qc.invalidateQueries({ queryKey: ['followup', 'autopilot'] });
      toast.success(
        enabled
          ? t('automations.hub.followupAutopilotEnabled')
          : t('automations.hub.followupAutopilotDisabled'),
      );
    },
    onError: (err: Error) => toast.error(t('common.error'), err.message),
  });

  if (loading) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const readySessions = sessions.filter(s => s.status === 'ready');
  const followupSessionsOn = sessions.filter(s => s.followupAutopilotEnabled === true).length;
  const activeRules = rules.filter(r => r.active).length;

  const aiMasterOn = health?.masterEnabled === true;
  const aiProviderReady = health?.checks.find(c => c.id === 'providerReady')?.ok === true;
  const aiSafetyOn = health?.checks.find(c => c.id === 'safetyAiReply')?.ok === true;
  const aiSessionsOn = health?.sessions.filter(s => s.aiAutoReplyEnabled).length ?? 0;
  const sessionTotal = health?.sessions.length ?? sessions.length;

  let aiStatusKind: CardStatus = 'off';
  if (health?.ready) {
    aiStatusKind = 'active';
  } else if (health?.masterEnabled) {
    aiStatusKind = 'partial';
  } else if (!aiProviderReady) {
    aiStatusKind = 'setup';
  }

  const aiIssues: string[] = [];
  if (health) {
    for (const check of health.checks) {
      if (check.ok || check.id === 'syncAligned') continue;
      aiIssues.push(
        check.detail ??
          t(`automations.autoReplyHealth.checks.${check.id}`),
      );
    }
  } else {
    if (!aiProviderReady) aiIssues.push(t('automations.hub.issueAiProvider'));
    if (!aiMasterOn) aiIssues.push(t('automations.hub.issueAiMasterOff'));
    if (!aiSafetyOn) aiIssues.push(t('automations.hub.issueAiSafetyOff'));
  }

  const autopilotOn =
    autopilotSettings?.enabled === true && autopilotSettings.autopilotMode !== 'off';
  const followupSafetyOn = safety?.followupAutoSendEnabled === true;
  let autopilotStatusKind: CardStatus = autopilotOn ? 'active' : 'off';
  if (autopilotOn && !followupSafetyOn) autopilotStatusKind = 'partial';

  const autopilotIssues: string[] = [];
  if (!autopilotOn) autopilotIssues.push(t('automations.hub.issueAutopilotOff'));
  if (autopilotOn && !followupSafetyOn) {
    autopilotIssues.push(t('automations.hub.issueFollowupSafetyOff'));
  }
  if ((autopilotDashboard?.pausedAccounts.length ?? 0) > 0) {
    autopilotIssues.push(
      t('automations.hub.issueAutopilotPaused', {
        count: autopilotDashboard!.pausedAccounts.length,
      }),
    );
  }

  return (
    <div className="automations-hub">
      <header className="automations-hub__intro">
        <p>{t('automations.pageDescription')}</p>
      </header>

      <div className="automations-hub__grid">
        {/* AI Auto-reply */}
        <article className="automations-hub-card">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="smart_toy" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.tabs.autoReply')}</h3>
              <p>{t('automations.hub.aiAutoReplyDesc')}</p>
            </div>
            <span className={statusClass(aiStatusKind)}>
              {t(`automations.hub.status.${aiStatusKind}`)}
            </span>
          </div>

          <dl className="automations-hub-card__stats">
            <div>
              <dt>{t('automations.hub.statSessions')}</dt>
              <dd>
                {aiSessionsOn}/{sessionTotal}
              </dd>
            </div>
            <div>
              <dt>{t('automations.hub.statConnected')}</dt>
              <dd>{health?.sessions.filter(s => s.connected).length ?? readySessions.length}</dd>
            </div>
            {health && (
              <div>
                <dt>{t('dashboard.controlRoom.aiReplies24h')}</dt>
                <dd>{health.stats.aiReplies24h}</dd>
              </div>
            )}
          </dl>

          {aiIssues.length > 0 && (
            <ul className="automations-hub-card__issues">
              {aiIssues.map(issue => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}

          <div className="automations-hub-card__actions">
            {canWrite && (
              <label className="automations-hub-toggle">
                <input
                  type="checkbox"
                  checked={aiMasterOn}
                  disabled={aiAutoReplyMutation.isPending}
                  onChange={e => aiAutoReplyMutation.mutate(e.target.checked)}
                />
                <span className="automations-hub-toggle__track" aria-hidden />
                <span>{t('automations.hub.masterSwitch')}</span>
                {aiAutoReplyMutation.isPending && <Loader2 className="animate-spin" size={14} />}
              </label>
            )}
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              onClick={() => onOpenTab('autoReply')}
            >
              {t('automations.hub.configure')}
            </button>
          </div>
        </article>

        {/* Follow-up autopilot */}
        <article className="automations-hub-card">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="schedule_send" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.tabs.autopilot')}</h3>
              <p>{t('automations.hub.followupAutopilotDesc')}</p>
            </div>
            <span className={statusClass(autopilotStatusKind)}>
              {t(`automations.hub.status.${autopilotStatusKind}`)}
            </span>
          </div>

          <dl className="automations-hub-card__stats">
            <div>
              <dt>{t('automations.hub.statMode')}</dt>
              <dd>{autopilotSettings?.autopilotMode?.replace(/_/g, ' ') ?? 'off'}</dd>
            </div>
            <div>
              <dt>{t('automations.hub.statSentToday')}</dt>
              <dd>{autopilotDashboard?.autoSentToday ?? 0}</dd>
            </div>
            <div>
              <dt>{t('automations.hub.statAccounts')}</dt>
              <dd>
                {followupSessionsOn}/{sessions.length}
              </dd>
            </div>
          </dl>

          {autopilotIssues.length > 0 && (
            <ul className="automations-hub-card__issues">
              {autopilotIssues.map(issue => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}

          <div className="automations-hub-card__actions">
            {canWrite && (
              <label className="automations-hub-toggle">
                <input
                  type="checkbox"
                  checked={autopilotOn}
                  disabled={followupAutopilotMutation.isPending}
                  onChange={e => followupAutopilotMutation.mutate(e.target.checked)}
                />
                <span className="automations-hub-toggle__track" aria-hidden />
                <span>{t('automations.hub.masterSwitch')}</span>
                {followupAutopilotMutation.isPending && (
                  <Loader2 className="animate-spin" size={14} />
                )}
              </label>
            )}
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              onClick={() => onOpenTab('autopilot')}
            >
              {t('automations.hub.configure')}
            </button>
          </div>
        </article>

        {/* Follow-up rules */}
        <article className="automations-hub-card">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="rule" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.tabs.rules')}</h3>
              <p>{t('automations.hub.followupRulesDesc')}</p>
            </div>
            <span className={statusClass(activeRules > 0 ? 'active' : 'off')}>
              {activeRules > 0
                ? t('automations.hub.rulesActive', { count: activeRules })
                : t('automations.hub.status.off')}
            </span>
          </div>

          <dl className="automations-hub-card__stats">
            <div>
              <dt>{t('automations.hub.statTotalRules')}</dt>
              <dd>{rules.length}</dd>
            </div>
            <div>
              <dt>{t('automations.hub.statActiveRules')}</dt>
              <dd>{activeRules}</dd>
            </div>
          </dl>

          <div className="automations-hub-card__actions">
            <button
              type="button"
              className="fu-btn fu-btn--primary fu-btn--sm"
              onClick={() => onOpenTab('rules')}
            >
              {t('automations.hub.manageRules')}
            </button>
          </div>
        </article>

        {/* WhatsApp safety pacing */}
        <article className="automations-hub-card automations-hub-card--muted">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="shield" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.hub.safetyTitle')}</h3>
              <p>{t('automations.hub.safetyDesc')}</p>
            </div>
            <span className={statusClass(safety?.globalEnabled ? 'active' : 'partial')}>
              {safety?.globalEnabled
                ? t('automations.hub.status.active')
                : t('automations.hub.status.partial')}
            </span>
          </div>

          <dl className="automations-hub-card__stats">
            <div>
              <dt>{t('automations.hub.statDelay')}</dt>
              <dd>
                {Math.round((safety?.minDelayBetweenMessagesMs ?? 0) / 1000)}–
                {Math.round((safety?.maxDelayBetweenMessagesMs ?? 0) / 1000)}s
              </dd>
            </div>
            <div>
              <dt>{t('automations.hub.statDailyCap')}</dt>
              <dd>{safety?.maxOutboundPerDay ?? '—'}</dd>
            </div>
          </dl>

          <div className="automations-hub-card__actions">
            <Link to={settingsPanelHref('whatsapp-safety')} className="fu-btn fu-btn--ghost fu-btn--sm">
              {t('automations.hub.openSafety')}
            </Link>
          </div>
        </article>

        {/* Campaigns link */}
        <article className="automations-hub-card automations-hub-card--muted">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="campaign" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.hub.campaignsTitle')}</h3>
              <p>{t('automations.hub.campaignsDesc')}</p>
            </div>
            <span className={statusClass(safety?.campaignsEnabled ? 'partial' : 'off')}>
              {safety?.campaignsEnabled
                ? t('automations.hub.status.partial')
                : t('automations.hub.status.off')}
            </span>
          </div>

          <div className="automations-hub-card__actions">
            <Link to="/campaigns" className="fu-btn fu-btn--ghost fu-btn--sm">
              {t('automations.hub.openCampaigns')}
            </Link>
          </div>
        </article>

        {/* Coming soon */}
        <article className="automations-hub-card automations-hub-card--future">
          <div className="automations-hub-card__head">
            <span className="automations-hub-card__icon" aria-hidden>
              <MaterialSymbol name="upcoming" size={22} />
            </span>
            <div className="automations-hub-card__titles">
              <h3>{t('automations.tabs.more')}</h3>
              <p>{t('automations.comingSoonDescription')}</p>
            </div>
          </div>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            onClick={() => onOpenTab('future')}
          >
            {t('automations.hub.viewRoadmap')}
          </button>
        </article>
      </div>
    </div>
  );
}
