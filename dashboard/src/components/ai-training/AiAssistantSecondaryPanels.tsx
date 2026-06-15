import { Link, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { aiApi, aiTrainingApi, agentActionsApi } from '../../services/api';
import { settingsPanelHref } from '../settings/settings-nav-registry';
import { AiTrainingAuditTimeline } from './AiTrainingAuditTimeline';
import './AiTrainingCenter.css';

const AUDIT_FILTERS = ['all', 'created', 'approved', 'applied', 'rejected', 'failed', 'reindexed'] as const;
type AuditFilter = (typeof AUDIT_FILTERS)[number];

export function AiAssistantDiagnosePanel() {
  const { t } = useTranslation();
  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.getStatus(),
  });

  return (
    <div className="aitc-panel">
      <header className="aitc-header">
        <div>
          <h1>{t('ai.assistant.diagnose.title', { defaultValue: 'AI Diagnose' })}</h1>
          <p>{t('ai.assistant.diagnose.subtitle', { defaultValue: 'Quick health check for AI auto-reply and knowledge.' })}</p>
        </div>
        <Link to={settingsPanelHref('ai')} className="aitc-btn">{t('ai.chat.settings', { defaultValue: 'Settings' })}</Link>
      </header>
      <div className="aitc-kpis">
        <div className="aitc-kpi"><span className="aitc-kpi__label">Auto-reply</span><span className="aitc-kpi__value">{status?.autoReplyEnabled ? 'On' : 'Off'}</span></div>
        <div className="aitc-kpi"><span className="aitc-kpi__label">Provider</span><span className="aitc-kpi__value">{status?.provider ?? '—'}</span></div>
        <div className="aitc-kpi"><span className="aitc-kpi__label">Knowledge chunks</span><span className="aitc-kpi__value">{status?.knowledge?.chunks ?? '—'}</span></div>
      </div>
    </div>
  );
}

export function AiAssistantKnowledgePanel() {
  const { t } = useTranslation();
  const { data: overview } = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: () => aiTrainingApi.getOverview(),
  });

  return (
    <div className="aitc-panel">
      <header className="aitc-header">
        <div>
          <h1>{t('ai.assistant.knowledge.title', { defaultValue: 'Knowledge' })}</h1>
          <p>{t('ai.assistant.knowledge.subtitle', { defaultValue: 'Manage shop knowledge files and reindex.' })}</p>
        </div>
        <Link to={settingsPanelHref('ai-knowledge')} className="aitc-btn aitc-btn--primary">
          {t('ai.assistant.knowledge.open', { defaultValue: 'Open knowledge settings' })}
        </Link>
      </header>
      <div className="aitc-kpi">
        <span className="aitc-kpi__label">Needs reindex</span>
        <span className="aitc-kpi__value">{overview?.needsReindex ? 'Yes' : 'No'}</span>
      </div>
    </div>
  );
}

export function AiAssistantActionsPanel() {
  const { t } = useTranslation();
  const { data: logs = [] } = useQuery({
    queryKey: ['agent-actions', 'audit'],
    queryFn: () => agentActionsApi.audit(20),
  });

  return (
    <div className="aitc-panel">
      <header className="aitc-header">
        <div>
          <h1>{t('ai.assistant.actions.title', { defaultValue: 'Agent Actions' })}</h1>
          <p>{t('ai.assistant.actions.subtitle', { defaultValue: 'Recent settings and system actions from AI Assistant.' })}</p>
        </div>
        <Link to={settingsPanelHref('agent-actions-log')} className="aitc-btn">{t('ai.assistant.actions.viewLog', { defaultValue: 'View full log' })}</Link>
      </header>
      <div className="aitc-list">
        {logs.slice(0, 10).map((row, i) => (
          <article key={String(row.id ?? i)} className="aitc-card">
            <strong>{String(row.actionTitle ?? row.actionId ?? 'Action')}</strong>
            <p className="aitc-card__excerpt">{String(row.resultSummary ?? row.paramsSummary ?? '')}</p>
            <span className="aitc-card__meta">{row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : ''}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AiAssistantLogsPanel() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const itemFilter = searchParams.get('item');
  const [filter, setFilter] = useState<AuditFilter>('all');

  return (
    <div className="aitc-panel" data-testid="ai-assistant-logs-panel">
      <header className="aitc-header">
        <div>
          <h1>{t('ai.assistant.logs.title', { defaultValue: 'Training logs' })}</h1>
          <p>{t('ai.assistant.logs.subtitle', { defaultValue: 'Audit trail for training approvals, applies, backups, and failures.' })}</p>
          {itemFilter ? (
            <p className="aitc-logs-filter" data-testid="ai-training-logs-item-filter">
              {t('ai.training.logsFilteredToItem', {
                defaultValue: 'Showing activity for training item {{id}}.',
                id: itemFilter,
              })}{' '}
              <Link to={`/ai?tab=training&item=${encodeURIComponent(itemFilter)}`}>
                {t('ai.training.backToReview', { defaultValue: 'Back to review' })}
              </Link>
            </p>
          ) : null}
        </div>
        <Link to="/ai?tab=training" className="aitc-btn aitc-btn--primary">
          {t('ai.training.openCenter', { defaultValue: 'Open Training Center' })}
        </Link>
      </header>

      <div className="aitc-audit-filters" role="tablist" aria-label={t('ai.training.auditFilter', { defaultValue: 'Filter audit' })}>
        {AUDIT_FILTERS.map(id => (
          <button
            key={id}
            type="button"
            className={`aitc-btn aitc-btn--ghost${filter === id ? ' aitc-sidebar__btn--active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {id === 'all' ? t('common.all', { defaultValue: 'All' }) : id}
          </button>
        ))}
      </div>

      <AiTrainingAuditTimeline
        trainingItemId={itemFilter ?? undefined}
        limit={50}
        showItemLink={!itemFilter}
        actionFilter={filter}
      />
    </div>
  );
}
