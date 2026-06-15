import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { smsApi, type SmsChannelStatus } from '../services/api';
import { useRole } from '../hooks/useRole';
import { StatusBadge } from './workspace';
import { SmsLogsPanel } from './SmsLogsPanel';
import { SmsSetupForm } from './SmsSetupForm';
import './SmsChannelPanel.css';

type Tab = 'setup' | 'logs';

function statusVariant(status: SmsChannelStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'connected') return 'success';
  if (status === 'low_balance' || status === 'testing') return 'warning';
  if (status === 'failed') return 'danger';
  return 'neutral';
}

export function SmsChannelPanel({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const [tab, setTab] = useState<Tab>('setup');

  const { data: settings } = useQuery({
    queryKey: ['sms', 'settings'],
    queryFn: () => smsApi.getSettings(),
    enabled: canWrite,
  });

  const status = settings?.status ?? 'not_connected';

  const emptyMessage = () => {
    if (status === 'disabled') return t('channels.smsEmptyDisabled');
    if (status === 'failed') return t('channels.smsEmptyFailed');
    if (status === 'low_balance') return t('channels.smsEmptyLowBalance');
    if (status === 'not_connected') return t('channels.smsEmptyNotConnected');
    return null;
  };

  return (
    <div className="sms-panel">
      <div className="sms-panel__tabs">
        <button
          type="button"
          className={`sms-panel__tab${tab === 'setup' ? ' sms-panel__tab--active' : ''}`}
          onClick={() => setTab('setup')}
        >
          {t('channels.smsTabSetup')}
        </button>
        <button
          type="button"
          className={`sms-panel__tab${tab === 'logs' ? ' sms-panel__tab--active' : ''}`}
          onClick={() => setTab('logs')}
        >
          {t('channels.smsTabLogs')}
        </button>
      </div>

      {tab === 'logs' ? (
        <SmsLogsPanel />
      ) : (
        <>
          {!compact ? (
            <div className="sms-panel__header">
              <MessageSquare size={22} />
              <div>
                <h3>{t('channels.smsSetupTitle')}</h3>
                <p>{t('channels.smsSetupDesc')}</p>
              </div>
              <StatusBadge variant={statusVariant(status)}>
                {t(`channels.smsStatus.${status}`)}
              </StatusBadge>
            </div>
          ) : null}

          {!compact && emptyMessage() && status !== 'connected' && (
            <p className="sms-panel__empty-hint">{emptyMessage()}</p>
          )}

          <SmsSetupForm variant="panel" />
        </>
      )}
    </div>
  );
}
