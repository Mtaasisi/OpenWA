import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { aiApi, whatsAppSafetyApi, type AiAutoReplyHealthView } from '../../services/api';
import { useToast } from '../Toast';
import { useRole } from '../../hooks/useRole';
import { automationsHref } from '../../lib/automations-routes';
import { settingsPanelHref } from '../settings/settings-nav-registry';
import { channelsUrl } from '../../lib/channel-routes';
import { detectWhatsAppReplyPacingPreset } from '../../lib/whatsapp-safety-pacing';
import './AutoReplyHealthPanel.css';

function fixHref(target: AiAutoReplyHealthView['checks'][0]['fixTarget']): string {
  switch (target) {
    case 'ai':
      return '/settings?section=ai&panel=ai';
    case 'whatsapp-safety':
      return settingsPanelHref('whatsapp-safety', { waTab: 'rules' });
    case 'channels':
      return channelsUrl({ channel: 'whatsapp' });
    case 'ai-knowledge':
      return '/settings?section=ai&panel=ai-knowledge';
    case 'products':
      return '/products';
    case 'automations':
    default:
      return automationsHref('autoReply');
  }
}

export function AutoReplyHealthPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { canWrite } = useRole();

  const { data: health, isLoading } = useQuery({
    queryKey: ['ai', 'auto-reply', 'health'],
    queryFn: () => aiApi.getAutoReplyHealth(),
    refetchInterval: 60_000,
  });

  const { data: waOverview } = useQuery({
    queryKey: ['whatsapp-safety', 'overview'],
    queryFn: () => whatsAppSafetyApi.getOverview(),
    refetchInterval: 60_000,
  });

  const { data: waSettings } = useQuery({
    queryKey: ['whatsapp-safety', 'settings'],
    queryFn: () => whatsAppSafetyApi.getSettings(),
    refetchInterval: 60_000,
  });

  const masterMutation = useMutation({
    mutationFn: (enabled: boolean) => aiApi.setAutoReplyMaster(enabled),
    onSuccess: (res, enabled) => {
      void qc.invalidateQueries({ queryKey: ['ai'] });
      void qc.invalidateQueries({ queryKey: ['ai-status'] });
      void qc.invalidateQueries({ queryKey: ['sessions'] });
      void qc.invalidateQueries({ queryKey: ['whatsapp-safety'] });
      toast.success(
        enabled ? t('automations.hub.aiAutoReplyEnabled') : t('automations.hub.aiAutoReplyDisabled'),
      );
      void qc.setQueryData(['ai', 'auto-reply', 'health'], res);
    },
    onError: (err: Error) => toast.error(t('common.error'), err.message),
  });

  if (isLoading || !health) {
    return (
      <div className="auto-reply-health auto-reply-health--loading">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const statusLabel = health.ready
    ? t('automations.autoReplyHealth.statusReady')
    : health.masterEnabled
      ? t('automations.autoReplyHealth.statusPartial')
      : t('automations.autoReplyHealth.statusOff');

  const pacingPreset = waSettings
    ? detectWhatsAppReplyPacingPreset({
        minAiReplyDelayMs: waSettings.minAiReplyDelayMs ?? 15_000,
        maxAiReplyDelayMs: waSettings.maxAiReplyDelayMs ?? 90_000,
        minDelayBetweenMessagesMs: waSettings.minDelayBetweenMessagesMs ?? 8_000,
      })
    : 'standard';

  const extraChecks: Array<{
    id: string;
    ok: boolean;
    detail?: string;
    fixTarget?: AiAutoReplyHealthView['checks'][0]['fixTarget'];
  }> = [];

  if ((waOverview?.pendingQueue ?? 0) > 0) {
    extraChecks.push({
      id: 'queuePending',
      ok: true,
      detail: String(waOverview!.pendingQueue),
      fixTarget: 'whatsapp-safety',
    });
  }

  if (pacingPreset === 'standard') {
    extraChecks.push({
      id: 'pacingStandard',
      ok: true,
      fixTarget: 'whatsapp-safety',
    });
  }

  const allChecks = [...health.checks, ...extraChecks];

  return (
    <section className={`auto-reply-health${compact ? ' auto-reply-health--compact' : ''}`}>
      <div className="auto-reply-health__head">
        <div>
          <h3 className="auto-reply-health__title">
            <MaterialSymbol name="monitor_heart" size={20} />
            {t('automations.autoReplyHealth.title')}
          </h3>
          <p className="auto-reply-health__subtitle">{t('automations.autoReplyHealth.subtitle')}</p>
        </div>
        <span
          className={`auto-reply-health__badge${health.ready ? ' is-ready' : health.masterEnabled ? ' is-partial' : ' is-off'}`}
        >
          {statusLabel}
        </span>
      </div>

      {canWrite && (
        <label className="automations-hub-toggle auto-reply-health__master">
          <input
            type="checkbox"
            checked={health.masterEnabled}
            disabled={masterMutation.isPending}
            onChange={e => masterMutation.mutate(e.target.checked)}
          />
          <span className="automations-hub-toggle__track" aria-hidden />
          <span>{t('automations.hub.masterSwitch')}</span>
          {masterMutation.isPending && <Loader2 className="animate-spin" size={14} />}
        </label>
      )}

      <ul className="auto-reply-health__checks">
        {allChecks.map(check => (
          <li key={check.id} className={`auto-reply-health__check${check.ok ? ' is-ok' : ' is-fail'}`}>
            <MaterialSymbol
              name={check.ok ? 'check_circle' : 'error'}
              size={16}
              className="auto-reply-health__check-icon"
            />
            <span className="auto-reply-health__check-label">
              {t(`automations.autoReplyHealth.checks.${check.id}`)}
              {check.detail ? (
                <span className="auto-reply-health__check-detail"> — {check.detail}</span>
              ) : null}
            </span>
            {!check.ok && check.fixTarget && (
              <Link to={fixHref(check.fixTarget)} className="auto-reply-health__fix-link">
                {t('automations.autoReplyHealth.fix')}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <dl className="auto-reply-health__stats">
        <div>
          <dt>{t('dashboard.controlRoom.aiReplies24h')}</dt>
          <dd>{health.stats.aiReplies24h}</dd>
        </div>
        <div>
          <dt>{t('automations.autoReplyHealth.openEscalations')}</dt>
          <dd>{health.stats.openEscalations}</dd>
        </div>
        <div>
          <dt>{t('ai.knowledge.indexLabel')}</dt>
          <dd>{health.stats.knowledgeChunks}</dd>
        </div>
      </dl>

      {!compact && health.sessions.length > 0 && (
        <div className="auto-reply-health__sessions">
          <h4>{t('automations.autoReplyHealth.sessionsTitle')}</h4>
          <ul>
            {health.sessions.map(s => (
              <li key={s.sessionId} className="auto-reply-health__session-row">
                <span className="auto-reply-health__session-name">{s.name}</span>
                <span className="auto-reply-health__session-meta">
                  {s.connected ? s.status : s.status}
                  {!s.aiAutoReplyEnabled ? ` · ${t('automations.autoReplyHealth.sessionExcluded')}` : ''}
                  {s.automationPaused ? ` · ${t('automations.autoReplyHealth.automationPaused')}` : ''}
                  {s.circuitBreakerOpen ? ` · ${t('automations.autoReplyHealth.circuitOpen')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
