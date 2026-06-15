import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { smsApi, type SmsLogView } from '../services/api';
import { StatusBadge } from './workspace';
import './SmsChannelPanel.css';

type LogFilter = 'all' | 'sent' | 'failed' | 'today' | 'week' | 'mine';

function logStatusVariant(status: string): 'success' | 'danger' | 'neutral' {
  if (status === 'sent') return 'success';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export function SmsLogsPanel() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<LogFilter>('all');
  const [search, setSearch] = useState('');

  const queryParams = {
    status: filter === 'sent' || filter === 'failed' ? filter : undefined,
    period: filter === 'today' ? 'today' : filter === 'week' ? 'week' : undefined,
    sentBy: filter === 'mine' ? 'me' : undefined,
    q: search.trim() || undefined,
  };

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['sms', 'logs', queryParams],
    queryFn: () => smsApi.getLogs(queryParams),
  });

  const filters: { id: LogFilter; label: string }[] = [
    { id: 'sent', label: t('channels.smsLogsFilters.sent') },
    { id: 'failed', label: t('channels.smsLogsFilters.failed') },
    { id: 'today', label: t('channels.smsLogsFilters.today') },
    { id: 'week', label: t('channels.smsLogsFilters.week') },
    { id: 'mine', label: t('channels.smsLogsFilters.mine') },
  ];

  return (
    <div className="sms-logs">
      <div className="sms-logs__toolbar">
        <div className="sms-logs__search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('common.search')}
          />
        </div>
        <div className="sms-logs__chips">
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              className={`sms-logs__chip${filter === f.id ? ' sms-logs__chip--active' : ''}`}
              onClick={() => setFilter(prev => (prev === f.id ? 'all' : f.id))}
            >
              {f.label}
            </button>
          ))}
          <button type="button" className="fu-btn fu-btn--ghost fu-btn--sm" onClick={() => void refetch()}>
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="sms-logs__loading">
          <Loader2 className="spin" size={24} />
        </div>
      ) : logs.length === 0 ? (
        <p className="sms-logs__empty">{t('channels.smsEmptyLogs')}</p>
      ) : (
        <div className="fu-table-wrap">
          <table className="fu-table sms-logs__table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('sms.phone')}</th>
                <th>{t('sms.message')}</th>
                <th>{t('channels.smsProvider')}</th>
                <th>{t('common.status')}</th>
                <th>SMS #</th>
                <th>{t('channels.smsLogsFilters.mine')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row: SmsLogView) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td>{row.toPhone}</td>
                  <td className="sms-logs__preview" title={row.message}>
                    {row.messagePreview}
                    {row.errorMessage && (
                      <span className="sms-logs__error" title={row.errorMessage}>
                        {row.errorMessage}
                      </span>
                    )}
                  </td>
                  <td>{row.provider}</td>
                  <td>
                    <StatusBadge variant={logStatusVariant(row.status)}>{row.status}</StatusBadge>
                  </td>
                  <td>{row.smsCount}</td>
                  <td className="sms-logs__mono">{row.sentBy?.slice(0, 8) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
