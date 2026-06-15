import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSettingsPage } from '../settings-page-context';
import { useAppStatus } from '../../../hooks/useAppStatus';
import { useSmsStatus } from '../../../hooks/useLinkedChannels';
import { whatsAppSafetyApi } from '../../../services/api';
import type { SettingsCategoryId } from '../settings-types';
import { SettingsHubSection, SettingsHubStatRow } from './SettingsHubPrimitives';

export function CategoryHubSummary({ categoryId }: { categoryId: SettingsCategoryId }) {
  switch (categoryId) {
    case 'chats':
      return <ChatsHubSummary />;
    case 'business':
      return <BusinessHubSummary />;
    case 'safety':
      return <SafetyHubSummary />;
    case 'system':
      return <SystemHubSummary />;
    case 'help':
      return <HelpHubSummary />;
    default:
      return null;
  }
}

function ChatsHubSummary() {
  const { t } = useTranslation();
  const ctx = useSettingsPage();
  const { data: smsStatus } = useSmsStatus();

  const totalSessions = ctx.allSessions.length;
  const connectedSessions = ctx.allSessions.filter(s => s.status === 'ready').length;
  const whatsappLabel =
    totalSessions === 0
      ? t('settings.hub.noWhatsappSessions')
      : t('settings.hub.whatsappSessionsSub', {
          connected: connectedSessions,
          total: totalSessions,
        });

  const smsConnected = smsStatus?.connected ?? false;
  const smsSubtitle = smsConnected
    ? t('settings.hub.smsConnected')
    : t('settings.hub.smsNotConnected');

  return (
    <SettingsHubSection
      title={t('settings.hub.channelsConnectivity')}
      badge={<span className="settings-hub__stable-badge">{t('settings.hub.live')}</span>}
    >
      <SettingsHubStatRow
        icon="chat"
        title={t('settings.hub.whatsappSessions')}
        subtitle={whatsappLabel}
        statusLabel={
          connectedSessions > 0 ? t('settings.account.online') : t('settings.hub.notLinked')
        }
        statusTone={connectedSessions > 0 ? 'success' : 'neutral'}
      />
      <SettingsHubStatRow
        icon="sms"
        title={t('settings.hub.smsChannel')}
        subtitle={smsSubtitle}
        statusLabel={smsConnected ? t('settings.account.online') : t('settings.hub.notLinked')}
        statusTone={smsConnected ? 'success' : 'neutral'}
      />
    </SettingsHubSection>
  );
}

function BusinessHubSummary() {
  const { t } = useTranslation();
  const ctx = useSettingsPage();

  const configured = ctx.inauzwaStatus?.configured ?? false;
  const autoSync = ctx.inauzwaStatus?.preferences?.autoSyncEnabled ?? false;
  const lastSyncAt = ctx.inauzwaStatus?.preferences?.lastSyncAt;
  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString()
    : t('settings.hub.neverSynced');

  return (
    <>
      <SettingsHubSection
        title={t('settings.hub.businessOverview')}
        badge={
          <span className="settings-hub__stable-badge">
            {configured ? t('settings.hub.live') : t('settings.hub.review')}
          </span>
        }
      >
        <SettingsHubStatRow
          icon="inventory_2"
          title={t('settings.hub.productsCatalog')}
          subtitle={
            configured
              ? t('settings.hub.inauzwaConnected')
              : t('settings.hub.inauzwaNotConnected')
          }
          statusLabel={configured ? t('settings.account.online') : t('settings.hub.notLinked')}
          statusTone={configured ? 'success' : 'neutral'}
        />
        <SettingsHubStatRow
          icon="cloud_sync"
          title={t('settings.hub.catalogSync')}
          subtitle={lastSyncLabel}
          statusLabel={autoSync ? t('settings.hub.autoSyncOn') : t('settings.hub.autoSyncOff')}
          statusTone={configured && autoSync ? 'success' : 'neutral'}
        />
        <SettingsHubStatRow
          icon="handshake"
          title={t('settings.hub.followupsPipeline')}
          subtitle={t('settings.hub.followupsPipelineSub')}
          statusLabel={t('settings.hub.live')}
          statusTone="success"
        />
      </SettingsHubSection>
      <div className="settings-hub__cta-row settings-hub__cta-row--standalone">
        <Link to="/products" className="settings-wa__btn-primary settings-hub__cta-btn">
          {t('settings.hub.openProducts')}
        </Link>
        <Link to="/followups" className="settings-hub__btn-outline settings-hub__cta-btn">
          {t('settings.hub.openFollowups')}
        </Link>
      </div>
    </>
  );
}

function SystemHubSummary() {
  const { t } = useTranslation();
  const ctx = useSettingsPage();
  const { data: appStatus } = useAppStatus();

  const connectionLabel =
    ctx.apiOnline === null
      ? '…'
      : ctx.apiOnline
        ? t('settings.account.online')
        : t('settings.account.offline');

  const branchName = appStatus?.branch?.name ?? t('settings.hub.branchUnknown');

  return (
    <SettingsHubSection
      title={t('settings.hub.systemHealth')}
      badge={<span className="settings-hub__stable-badge">{t('settings.hub.stable')}</span>}
    >
      <SettingsHubStatRow
        icon="bolt"
        title={t('settings.account.connection')}
        subtitle="OpenWA Enterprise Node"
        statusLabel={connectionLabel}
        statusTone={ctx.apiOnline === false ? 'neutral' : 'success'}
      />
      <SettingsHubStatRow
        icon="hub"
        title={t('settings.hub.branchManagement')}
        subtitle={t('settings.hub.primaryBranch', { name: branchName })}
        statusLabel={t('settings.hub.primary')}
        statusTone="neutral"
      />
    </SettingsHubSection>
  );
}

function SafetyHubSummary() {
  const { t } = useTranslation();
  const ctx = useSettingsPage();
  const { data } = useQuery({
    queryKey: ['whatsapp-safety', 'overview'],
    queryFn: () => whatsAppSafetyApi.getOverview(),
    enabled: ctx.isAdmin,
    staleTime: 30_000,
  });

  if (!ctx.isAdmin) return null;

  const safetyActive = data?.safetyEnabled ?? false;
  const pendingQueue = data?.pendingQueue ?? 0;
  const warmupCount = data?.accountsInWarmup ?? 0;

  return (
    <SettingsHubSection
      title={t('settings.hub.safetyOverview')}
      badge={
        <span className="settings-hub__stable-badge">
          {safetyActive ? t('settings.hub.live') : t('settings.hub.review')}
        </span>
      }
    >
      <SettingsHubStatRow
        icon="security_update_good"
        title={t('whatsappSafety.title')}
        subtitle={t('settings.items.whatsappSafety.description')}
        statusLabel={safetyActive ? t('settings.hub.safetyEnabled') : t('settings.hub.safetyDisabled')}
        statusTone={safetyActive ? 'success' : 'neutral'}
      />
      <SettingsHubStatRow
        icon="queue"
        title={t('settings.hub.safetyQueue')}
        subtitle={t('settings.hub.queuePending', { count: pendingQueue })}
        statusLabel={pendingQueue > 0 ? t('settings.hub.review') : t('settings.hub.stable')}
        statusTone={pendingQueue > 0 ? 'neutral' : 'success'}
      />
      <SettingsHubStatRow
        icon="local_fire_department"
        title={t('settings.hub.safetyWarmup')}
        subtitle={t('settings.hub.warmupAccounts', { count: warmupCount })}
        statusLabel={warmupCount > 0 ? t('settings.hub.review') : t('settings.hub.stable')}
        statusTone={warmupCount > 0 ? 'neutral' : 'success'}
      />
    </SettingsHubSection>
  );
}

function HelpHubSummary() {
  const { t } = useTranslation();

  return (
    <SettingsHubSection title={t('settings.hub.appInfo')}>
      <SettingsHubStatRow
        icon="info"
        title={t('common.appName')}
        subtitle="v2.4.8-enterprise"
        statusLabel={t('settings.hub.stable')}
        statusTone="success"
      />
      <SettingsHubStatRow
        icon="link"
        title={t('settings.about.apiUrl')}
        subtitle="/api"
        statusLabel={t('settings.hub.live')}
        statusTone="neutral"
      />
    </SettingsHubSection>
  );
}
