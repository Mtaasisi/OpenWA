import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { sessionApi, productsApi, aiApi, storageApi, smsApi } from '../services/api';
import { channelsUrl } from '../lib/channel-routes';
import { automationsHref } from '../lib/automations-routes';
import { settingsPanelHref } from './settings/settings-nav-registry';
import { translateStorageWarning } from '../lib/storage-i18n';
import { isLinkedSessionRecovering } from '../lib/linked-session-recovery';
import './SystemStatusBanner.css';

export function SystemStatusBanner() {
  const { t } = useTranslation();

  const { data: sessions } = useQuery({
    queryKey: ['sessions', 'status-banner'],
    queryFn: () => sessionApi.list(),
    staleTime: 30_000,
  });

  const { data: inauzwa } = useQuery({
    queryKey: ['inauzwa', 'status-banner'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
    staleTime: 60_000,
  });

  const { data: aiStatus } = useQuery({
    queryKey: ['ai', 'status-banner'],
    queryFn: () => aiApi.getStatus(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: storageUsage } = useQuery({
    queryKey: ['storage', 'status-banner'],
    queryFn: () => storageApi.getUsage(),
    staleTime: 120_000,
    retry: false,
  });

  const { data: smsStatus } = useQuery({
    queryKey: ['sms', 'status-banner'],
    queryFn: () => smsApi.getStatus(),
    staleTime: 60_000,
    retry: false,
  });

  const { data: autoReplyHealth } = useQuery({
    queryKey: ['ai', 'auto-reply', 'health', 'status-banner'],
    queryFn: () => aiApi.getAutoReplyHealth(),
    staleTime: 60_000,
    retry: false,
  });

  const alerts: string[] = [];

  const connected = sessions?.filter(s => s.status === 'ready').length ?? 0;
  const anyRecovering = sessions?.some(s => isLinkedSessionRecovering(s)) ?? false;
  if (sessions && sessions.length > 0 && connected === 0 && !anyRecovering) {
    alerts.push('No WhatsApp session is connected. Open Sessions to scan QR or reconnect.');
  }

  if (inauzwa?.configured && inauzwa.lastSyncError) {
    alerts.push(`Product sync failed: ${inauzwa.lastSyncError}`);
  }

  if (aiStatus && aiStatus.enabled && !aiStatus.apiKeySet) {
    alerts.push('AI is enabled but no provider API key is configured.');
  }
  if (aiStatus?.testStatus === 'failed') {
    alerts.push('AI provider test failed. Check Settings → Integrations → AI.');
  }

  if (autoReplyHealth?.masterEnabled && !autoReplyHealth.ready) {
    alerts.push(t('systemStatus.autoReply.notReady'));
  }

  for (const warning of storageUsage?.warnings ?? []) {
    alerts.push(translateStorageWarning(warning, t));
  }

  if (smsStatus?.configured) {
    if (smsStatus.status === 'failed') {
      alerts.push(
        smsStatus.lastError
          ? t('systemStatus.sms.failedWithError', { error: smsStatus.lastError })
          : t('systemStatus.sms.failed'),
      );
    } else if (smsStatus.lowBalance || smsStatus.status === 'low_balance') {
      alerts.push(
        smsStatus.lastBalance != null
          ? t('systemStatus.sms.lowBalanceWithAmount', { balance: smsStatus.lastBalance })
          : t('systemStatus.sms.lowBalance'),
      );
    } else if (smsStatus.isEnabled && !smsStatus.connected && smsStatus.status === 'not_connected') {
      alerts.push(t('systemStatus.sms.notConnected'));
    } else if (smsStatus.status === 'disabled') {
      alerts.push(t('systemStatus.sms.disabled'));
    }
  }

  if (alerts.length === 0) return null;

  const showSmsLink =
    smsStatus?.configured &&
    (smsStatus.status === 'failed' ||
      smsStatus.lowBalance ||
      smsStatus.status === 'low_balance' ||
      (smsStatus.isEnabled && !smsStatus.connected));

  const showStorageLink = (storageUsage?.warnings?.length ?? 0) > 0;

  const showAutoReplyLink =
    autoReplyHealth?.masterEnabled === true && autoReplyHealth.ready === false;

  return (
    <div className="system-status-banner" role="status">
      <AlertTriangle size={16} aria-hidden />
      <div className="system-status-banner__body">
        <ul>
          {alerts.map(msg => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
        {showAutoReplyLink && (
          <Link to={automationsHref('autoReply')} className="system-status-banner__link">
            {t('systemStatus.autoReply.openAutomations')}
          </Link>
        )}
        {showSmsLink && (
          <Link to={channelsUrl({ channel: 'sms', add: true })} className="system-status-banner__link">
            {t('systemStatus.sms.openSettings')}
          </Link>
        )}
        {showStorageLink && (
          <Link to={settingsPanelHref('storage-backup')} className="system-status-banner__link">
            {t('systemStatus.storage.openSettings')}
          </Link>
        )}
      </div>
    </div>
  );
}
