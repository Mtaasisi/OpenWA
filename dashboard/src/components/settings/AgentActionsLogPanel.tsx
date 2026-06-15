import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agentActionsApi } from '../../services/api';
import { settingsPanelHref } from './settings-nav-registry';

type Props = {
  embedded?: boolean;
};

export function AgentActionsLogPanel({ embedded: _embedded }: Props) {
  const { t } = useTranslation();
  const { data: audit = [], isLoading } = useQuery({
    queryKey: ['agent-actions-audit'],
    queryFn: () => agentActionsApi.audit(50),
  });
  const { data: pendingData } = useQuery({
    queryKey: ['agent-actions-pending'],
    queryFn: () => agentActionsApi.list(true),
  });

  return (
    <div className="settings-card">
      <div className="settings-card__body">
        <h3>{t('settings.agentActions.title', { defaultValue: 'Agent Actions Log' })}</h3>
        <p className="settings-card__hint">
          {t('settings.agentActions.description', {
            defaultValue: 'Recent AI assistant settings operations and pending confirmations.',
          })}
        </p>

        {(pendingData?.pendingCount ?? 0) > 0 ? (
          <div className="settings-notice settings-notice--warn" style={{ marginBottom: 16 }}>
            {t('settings.agentActions.pendingCount', {
              defaultValue: '{{count}} pending confirmation(s)',
              count: pendingData?.pendingCount ?? 0,
            })}
          </div>
        ) : null}

        <p>
          <Link to="/ai" className="settings-wa__btn-secondary">
            {t('settings.agentActions.openAssistant', { defaultValue: 'Open AI Assistant' })}
          </Link>
        </p>

        {isLoading ? (
          <p>{t('common.loading')}</p>
        ) : audit.length === 0 ? (
          <p>{t('settings.agentActions.empty', { defaultValue: 'No agent actions logged yet.' })}</p>
        ) : (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>{t('settings.agentActions.colAction', { defaultValue: 'Action' })}</th>
                  <th>{t('settings.agentActions.colStatus', { defaultValue: 'Status' })}</th>
                  <th>{t('settings.agentActions.colRisk', { defaultValue: 'Risk' })}</th>
                  <th>{t('settings.agentActions.colWhen', { defaultValue: 'When' })}</th>
                </tr>
              </thead>
              <tbody>
                {audit.map(row => (
                  <tr key={String(row.id)}>
                    <td>{String(row.actionTitle ?? row.actionId ?? '—')}</td>
                    <td>{String(row.status ?? '—')}</td>
                    <td>{String(row.risk ?? '—')}</td>
                    <td>{row.createdAt ? new Date(String(row.createdAt)).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 16 }}>
          <Link to={settingsPanelHref('logs')}>
            {t('settings.agentActions.viewSystemLogs', { defaultValue: 'View system audit logs' })}
          </Link>
        </p>
      </div>
    </div>
  );
}
